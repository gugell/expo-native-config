import { z } from 'zod';

const text = z.string().trim().min(1);
const safeName = text.regex(
  /^[A-Za-z][A-Za-z0-9_-]*$/,
  'Use a letter followed by letters, numbers, underscores or hyphens',
);
const version = text.regex(/^\d+\.\d+(\.\d+)?$/, 'Expected a dotted version');
const targetRef = z.union([text, z.array(text).min(1)]);
const values = z.record(z.string(), z.unknown());
const settings = z.record(z.string(), z.string());
export const PodSchema = z.strictObject({
  pod: text,
  path: text.optional(),
  version: text.optional(),
  git: z.url().optional(),
  branch: text.optional(),
  tag: text.optional(),
  commit: text.optional(),
  configurations: z.array(z.enum(['Debug', 'Release'])).optional(),
  modularHeaders: z.boolean().optional(),
});
export const TargetSchema = z.strictObject({
  name: safeName,
  type: z.enum([
    'share',
    'widget',
    'clip',
    'notification-service',
    'notification-content',
    'intent',
    'action',
    'safari',
  ]),
  bundleIdentifier: text.optional(),
  deploymentTarget: version.optional(),
  entitlements: values.optional(),
  frameworks: z.array(text).optional(),
  source: text.optional(),
  buildSettings: settings.optional(),
  pods: z.array(PodSchema).optional(),
});
export const RequirementSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('upToNextMajorVersion'), minimumVersion: version }),
  z.strictObject({ kind: z.literal('upToNextMinorVersion'), minimumVersion: version }),
  z.strictObject({
    kind: z.literal('versionRange'),
    minimumVersion: version,
    maximumVersion: version,
  }),
  z.strictObject({ kind: z.literal('exactVersion'), version }),
  z.strictObject({ kind: z.literal('branch'), branch: text }),
  z.strictObject({ kind: z.literal('revision'), revision: text }),
]);
const packageCommon = {
  products: z.array(text).min(1),
  target: targetRef.optional(),
  podTarget: targetRef.optional(),
};
export const RemotePackageSchema = z.strictObject({
  url: z.url(),
  requirement: RequirementSchema,
  ...packageCommon,
});
export const LocalPackageSchema = z.strictObject({ path: text, ...packageCommon });
export const SchemeSchema = z.strictObject({
  name: text.regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/, 'Use a safe scheme filename'),
  configuration: z.enum(['Debug', 'Release']),
  archive: z.enum(['Debug', 'Release']).optional(),
  analyze: z.enum(['Debug', 'Release']).optional(),
  includeUnitTestTarget: z.boolean().optional(),
});
const gradleConfiguration = z.enum([
  'implementation',
  'api',
  'compileOnly',
  'runtimeOnly',
  'debugImplementation',
  'releaseImplementation',
  'androidTestImplementation',
  'testImplementation',
]);
const dependencyExclude = z.strictObject({ group: text, module: text.optional() });
export const AndroidDependencySchema = z.union([
  z.strictObject({
    module: text.regex(/^[^\s:'"\\]+:[^\s:'"\\]+:[^\s'"\\]+$/, 'Expected group:artifact:version'),
    configuration: gradleConfiguration.optional(),
    exclude: z.array(dependencyExclude).optional(),
  }),
  z.strictObject({
    /** Gradle project path without the leading colon, e.g. "watermelondb-jsi". */
    project: text.regex(/^[A-Za-z0-9._-]+$/, 'Expected a Gradle project name'),
    configuration: gradleConfiguration.optional(),
  }),
  z.strictObject({
    /** BOM coordinate rendered as `implementation platform('…')`. */
    platform: text.regex(/^[^\s:'"\\]+:[^\s:'"\\]+:[^\s'"\\]+$/, 'Expected group:artifact:version'),
    configuration: gradleConfiguration.optional(),
  }),
]);
export const AndroidFeatureSchema = z.strictObject({
  name: text,
  required: z.boolean().optional(),
  glEsVersion: text.optional(),
});
export const AndroidQueriesSchema = z.strictObject({
  intents: z
    .array(z.strictObject({ action: text, scheme: text.regex(/^[A-Za-z][A-Za-z0-9+.-]*$/) }))
    .optional(),
  packages: z.array(text.regex(/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/)).optional(),
});
const env = z.strictObject({ env: text.regex(/^[A-Za-z_][A-Za-z0-9_]*$/) });
export const PodTargetMatcherSchema = z.union([
  text,
  z
    .strictObject({ equals: text.optional(), startsWith: text.optional(), regex: text.optional() })
    .refine((value) => Object.values(value).some(Boolean), 'Provide a target matcher'),
]);
export const PodBuildSettingsSchema = z.strictObject({
  target: PodTargetMatcherSchema,
  settings: z
    .record(text, z.string())
    .refine((value) => Object.keys(value).length > 0, 'Provide build settings'),
  configurations: z
    .array(z.enum(['Debug', 'Release']))
    .min(1)
    .optional(),
});
export const PodRemoveBuildPhaseSchema = z.strictObject({
  target: PodTargetMatcherSchema,
  phase: text,
});

