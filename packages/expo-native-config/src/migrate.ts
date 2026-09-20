import fs from 'node:fs';
import path from 'node:path';
import { getConfigFilePaths } from '@expo/config';
import jiti from 'jiti';
import { ConfigError, configNames, withQuietStdout } from './session';
import { WorkspaceSchema } from './schema';

/**
 * What happened to one thing migrate found. `extracted` is the only status
 * that changes the emitted manifest; the rest exist so the report says what
 * was deliberately left alone, and why.
 */
export interface MigrationFinding {
  /** Where it was read from: a file, or a plugins[] index. */
  source: string;
  status: 'extracted' | 'owned-elsewhere' | 'manual' | 'already-declared';
  /** The workspace field it became, when it became one. */
  field?: string;
  message: string;
}

export interface MigrationResult {
  /** The synthesized manifest, already validated against the schema. */
  config: Record<string, unknown>;
  /** `workspace.config.ts` source for that manifest. */
  source: string;
  findings: MigrationFinding[];
  /** Files written. Empty for a dry run. */
  written: string[];
}

/** Reads a file, or undefined when it is absent. Migration inputs are optional. */
function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Gradle properties the Expo template, React Native or a first-party plugin
 * writes. Extracting these would re-declare a value its real owner still
 * writes, and the two can then disagree — the same failure `guidance.ts` warns
 * about for a hand-written manifest.
 */
const OWNED_GRADLE_PROPERTIES: Array<[RegExp, string]> = [
  [/^org\.gradle\./i, 'the Gradle template'],
  [/^android\.(useAndroidX|enableJetifier|enableR8)/i, 'the Android template'],
  [/^(newArchEnabled|hermesEnabled|expo\.jsEngine)$/i, 'the Expo config'],
  [/^reactNativeArchitectures$/i, 'android.abiFilters in this package'],
  [/^expo\.(useLegacyPackaging|edgeToEdgeEnabled|gif|webp)/i, 'expo-build-properties'],
  [
    /^android\.(enableProguardInReleaseBuilds|enableShrinkResourcesInReleaseBuilds)$/i,
    'expo-build-properties',
  ],
  [/^EX_DEV_/i, 'the Expo dev client'],
];

/**
 * Manifest meta-data keys the generated project already carries. Everything
 * else in `<application>` is app- or library-owned and worth declaring.
 */
const GENERATED_META_DATA = [
  /^expo\./i,
  /^com\.facebook\./i,
  /^org\.unimodules\./i,
  /^android\.max_aspect$/i,
];

/**
 * Expo mods a hand-written plugin uses, and the workspace field that expresses
 * the same change. This does not translate the plugin: it names the field to
 * write by hand, because the plugin body is arbitrary JavaScript.
 */
const MOD_FIELDS: Array<[RegExp, string]> = [
  // Ordered by how specific the answer is: the first match becomes the headline
  // field, and the entry-point rule is the one with a definitive answer, so it
  // must outrank the generic withDangerousMod hint that also matches it.
  // Matches the mod AND the file it targets: patching AppDelegate.swift
  // through withDangerousMod is the common shape, and naming the generic
  // dangerous-mod field for it would bury the one answer that matters. This is
  // the same rule `guidance.ts` enforces on escape hatches.
  [
    /withMainApplication|withMainActivity|withAppDelegate|AppDelegate|MainApplication|MainActivity\.(kt|java)/,
    'a local Expo module (init --template lifecycle-module) — this package does not edit entry points',
  ],
  [/withPodfileProperties/, 'ios.podfileProperties'],
  [/withPodfile\b/, 'ios.pods, ios.podBuildSettings or ios.podfile'],
  [/withDangerousMod/, 'the typed field for that file, or an escape hatch'],
  [/withXcodeProject/, 'ios.targets, ios.buildSettings, ios.runScripts or ios.schemes'],
  [/withEntitlementsPlist/, 'ios.targets[].entitlements'],
  [/withInfoPlist/, 'expo.ios.infoPlist in the Expo config'],
  [/withAppBuildGradle/, 'android.dependencies, android.defaultConfig or android.gradle.app'],
  [/withProjectBuildGradle/, 'android.repositories or android.buildscriptDependencies'],
  [/withSettingsGradle/, 'android.modules'],
  [/withGradleProperties/, 'android.gradleProperties'],
  [/withAndroidManifest/, 'android.components, android.metaData or android.applicationAttributes'],
  [/withStringsXml/, 'android.strings'],
  [/withAndroidColors/, 'android.colors'],
  [/withAndroidStyles/, 'android.styles'],
];

