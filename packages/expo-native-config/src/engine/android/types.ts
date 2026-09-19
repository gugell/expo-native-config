import type { BaseOp, Op, SecretInput } from '../core';

import type { AndroidDependency } from './dependencies';
import type { AndroidFeature } from './features';

export type { AndroidDependency, GradleConfiguration } from './dependencies';
export type { AndroidFeature, AndroidUsesFeature } from './features';

export interface AndroidEnvironmentSigningConfig {
  /** Keystore path relative to android/app (e.g. "release.keystore"). */
  storeFile: string;
  /** Literal, `env:VAR`, or `{ env: "VAR" }`. Prefer env refs. */
  storePassword?: SecretInput;
  keyAlias: string;
  keyPassword?: SecretInput;
}

export interface AndroidPropertiesSigningConfig {
  /** Properties file relative to the Expo app root; keystore resolves beside this file. */
  propertiesFile: string;
  /** Allow missing credentials for debug builds. Release signing still fails closed. */
  optional?: boolean;
}
export type AndroidSigningConfig = AndroidEnvironmentSigningConfig | AndroidPropertiesSigningConfig;

export interface MavenRepositorySpec {
  url: string;
  credentials?: { username: { env: string }; password: { env: string } };
  includeGroups?: string[];
}
export type MavenRepository = string | MavenRepositorySpec;

export interface AndroidComponentSpec {
  kind: 'activity' | 'service' | 'receiver' | 'provider';
  name: string;
  attributes?: Record<string, string>;
  /** Emit `tools:node="remove"` so manifest merging drops a library's component. */
  remove?: boolean;
}

export interface BuildConfigFieldSpec {
  type: string;
  name: string;
  /** Literal Gradle value; quote it yourself for String fields. */
  value: string;
}

export interface AndroidResourceFileSpec {
  /** Path under android/app/src/main/res. */
  path: string;
  contents: string;
  overwrite?: 'always' | 'ifAbsent';
}

export interface AndroidModuleSpec {
  name: string;
  /** Project directory, relative to the Expo app root. */
  path: string;
}

export interface GradleReplaceRule {
  find: string;
  replacement: string;
  all?: boolean;
  skipIfContains?: string;
  required?: boolean;
}

export interface AndroidStyleSpec {
  /** Style name, e.g. "AppTheme". */
  name: string;
  /** Parent style; omit to match the existing group by name. */
  parent?: string;
  /** `<item name="…">value</item>` entries. */
  items: Record<string, string>;
  /** Write into `values-v<api>/styles.xml` instead of `values/`. */
  targetApi?: string;
}

export interface AndroidSlice {
  lint?: { checkReleaseBuilds?: boolean; abortOnError?: boolean };
  minSdkVersion?: number;
  compileSdkVersion?: number;
  targetSdkVersion?: number;
  buildToolsVersion?: string;
  ndkVersion?: string;
  kotlinVersion?: string;
  /** Arbitrary gradle.properties entries. */
  gradleProperties?: Record<string, string | number | boolean>;
  /**
   * App Gradle dependencies. Prefer `{ module, configuration }` over raw Groovy
   * lines so plan/doctor can show coordinates instead of opaque strings.
   */
  dependencies?: AndroidDependency[];
  /** `<uses-feature>` entries in AndroidManifest.xml. */
  features?: AndroidFeature[];
  /** Attributes set on the AndroidManifest `<application>` element. */
  applicationAttributes?: Record<string, string>;
  /** Release signing via environment references or an external properties file. */
  signing?: AndroidSigningConfig;
  /** `<meta-data>` entries on the manifest `<application>` element. */
  metaData?: Record<string, string>;
  /** `<activity>` / `<service>` / `<receiver>` / `<provider>` entries or removals. */
  components?: AndroidComponentSpec[];
  /** `<supports-screens>` flags, e.g. `{ largeScreens: false }`. */
  supportsScreens?: Record<string, boolean>;
  /** `defaultConfig.manifestPlaceholders`. */
  manifestPlaceholders?: Record<string, string>;
  /** `defaultConfig.buildConfigField` entries. */
  buildConfigFields?: BuildConfigFieldSpec[];
  /** `defaultConfig.ndk.abiFilters` plus React Native's `reactNativeArchitectures`. */
  abiFilters?: string[];
  /** Extra Maven repositories for every project. */
  mavenRepositories?: MavenRepository[];
  /** `flatDir` repositories holding local .aar files, relative to the Expo app root. */
  flatDirs?: string[];
  /** `buildscript.dependencies` classpath coordinates in the root build.gradle. */
  buildscriptDependencies?: string[];
  /** Gradle plugin ids applied to the app module, e.g. "com.google.gms.google-services". */
  plugins?: string[];
  /** `resolutionStrategy.force` coordinates applied to every configuration. */
  forceDependencies?: string[];
  /** Local Gradle modules included from settings.gradle. */
  modules?: AndroidModuleSpec[];
  /** Expo module names excluded from Android autolinking. */
  autolinkingExclude?: string[];
  /** `strings.xml` values; the documented channel for pre-JS native startup config. */
  strings?: Record<string, string>;
  /** `colors.xml` values. */
  colors?: Record<string, string>;
  /** `styles.xml` groups. */
  styles?: AndroidStyleSpec[];
  /** Raw files written under android/app/src/main/res (for resources with no typed mod). */
  resources?: AndroidResourceFileSpec[];
  /** Regular-expression escape hatch over the generated Gradle files. */
  gradle?: {
    app?: GradleReplaceRule[];
    project?: GradleReplaceRule[];
    settings?: GradleReplaceRule[];
  };
}