const regexSource = text.max(500);
export const ReplaceRuleSchema = z.strictObject({
  find: regexSource,
  replacement: z.string(),
  all: z.boolean().optional(),
  /** Skip when the file already contains this marker (for non-idempotent patterns). */
  skipIfContains: text.optional(),
  /** Fail the build when the pattern matches nothing. */
  required: z.boolean().optional(),
});
export const PodfileEscapeHatchSchema = z.strictObject({
  postInstall: z.array(text).optional(),
  lines: z.array(text).optional(),
  replace: z.array(ReplaceRuleSchema).optional(),
});
export const RunScriptSchema = z.strictObject({
  name: text,
  script: text,
  shell: text.optional(),
  inputPaths: z.array(text).optional(),
  outputPaths: z.array(text).optional(),
  inputFileListPaths: z.array(text).optional(),
  outputFileListPaths: z.array(text).optional(),
  runOnlyForDeploymentPostprocessing: z.boolean().optional(),
  alwaysOutOfDate: z.boolean().optional(),
});
export const AppDelegateSchema = z.strictObject({
  imports: z.array(text).optional(),
  didFinishLaunching: z.array(text).optional(),
});
export const MainApplicationSchema = z.strictObject({
  imports: z.array(text).optional(),
  onCreate: z.array(text).optional(),
});
const gradleCoordinate = text.regex(
  /^[^\s:'"\\]+:[^\s:'"\\]+:[^\s'"\\]+$/,
  'Expected group:artifact:version',
);
export const MavenRepositorySchema = z.union([
  z.url(),
  z.strictObject({
    url: z.url(),
    credentials: z.strictObject({ username: env, password: env }).optional(),
    /** Restrict the repository to these groups (Gradle `content { includeGroup }`). */
    includeGroups: z.array(text).optional(),
  }),
]);
export const AndroidComponentSchema = z.strictObject({
  kind: z.enum(['activity', 'service', 'receiver', 'provider']),
  name: text,
  attributes: settings.optional(),
  /** Emit `tools:node="remove"` instead of merging attributes. */
  remove: z.boolean().optional(),
});
export const BuildConfigFieldSchema = z.strictObject({
  type: text,
  name: text.regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Expected a Java identifier'),
  /** Literal Gradle value, already quoted when the field type is String. */
  value: text,
});
export const AndroidStyleSchema = z.strictObject({
  name: text,
  parent: text.optional(),
  items: z.record(text, z.string()).refine((v) => Object.keys(v).length > 0, 'Provide style items'),
  targetApi: text.optional(),
});
export const AndroidResourceFileSchema = z.strictObject({
  /** Path under android/app/src/main/res, e.g. "xml/network_security_config.xml". */
  path: text.regex(/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/, 'Expected a relative res path'),
  contents: z.string(),
  overwrite: z.enum(['always', 'ifAbsent']).optional(),
});
export const AndroidModuleSchema = z.strictObject({
  /** Gradle project name without the leading colon, e.g. "watermelondb-jsi". */
  name: text.regex(/^[A-Za-z0-9._-]+$/, 'Expected a Gradle project name'),
  /** Project directory, resolved from the Expo app root. */
  path: text,
});
export const GradleEscapeHatchSchema = z.strictObject({
  app: z.array(ReplaceRuleSchema).optional(),
  project: z.array(ReplaceRuleSchema).optional(),
  settings: z.array(ReplaceRuleSchema).optional(),
});