/** True for a plugins[] entry that names a file in this project rather than a package. */
function isLocalPlugin(name: string): boolean {
  return name.startsWith('.') || name.startsWith('/');
}

/** Resolves a local plugin entry to a readable file, trying the usual extensions. */
function resolveLocalPlugin(projectRoot: string, name: string): string | undefined {
  const base = path.resolve(projectRoot, name);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.js`,
    `${base}.tsx`,
    `${base}.cjs`,
    `${base}.mjs`,
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  const index = ['index.ts', 'index.js', 'index.cjs', 'index.mjs'].map((f) => path.join(base, f));
  return index.find((candidate) => fs.existsSync(candidate));
}

/**
 * The plugins array, read without running any plugin.
 *
 * `getConfig` is not usable here: `skipPlugins` removes the array, and without
 * it the plugins are resolved and executed — which fails on the half-migrated
 * projects this command exists for, and runs third-party code to answer a
 * question about text. A static config is parsed; a dynamic one is loaded the
 * way `workspace.config.ts` is, and falls back to scanning its source.
 */
function readPluginEntries(
  projectRoot: string,
  findings: MigrationFinding[],
): { entries: unknown[]; scanned: boolean } {
  const { staticConfigPath, dynamicConfigPath } = getConfigFilePaths(projectRoot);
  if (staticConfigPath) {
    try {
      const raw = JSON.parse(read(staticConfigPath) ?? '{}') as Record<string, unknown>;
      const expo = (raw.expo ?? raw) as Record<string, unknown>;
      return { entries: (expo.plugins as unknown[]) ?? [], scanned: false };
    } catch (error) {
      findings.push({
        source: path.basename(staticConfigPath),
        status: 'manual',
        message: `Could not parse the Expo config: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return { entries: [], scanned: false };
    }
  }
  if (!dynamicConfigPath) {
    findings.push({
      source: 'project',
      status: 'manual',
      message: 'No Expo config found, so no plugins were analyzed.',
    });
    return { entries: [], scanned: false };
  }
  try {
    const loader = jiti(__filename, { interopDefault: true, requireCache: false });
    // Both the load AND the call have to be inside the guard: a dynamic config
    // usually exports a function, and the logging happens when it runs.
    const resolved = withQuietStdout(() => {
      const loaded = loader(dynamicConfigPath) as unknown;
      return typeof loaded === 'function'
        ? (loaded as (context: { config: object }) => { plugins?: unknown[] })({ config: {} })
        : (loaded as { expo?: { plugins?: unknown[] }; plugins?: unknown[] });
    });
    const entries =
      (resolved as { plugins?: unknown[] })?.plugins ??
      (resolved as { expo?: { plugins?: unknown[] } })?.expo?.plugins ??
      [];
    return { entries, scanned: false };
  } catch {
    // A dynamic config that cannot be evaluated standalone is normal: it may
    // read env vars or call getConfig itself. Scanning its source still finds
    // the local plugin paths, which is the part worth reporting.
    const source = read(dynamicConfigPath) ?? '';
    // Every relative path literal is a candidate, then kept only if it resolves
    // to a file that imports config-plugins. Matching on "plugin" in the path
    // was narrower but silently dropped a plugin living anywhere else, and a
    // migration report that omits a plugin without saying so is worse than a
    // noisy one.
    const entries = [...source.matchAll(/['"`](\.[^'"`\n]+)['"`]/g)]
      .map((match) => match[1])
      .filter((candidate, index, all) => all.indexOf(candidate) === index)
      .filter((candidate) => {
        const file = resolveLocalPlugin(projectRoot, candidate);
        return file ? /['"`](?:@expo\/|expo\/)config-plugins['"`]/.test(read(file) ?? '') : false;
      });
    findings.push({
      source: path.basename(dynamicConfigPath),
      status: 'manual',
      message: `Could not evaluate this dynamic config, so its plugins array was scanned as text. Confirm the list by hand${
        entries.length ? `; ${entries.length} local plugin path(s) matched` : ''
      }.`,
    });
    return { entries, scanned: true };
  }
}

