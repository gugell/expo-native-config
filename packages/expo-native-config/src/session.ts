import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { IOSConfig } from '@expo/config-plugins';
import { getConfig } from '@expo/config';
import jiti from 'jiti';
import { resolveTargetBundleId } from './engine/ios-targets/bundleId';
import { collectGuidance } from './guidance';
import {
  TargetSchema,
  WorkspaceSchema,
  type ResolvedWorkspaceConfig,
  type TargetSpec,
  type WorkspaceConfig,
} from './schema';
import {
  appDeploymentTarget,
  collect,
  type WorkspaceAppConfig,
  type WorkspacePlan,
} from './engine';
import { discoverTargets, readPackageTarget, readPathTarget } from './engine/ios-targets/discover';
export interface Diagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  source?: string;
}
export interface Session {
  configPath: string;
  config: ResolvedWorkspaceConfig;
  plan: WorkspacePlan;
  diagnostics: Diagnostic[];
  valid: boolean;
}
export class ConfigError extends Error {
  constructor(public diagnostics: Diagnostic[]) {
    super(diagnostics.map((d) => d.message).join('\n'));
    this.name = 'ConfigError';
  }
}
/**
 * Runs `load` with anything the loaded code writes to stdout diverted to
 * stderr.
 *
 * Config files execute project code, and project code logs: a dynamic
 * `app.config.ts` that prints its build variant is ordinary. But `--json` is a
 * machine-readable contract on the same stream, so one `console.log` in a
 * user's config turns a CI-parseable result into a parse error. The output is
 * kept rather than swallowed — it belongs on stderr, where it cannot corrupt a
 * document.
 */
export function withQuietStdout<T>(load: () => T): T {
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ) =>
    process.stderr.write(
      chunk,
      encoding as BufferEncoding,
      callback,
    )) as typeof process.stdout.write;
  try {
    return load();
  } finally {
    process.stdout.write = write;
  }
}

/**
 * The directory the package manager treats as the workspace root, or the app
 * root when there is no workspace.
 *
 * Target sources are confined to this, not to the app: in a monorepo a target
 * legitimately lives in a sibling package, and the reason for the check is to
 * keep a config from reaching anywhere on the filesystem, not to keep it inside
 * one directory.
 */
export function findWorkspaceRoot(projectRoot: string): string {
  let dir = projectRoot;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { workspaces?: unknown };
        if (parsed.workspaces) {
          return dir;
        }
      } catch {
        // An unreadable manifest is not a workspace marker; keep walking.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return projectRoot;
    }
    dir = parent;
  }
}

/**
 * Expands `ios.targets` with the targets that describe themselves: package
 * entries that name a workspace package, and directories under `targetsRoot`
 * carrying a `target.config.*`.
 *
 * Both produce ordinary target specs with an explicit `source`, so validation,
 * planning and the generators see one shape and need no notion of where a
 * target came from.
 */
