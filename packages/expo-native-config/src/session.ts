import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { IOSConfig } from '@expo/config-plugins';
import { getConfig } from '@expo/config';
import jiti from 'jiti';
import { resolveTargetBundleId } from './engine/ios-targets/bundleId';
import { WorkspaceSchema, type WorkspaceConfig } from './schema';
import { collect, type WorkspaceAppConfig, type WorkspacePlan } from './engine';
export interface Diagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  source?: string;
}
export interface Session {
  configPath: string;
  config: WorkspaceConfig;
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
export const configNames = [
  'workspace.config.ts',
  'workspace.config.js',
  'workspace.config.cjs',
  'workspace.config.mjs',
  'workspace.config.json',
];
/** Empty unless this package is missing from the project the config belongs to. */
function installHint(projectRoot: string): string {
  try {
    createRequire(path.join(projectRoot, 'package.json')).resolve('expo-native-config/package.json');
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
      raw = loader(resolved);
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
      parsed.error.issues.map((i) => ({
        severity: 'error',
        code: 'config.schema',
        message: `${i.path.join('.') || 'config'}: ${i.message}`,
        source: i.path.join('.'),
      })),
    );
  const config = parsed.data;
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
  const diagnostics: Diagnostic[] = [];
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
    const canonicalRoot = fs.realpathSync(projectRoot);
    const canonicalDir = fs.existsSync(dir) ? fs.realpathSync(dir) : dir;
    const relative = path.relative(canonicalRoot, canonicalDir);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      add('target.source', `Target source must stay inside the project: ${dir}`, source);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
      add('target.source', `Target source directory not found: ${dir}`, source);
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