/** Classifies each entry in the Expo config's plugins array. */
function readPlugins(projectRoot: string, findings: MigrationFinding[]): void {
  const { entries: plugins, scanned } = readPluginEntries(projectRoot, findings);
  for (const [index, entry] of plugins.entries()) {
    const name = typeof entry === 'string' ? entry : Array.isArray(entry) ? entry[0] : undefined;
    const source = scanned ? 'Expo config (scanned)' : `Expo config plugins[${index}]`;
    if (typeof name !== 'string') {
      findings.push({
        source,
        status: 'manual',
        message: 'Plugin entry is not a name this command can read; inspect it by hand.',
      });
      continue;
    }
    if (name === 'expo-native-config/plugin' || name === 'expo-native-config') {
      findings.push({
        source,
        status: 'already-declared',
        message: 'This package is already registered. Keep it last in the array.',
      });
      continue;
    }
    if (!isLocalPlugin(name)) {
      findings.push({
        source,
        status: 'owned-elsewhere',
        message: `${name} is a published plugin and keeps owning its own changes. Leave it registered.`,
      });
      continue;
    }
    const file = resolveLocalPlugin(projectRoot, name);
    if (!file) {
      findings.push({
        source,
        status: 'manual',
        message: `${name} is a local plugin this command could not resolve to a file.`,
      });
      continue;
    }
    const contents = read(file) ?? '';
    const relative = path.relative(projectRoot, file);
    const fields = MOD_FIELDS.filter(([pattern]) => pattern.test(contents)).map(
      ([, field]) => field,
    );
    findings.push({
      source: `${source} (${relative})`,
      status: 'manual',
      field: fields[0],
      message: fields.length
        ? `Uses ${fields.length === 1 ? 'a mod' : 'mods'} this package can express. Rewrite it as ${fields.join(', ')}, then remove the plugin entry. The plugin body is JavaScript, so this command will not translate it for you.`
        : 'No recognized Expo mod. Read it and decide whether a typed field covers it.',
    });
  }
}

/**
 * Literal `pod` lines in a generated Podfile. Autolinked pods arrive through
 * `use_expo_modules!`, so a literal line was added by an app or a plugin.
 */
function readPodfile(
  projectRoot: string,
  ios: Record<string, unknown>,
  findings: MigrationFinding[],
): void {
  const file = path.join(projectRoot, 'ios', 'Podfile');
  const contents = read(file);
  if (contents === undefined) {
    return;
  }
  const pods: Array<Record<string, unknown>> = [];
  for (const line of contents.split('\n')) {
    const match = /^\s*pod\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const [, name, version] = match;
    pods.push(version ? { pod: name, version } : { pod: name });
    findings.push({
      source: 'ios/Podfile',
      status: 'extracted',
      field: 'ios.pods',
      message: `pod "${name}"${version ? ` (${version})` : ''}`,
    });
  }
  if (pods.length) {
    ios.pods = pods;
  }
  if (/post_install do \|installer\|/.test(contents)) {
    findings.push({
      source: 'ios/Podfile',
      status: 'manual',
      field: 'ios.podBuildSettings',
      message:
        'A post_install hook is present. Most of what lives there is a build setting: prefer ios.podBuildSettings, and keep ios.podfile.postInstall for what it cannot express — it is an escape hatch.',
    });
  }
}

