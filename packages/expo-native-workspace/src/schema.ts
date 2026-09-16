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
  type: z.enum(['share', 'widget', 'clip']),
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
export const AndroidDependencySchema = z.strictObject({
  module: text.regex(/^[^\s:'"\\]+:[^\s:'"\\]+:[^\s'"\\]+$/, 'Expected group:artifact:version'),
  configuration: z
    .enum([
      'implementation',
      'api',
      'compileOnly',
      'runtimeOnly',
      'debugImplementation',
      'releaseImplementation',
    ])
    .optional(),
});
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