export const WorkspaceSchema = z.strictObject({
  schemaVersion: z.literal(1).default(1),
  ios: z
    .strictObject({
      deploymentTarget: version.optional(),
      minimumPodDeploymentTarget: version.optional(),
      podfileGlobals: z
        .record(
          z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
          z.union([z.boolean(), z.string(), z.number().finite()]),
        )
        .optional(),
      targetsRoot: text.optional(),
      targets: z.array(TargetSchema).optional(),
      buildSettings: settings.optional(),
      runScripts: z.array(RunScriptSchema).optional(),
      resources: z.array(text).optional(),
      appDelegate: AppDelegateSchema.optional(),
      autolinkingExclude: z.array(text).optional(),
      podfileProperties: settings.optional(),
      podfile: PodfileEscapeHatchSchema.optional(),
      packages: z.array(z.union([RemotePackageSchema, LocalPackageSchema])).optional(),
      pods: z.array(PodSchema).optional(),
      podBuildSettings: z.array(PodBuildSettingsSchema).optional(),
      removePodBuildPhases: z.array(PodRemoveBuildPhaseSchema).optional(),
      schemes: z.array(SchemeSchema).optional(),
      replaceExpoScheme: z.boolean().optional(),
      fixExtensionEmbedCycle: z.boolean().optional(),
      xcode: z
        .strictObject({
          env: z
            .strictObject({ exports: settings.optional(), lines: z.array(text).optional() })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  android: z
    .strictObject({
      minSdkVersion: z.number().int().min(24).optional(),
      compileSdkVersion: z.number().int().positive().optional(),
      targetSdkVersion: z.number().int().positive().optional(),
      buildToolsVersion: version.optional(),
      ndkVersion: version.optional(),
      kotlinVersion: version.optional(),
      gradleProperties: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
      permissions: z.array(text).optional(),
      queries: AndroidQueriesSchema.optional(),
      lint: z
        .strictObject({
          checkReleaseBuilds: z.boolean().optional(),
          abortOnError: z.boolean().optional(),
        })
        .optional(),
      features: z.array(z.union([text, AndroidFeatureSchema])).optional(),
      dependencies: z.array(AndroidDependencySchema).optional(),
      applicationAttributes: settings.optional(),
      metaData: settings.optional(),
      components: z.array(AndroidComponentSchema).optional(),
      supportsScreens: z.record(z.string(), z.boolean()).optional(),
      manifestPlaceholders: settings.optional(),
      buildConfigFields: z.array(BuildConfigFieldSchema).optional(),
      abiFilters: z.array(text).min(1).optional(),
      mavenRepositories: z.array(MavenRepositorySchema).optional(),
      flatDirs: z.array(text).optional(),
      buildscriptDependencies: z.array(gradleCoordinate).optional(),
      plugins: z.array(text).optional(),
      forceDependencies: z.array(gradleCoordinate).optional(),
      modules: z.array(AndroidModuleSchema).optional(),
      autolinkingExclude: z.array(text).optional(),
      mainApplication: MainApplicationSchema.optional(),
      strings: settings.optional(),
      colors: settings.optional(),
      styles: z.array(AndroidStyleSchema).optional(),
      resources: z.array(AndroidResourceFileSchema).optional(),
      gradle: GradleEscapeHatchSchema.optional(),
      signing: z
        .union([
          z.strictObject({ storeFile: text, keyAlias: text, storePassword: env, keyPassword: env }),
          z.strictObject({ propertiesFile: text, optional: z.boolean().optional() }),
        ])
        .optional(),
    })
    .optional(),
});
export type WorkspaceConfig = z.input<typeof WorkspaceSchema>;
export type ReplaceRule = z.infer<typeof ReplaceRuleSchema>;
export type RunScript = z.infer<typeof RunScriptSchema>;
export type AndroidComponent = z.infer<typeof AndroidComponentSchema>;
export type MavenRepository = z.infer<typeof MavenRepositorySchema>;
export type AndroidModule = z.infer<typeof AndroidModuleSchema>;
export type BuildConfigField = z.infer<typeof BuildConfigFieldSchema>;
export type PodBuildSettings = z.infer<typeof PodBuildSettingsSchema>;
export type PodRemoveBuildPhase = z.infer<typeof PodRemoveBuildPhaseSchema>;
export type TargetSpec = z.infer<typeof TargetSchema>;
export type SwiftPackage = z.infer<typeof RemotePackageSchema>;
export type LocalSwiftPackage = z.infer<typeof LocalPackageSchema>;
export type Scheme = z.infer<typeof SchemeSchema>;
export type AndroidDependency = z.infer<typeof AndroidDependencySchema>;
export type AndroidFeature = z.infer<typeof AndroidFeatureSchema>;
export function defineWorkspace<T extends WorkspaceConfig>(config: T): T {
  return config;
}
export const shareExtension = (spec: Omit<TargetSpec, 'type'>): TargetSpec => ({
  ...spec,
  type: 'share',
});
export const widgetExtension = (spec: Omit<TargetSpec, 'type'>): TargetSpec => ({
  ...spec,
  type: 'widget',
});
export const appClip = (spec: Omit<TargetSpec, 'type'>): TargetSpec => ({ ...spec, type: 'clip' });
export const notificationServiceExtension = (spec: Omit<TargetSpec, 'type'>): TargetSpec => ({
  ...spec,
  type: 'notification-service',
});
export const notificationContentExtension = (spec: Omit<TargetSpec, 'type'>): TargetSpec => ({
  ...spec,
  type: 'notification-content',
});
export const runScript = (spec: RunScript): RunScript => spec;
export const mavenRepository = (url: string): MavenRepository => url;
export const swiftPackage = (spec: SwiftPackage): SwiftPackage => spec;
export const localSwiftPackage = (spec: LocalSwiftPackage): LocalSwiftPackage => spec;
export const scheme = (spec: Scheme): Scheme => spec;
export const androidLibrary = (
  module: string,
  configuration: AndroidDependency['configuration'] = 'implementation',
): AndroidDependency => ({ module, configuration });
export const androidFeature = (name: string, required = true): AndroidFeature => ({
  name,
  required,
});