/** Gradle properties the app added, minus the ones a template or plugin owns. */
function readGradleProperties(
  projectRoot: string,
  android: Record<string, unknown>,
  findings: MigrationFinding[],
): void {
  const contents = read(path.join(projectRoot, 'android', 'gradle.properties'));
  if (contents === undefined) {
    return;
  }
  const properties: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const match = /^([A-Za-z][\w.]*)\s*=\s*(.*)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    const owner = OWNED_GRADLE_PROPERTIES.find(([pattern]) => pattern.test(key));
    if (owner) {
      findings.push({
        source: `android/gradle.properties (${key})`,
        status: 'owned-elsewhere',
        message: `${key} is written by ${owner[1]}. Declaring it again would duplicate a value its owner still writes.`,
      });
      continue;
    }
    properties[key] = value.trim();
    findings.push({
      source: `android/gradle.properties (${key})`,
      status: 'extracted',
      field: 'android.gradleProperties',
      message: `${key}=${value.trim()}`,
    });
  }
  if (Object.keys(properties).length) {
    android.gradleProperties = properties;
  }
}

/** Coordinate dependencies and local module dependencies from app/build.gradle. */
function readAppBuildGradle(
  projectRoot: string,
  android: Record<string, unknown>,
  findings: MigrationFinding[],
): void {
  const contents = read(path.join(projectRoot, 'android', 'app', 'build.gradle'));
  if (contents === undefined) {
    return;
  }
  const dependencies: Array<Record<string, unknown>> = [];
  for (const line of contents.split('\n')) {
    const coordinate =
      /^\s*(implementation|api|compileOnly|runtimeOnly)\s+['"]([\w.-]+:[\w.-]+:[^'"]+)['"]/.exec(
        line,
      );
    if (coordinate) {
      const [, configuration, value] = coordinate;
      if (/^com\.facebook\.react:|^androidx\.swiperefreshlayout:/.test(value)) {
        findings.push({
          source: 'android/app/build.gradle',
          status: 'owned-elsewhere',
          message: `${value} comes from the React Native template.`,
        });
        continue;
      }
      dependencies.push(
        configuration === 'implementation' ? { module: value } : { module: value, configuration },
      );
      findings.push({
        source: 'android/app/build.gradle',
        status: 'extracted',
        field: 'android.dependencies',
        message: `${configuration} ${value}`,
      });
      continue;
    }
    const project = /^\s*(implementation|api)\s+project\(['"]:([\w.-]+)['"]\)/.exec(line);
    if (project) {
      const [, , name] = project;
      if (/^expo/.test(name)) {
        continue;
      }
      dependencies.push({ project: name });
      findings.push({
        source: 'android/app/build.gradle',
        status: 'extracted',
        field: 'android.dependencies',
        message: `project(":${name}") — declare its path in android.modules as well`,
      });
    }
  }
  if (dependencies.length) {
    android.dependencies = dependencies;
  }
  const abi = /abiFilters\s+([^\n}]+)/.exec(contents);
  if (abi) {
    findings.push({
      source: 'android/app/build.gradle',
      status: 'manual',
      field: 'android.abiFilters',
      message: `abiFilters ${abi[1].trim()} — declare it as android.abiFilters so reactNativeArchitectures stays in step.`,
    });
  }
}

/**
 * Manifest entries that survive a regenerate only if something declares them.
 * `uses-feature`, `queries` and app-owned meta-data are read; components are
 * reported rather than extracted, because telling an app's own activity from a
 * generated one needs a person.
 */
function readAndroidManifest(
  projectRoot: string,
  android: Record<string, unknown>,
  findings: MigrationFinding[],
): void {
  const file = path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const contents = read(file);
  if (contents === undefined) {
    return;
  }
  const features: Array<Record<string, unknown>> = [];
  for (const match of contents.matchAll(/<uses-feature\s([^>]*)\/?>/g)) {
    const attributes = match[1];
    const name = /android:name="([^"]+)"/.exec(attributes)?.[1];
    if (!name) {
      continue;
    }
    const required = /android:required="([^"]+)"/.exec(attributes)?.[1] !== 'false';
    features.push({ name, required });
    findings.push({
      source: 'android/.../AndroidManifest.xml',
      status: 'extracted',
      field: 'android.features',
      message: `uses-feature ${name}${required ? '' : ' (optional)'}`,
    });
  }
  if (features.length) {
    android.features = features;
  }
  const metaData: Record<string, string> = {};
  for (const match of contents.matchAll(/<meta-data\s([^>]*)\/?>/g)) {
    const attributes = match[1];
    const name = /android:name="([^"]+)"/.exec(attributes)?.[1];
    const value = /android:value="([^"]+)"/.exec(attributes)?.[1];
    if (!name || value === undefined) {
      continue;
    }
    if (GENERATED_META_DATA.some((pattern) => pattern.test(name))) {
      continue;
    }
    metaData[name] = value;
    findings.push({
      source: 'android/.../AndroidManifest.xml',
      status: 'extracted',
      field: 'android.metaData',
      message: `meta-data ${name}`,
    });
  }
  if (Object.keys(metaData).length) {
    android.metaData = metaData;
  }
  if (/<queries>/.test(contents)) {
    findings.push({
      source: 'android/.../AndroidManifest.xml',
      status: 'manual',
      field: 'android.queries',
      message:
        'A <queries> block is present. Declare the intents and packages your app resolves in android.queries; this command does not guess which ones a library contributed.',
    });
  }
  if (/android:name="\.MainActivity"/.test(contents)) {
    findings.push({
      source: 'android/.../AndroidManifest.xml',
      status: 'owned-elsewhere',
      message:
        'MainActivity and the rest of the generated application element stay owned by Expo. Declare only attributes you changed, in android.applicationAttributes.',
    });
  }
}