function expandTargets(projectRoot: string, config: WorkspaceConfig): ResolvedWorkspaceConfig {
  const declared = config.ios?.targets ?? [];
  const targetsRoot = config.ios?.targetsRoot ?? 'targets';
  // Resolved once: every reader checks against it before executing anything.
  const workspaceRoot = findWorkspaceRoot(projectRoot);
  const expanded: TargetSpec[] = [];
  const sources: string[] = [];
  for (const [index, entry] of declared.entries()) {
    // An inline target declares everything; `package` and `path` name a
    // directory that describes itself.
    if (!('package' in entry) && !('path' in entry)) {
      expanded.push(entry as TargetSpec);
      sources.push(`ios.targets[${index}]`);
      continue;
    }
    const {
      package: specifier,
      path: folder,
      ...overrides
    } = entry as {
      package?: string;
      path?: string;
    } & Record<string, unknown>;
    const { dir, spec } =
      specifier !== undefined
        ? readPackageTarget(projectRoot, specifier, workspaceRoot)
        : readPathTarget(projectRoot, folder as string, workspaceRoot);
    // The file's own directory is the source. Accepting a `source` here would
    // silently do nothing, which is the failure this package exists to avoid.
    if ('source' in spec) {
      throw new Error(
        `${path.join(path.relative(projectRoot, dir), 'target.config')} sets "source", which a self-describing target cannot: its own directory is the source. Remove it.`,
      );
    }
    expanded.push({
      ...spec,
      ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)),
      source: path.relative(projectRoot, dir) || '.',
    } as TargetSpec);
    sources.push(
      `${specifier ?? folder} (${path.join(path.relative(projectRoot, dir), 'target.config')})`,
    );
  }
  // A directory that describes itself is only added when nothing already
  // declares its name, so an inline entry stays authoritative and a config
  // never grows a duplicate target by having both.
  const claimed = new Set(expanded.map((target) => target.name));
  for (const found of discoverTargets(projectRoot, targetsRoot, workspaceRoot)) {
    if (claimed.has(String(found.spec.name))) {
      continue;
    }
    if ('source' in found.spec) {
      throw new Error(
        `${found.origin} sets "source", which a self-describing target cannot: its own directory is the source. Remove it.`,
      );
    }
    expanded.push({
      ...found.spec,
      source: path.relative(projectRoot, found.dir),
    } as unknown as TargetSpec);
    sources.push(found.origin);
  }
  // A config file read off disk has had no schema applied yet: the strict
  // object that rejects a typo in an inline target has to reject the same typo
  // in a target.config.js, or a discovered target reaches the generators as
  // whatever the file happened to export.
  const checked = expanded.map((target, index) => {
    const parsed = TargetSchema.safeParse(target);
    if (!parsed.success) {
      const origin = sources[index] ?? `ios.targets[${index}]`;
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'target'}: ${issue.message}`)
        .join('; ');
      throw new Error(`${origin} is not a valid target — ${detail}`);
    }
    return parsed.data;
  });
  const ios = config.ios ?? {};
  return { ...config, ios: { ...ios, targets: checked } } as ResolvedWorkspaceConfig;
}

export const configNames = [
  'workspace.config.ts',
  'workspace.config.js',
  'workspace.config.cjs',
  'workspace.config.mjs',
  'workspace.config.json',
];
/**
 * Fields this package deliberately does not own, and where they live instead.
 * An unrecognized-key error is accurate but unhelpful when the field exists —
 * somewhere else.
 */
const MOVED_FIELDS: Record<string, string> = {
  'android.permissions':
    ' Declare permissions in expo.android.permissions in your Expo app config; it writes the same manifest entries, and expo.android.blockedPermissions removes ones a dependency merges in.',
  'ios.appDelegate':
    ' Entry-point injection was removed. Run launch code from an ExpoAppDelegateSubscriber: expo-native-config init --template lifecycle-module.',
  'android.mainApplication':
    ' Entry-point injection was removed. Run launch code from an ApplicationLifecycleListener: expo-native-config init --template lifecycle-module.',
};

/** Names the new home of a field whose unrecognized key we recognize. */
function movedFieldHint(issue: { code: string; path: PropertyKey[]; keys?: string[] }): string {
  if (issue.code !== 'unrecognized_keys') {
    return '';
  }
  const prefix = issue.path.join('.');
  for (const key of issue.keys ?? []) {
    const hint = MOVED_FIELDS[prefix ? `${prefix}.${key}` : key];
    if (hint) {
      return hint;
    }
  }
  return '';
}

/** Empty unless this package is missing from the project the config belongs to. */
function installHint(projectRoot: string): string {
  try {
    createRequire(path.join(projectRoot, 'package.json')).resolve(
      'expo-native-config/package.json',
    );
    return '';
  } catch {
    return ' Install expo-native-config in this project first.';
  }
}

export function createSession(
  projectRoot: string,
  configPath?: string,
  appConfig?: WorkspaceAppConfig,
): Session {
  const resolved = configPath
    ? path.resolve(projectRoot, configPath)
    : configNames.map((n) => path.join(projectRoot, n)).find(fs.existsSync);
  if (!resolved || !fs.existsSync(resolved))
    throw new ConfigError([
      {
        severity: 'error',
        code: 'config.missing',
        message: 'Workspace config not found. Run expo-native-config init --yes.',
      },
    ]);
  let raw: unknown;
  try {
    if (resolved.endsWith('.json')) raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    else {
      const loader = jiti(__filename, {
        interopDefault: true,
        requireCache: false,
        alias: { 'expo-native-config': path.join(__dirname, 'index.js') },
      });
      raw = withQuietStdout(() => loader(resolved));
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // A config that imports this package before the package is installed fails
    // deep inside the module it could not load, with a message about the
    // failure rather than the cause. `init` tells people to install afterwards,
    // so this is a first-run path, not an exotic one.
    throw new ConfigError([
      {
        severity: 'error',
        code: 'config.load',
        message: `Cannot load ${resolved}: ${reason}${installHint(projectRoot)}`,
      },
    ]);
  }
  const parsed = WorkspaceSchema.safeParse(raw);
  if (!parsed.success)
    throw new ConfigError(
      parsed.error.issues.map((i) => {
        const source = i.path.join('.');
        return {
          severity: 'error' as const,
          code: 'config.schema',
          message: `${source || 'config'}: ${i.message}${movedFieldHint(i)}`,
          source,
        };
      }),
    );
  let expandedConfig: ResolvedWorkspaceConfig;
  try {
    expandedConfig = expandTargets(projectRoot, parsed.data);
  } catch (error) {
    throw new ConfigError([
      {
        severity: 'error',
        code: 'target.package',
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  }
  const config = expandedConfig;
  let app: WorkspaceAppConfig;
  try {
    app =
      appConfig ??
      (getConfig(projectRoot, { skipSDKVersionRequirement: true, skipPlugins: true })
        .exp as unknown as WorkspaceAppConfig);
  } catch (error) {
    throw new ConfigError([
      {
        severity: 'error',
        code: 'app.config',
        message: `Cannot load Expo config: ${error instanceof Error ? error.message : String(error)}`,
      },
    ]);
  }
  // Where a change belongs, as opposed to whether it parses. Collected before
  // the semantic checks so a config gets every complaint at once.
  const diagnostics: Diagnostic[] = collectGuidance(config, appDeploymentTarget(app).value);
  const add = (code: string, message: string, source?: string) =>
    diagnostics.push({ severity: 'error', code, message, source });
  const targets = config.ios?.targets ?? [];
  const names = new Set<string>();
  const ids = new Set<string>();
  const mainId = app.ios?.bundleIdentifier;
  if (mainId) ids.add(mainId);
  const mainGroups = app.ios?.entitlements?.['com.apple.security.application-groups'];
  for (const [i, target] of targets.entries()) {
    const source = `ios.targets[${i}]`;
    if (names.has(target.name))
      add('target.duplicate', `Duplicate target name ${target.name}`, source);
    names.add(target.name);
    const id = mainId
      ? resolveTargetBundleId(app, target)
      : (target.bundleIdentifier ?? target.type);
    if (!mainId)
      add('app.bundle-id', 'Set expo.ios.bundleIdentifier before adding native targets', source);
    if (ids.has(id)) add('target.bundle-id', `Duplicate bundle identifier ${id}`, source);
    ids.add(id);
    const dir = path.resolve(
      projectRoot,
      target.source ?? path.join(config.ios?.targetsRoot ?? 'targets', target.name),
    );
    const canonicalRoot = fs.realpathSync(findWorkspaceRoot(projectRoot));
    const canonicalDir = fs.existsSync(dir) ? fs.realpathSync(dir) : dir;
    const relative = path.relative(canonicalRoot, canonicalDir);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      add(
        'target.source',
        `Target source must stay inside the workspace (${canonicalRoot}): ${dir}`,
        source,
      );
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
      add('target.source', `Target source directory not found: ${dir}`, source);
    // @bacons/apple-targets and the predecessor of this package evaluated a
    // globbed pods.rb inside a `target … do` block. This package takes the same
    // dependencies as a typed field instead, and never reads the file — so a
    // project arriving with one would lose its extension's pods to a link
    // error with nothing pointing at the cause.
    else if (fs.existsSync(path.join(dir, 'pods.rb')))
      diagnostics.push({
        severity: 'warning',
        code: 'target.pods-rb',
        source,
        message: `${target.name} has a pods.rb, which this package does not read. Declare those pods in ${source}.pods and delete the file.`,
      });
    const groups = target.entitlements?.['com.apple.security.application-groups'];
    if (Array.isArray(groups))
      for (const group of groups) {
        if (!Array.isArray(mainGroups) || !mainGroups.includes(group))
          add(
            'target.app-group',
            `App Group ${String(group)} on ${target.name} is missing from expo.ios.entitlements`,
            source,
          );
      }
  }
  const schemeNames = new Set<string>();
  for (const s of config.ios?.schemes ?? []) {
    if (schemeNames.has(s.name)) add('scheme.duplicate', `Duplicate scheme ${s.name}`);
    schemeNames.add(s.name);
  }
  for (const [i, pkg] of (config.ios?.packages ?? []).entries()) {
    const refs = pkg.target ? (Array.isArray(pkg.target) ? pkg.target : [pkg.target]) : [];
    for (const ref of refs)
      if (!names.has(ref) && ref !== IOSConfig.XcodeUtils.sanitizedName(app.name ?? 'app'))
        add(
          'package.target',
          `Unknown Swift package target ${ref}; omit target for the main app`,
          `ios.packages[${i}]`,
        );
    if ('path' in pkg && !fs.existsSync(path.resolve(projectRoot, 'ios', pkg.path)))
      add('package.path', `Local Swift package not found: ${pkg.path}`, `ios.packages[${i}]`);
  }
  const android = config.android;
  if (
    android?.minSdkVersion &&
    android.targetSdkVersion &&
    android.minSdkVersion > android.targetSdkVersion
  )
    add('android.sdk', 'minSdkVersion cannot exceed targetSdkVersion');
  if (
    android?.targetSdkVersion &&
    android.compileSdkVersion &&
    android.targetSdkVersion > android.compileSdkVersion
  )
    add('android.sdk', 'targetSdkVersion cannot exceed compileSdkVersion');
  for (const [key, value] of Object.entries(android?.signing ?? {})) {
    if (typeof value === 'object' && value && 'env' in value && !process.env[value.env])
      diagnostics.push({
        severity: 'warning',
        code: 'signing.env',
        message: `${key} needs environment variable ${value.env} during prebuild`,
      });
  }
  if (diagnostics.some((d) => d.severity === 'error')) throw new ConfigError(diagnostics);
  let plan: WorkspacePlan;
  try {
    plan = collect(config, projectRoot, app);
  } catch (error) {
    throw new ConfigError([
      {
        severity: 'error',
        code: 'config.intent',
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  }
  plan.configPath = resolved;
  for (const warning of plan.warnings)
    diagnostics.push({ severity: 'warning', code: 'plan.warning', message: warning });
  return { configPath: resolved, config, plan, diagnostics, valid: true };
}