/** The manifest slice this package consumes. */
export interface AndroidManifestSlice {
  android?: AndroidSlice;
}

export type GradleFile = 'app' | 'project' | 'settings';

export interface AndroidGradlePropertyOp extends BaseOp {
  kind: 'androidGradleProperty';
  secret?: SecretInput;
  key: string;
  value: string;
}
export interface AndroidGradleBlockOp extends BaseOp {
  kind: 'androidGradleBlock';
  file: GradleFile;
  tag: string;
  /** Regex source for the anchor LINE (mergeContents matches line by line). */
  anchor: string;
  offset: number;
  comment: string;
  contents: string;
  /** Append the block at the end of the file instead of anchoring inside it. */
  append?: boolean;
}
export interface AndroidGradleReplaceOp extends BaseOp {
  kind: 'androidGradleReplace';
  file: GradleFile;
  /** Regex source. */
  find: string;
  replacement: string;
  all: boolean;
  /** Skip when the file already contains this marker (non-idempotent patterns). */
  skipIfContains?: string;
  /** Fail the build when the pattern matches nothing. */
  required?: boolean;
}
export interface AndroidManifestPermissionOp extends BaseOp {
  kind: 'androidManifestPermission';
  permission: string;
}
export interface AndroidManifestAppAttributeOp extends BaseOp {
  kind: 'androidManifestAppAttribute';
  name: string;
  value: string;
}

/** Removes a previously merged Gradle block when its declaration disappears. */
export interface AndroidGradleRemoveBlockOp extends BaseOp {
  kind: 'androidGradleRemoveBlock';
  file: GradleFile;
  tag: string;
}
export interface AndroidManifestMetaDataOp extends BaseOp {
  kind: 'androidManifestMetaData';
  name: string;
  value: string;
}
export interface AndroidManifestComponentOp extends BaseOp {
  kind: 'androidManifestComponent';
  component: AndroidComponentSpec;
}
export interface AndroidManifestSupportsScreensOp extends BaseOp {
  kind: 'androidManifestSupportsScreens';
  flags: Record<string, boolean>;
}
export interface AndroidStringOp extends BaseOp {
  kind: 'androidString';
  name: string;
  value: string;
}
export interface AndroidColorOp extends BaseOp {
  kind: 'androidColor';
  name: string;
  value: string;
}
export interface AndroidStyleOp extends BaseOp {
  kind: 'androidStyle';
  style: AndroidStyleSpec;
}
export interface AndroidManifestUsesFeatureOp extends BaseOp {
  kind: 'androidManifestUsesFeature';
  name: string;
  required?: boolean;
  glEsVersion?: string;
}

export type AndroidOp =
  | AndroidGradlePropertyOp
  | AndroidGradleBlockOp
  | AndroidGradleReplaceOp
  | AndroidGradleRemoveBlockOp
  | AndroidManifestPermissionOp
  | AndroidManifestAppAttributeOp
  | AndroidManifestUsesFeatureOp
  | AndroidManifestMetaDataOp
  | AndroidManifestComponentOp
  | AndroidManifestSupportsScreensOp
  | AndroidStringOp
  | AndroidColorOp
  | AndroidStyleOp;

const ANDROID_KINDS = new Set([
  'androidGradleProperty',
  'androidGradleBlock',
  'androidGradleReplace',
  'androidGradleRemoveBlock',
  'androidManifestPermission',
  'androidManifestAppAttribute',
  'androidManifestUsesFeature',
  'androidManifestMetaData',
  'androidManifestComponent',
  'androidManifestSupportsScreens',
  'androidString',
  'androidColor',
  'androidStyle',
]);

export function isAndroidOp(op: Op): op is AndroidOp {
  return ANDROID_KINDS.has(op.kind);
}