/** Renders a manifest as `workspace.config.ts`. */
function render(config: Record<string, unknown>): string {
  return [
    "import { defineWorkspace } from 'expo-native-config';",
    '',
    '// Generated by expo-native-config migrate. Review every field before',
    '// prebuilding: extraction is a starting point, not a proof of intent.',
    `export default defineWorkspace(${JSON.stringify(config, null, 2)});`,
    '',
  ].join('\n');
}

/**
 * Reads an existing project and proposes a workspace manifest for it.
 *
 * Extraction is deliberately conservative. Anything an Expo template, a
 * published plugin or the Expo config already owns is reported and skipped, so
 * migrating does not create a second writer for a value that already has one.
 */
export function analyze(projectRoot: string): MigrationResult {
  const findings: MigrationFinding[] = [];
  const ios: Record<string, unknown> = {};
  const android: Record<string, unknown> = {};
  readPlugins(projectRoot, findings);
  readPodfile(projectRoot, ios, findings);
  readGradleProperties(projectRoot, android, findings);
  readAppBuildGradle(projectRoot, android, findings);
  readAndroidManifest(projectRoot, android, findings);
  if (
    !fs.existsSync(path.join(projectRoot, 'ios')) &&
    !fs.existsSync(path.join(projectRoot, 'android'))
  ) {
    findings.push({
      source: 'project',
      status: 'manual',
      message:
        'No ios/ or android/ directory, so only the Expo config was read. Run this after a prebuild if you want native state considered.',
    });
  }
  const config: Record<string, unknown> = { schemaVersion: 1 };
  if (Object.keys(ios).length) {
    config.ios = ios;
  }
  if (Object.keys(android).length) {
    config.android = android;
  }
  // A manifest this command cannot validate is a bug in this command, not
  // input to fix by hand, so it fails here rather than at the user's prebuild.
  const parsed = WorkspaceSchema.safeParse(config);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => ({
        severity: 'error' as const,
        code: 'migrate.invalid',
        message: `migrate produced an invalid manifest at ${issue.path.join('.') || 'config'}: ${issue.message}. Please report this with the project it came from.`,
      })),
    );
  }
  return { config, source: render(config), findings, written: [] };
}

/** Analyzes, then writes `workspace.config.ts` unless `dryRun` is set. */
export function migrate(projectRoot: string, options: { dryRun?: boolean } = {}): MigrationResult {
  const result = analyze(projectRoot);
  if (options.dryRun) {
    return result;
  }
  for (const name of configNames) {
    if (fs.existsSync(path.join(projectRoot, name))) {
      throw new ConfigError([
        {
          severity: 'error',
          code: 'migrate.exists',
          message: `Refusing to shadow existing ${name}. Run with --dry-run and merge the proposal by hand.`,
        },
      ]);
    }
  }
  const destination = path.join(projectRoot, 'workspace.config.ts');
  fs.writeFileSync(destination, result.source, { flag: 'wx' });
  return { ...result, written: ['workspace.config.ts'] };
}
