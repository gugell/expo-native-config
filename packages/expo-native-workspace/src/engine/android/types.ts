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
  /** Permission names (e.g. "android.permission.RECORD_AUDIO"). */
  permissions?: string[];
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
}

/** The manifest slice this package consumes. */
export interface AndroidManifestSlice {
  android?: AndroidSlice;
}

export type GradleFile = 'app' | 'project';

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
  /** Regex source for the anchor line. */
  anchor: string;
  offset: number;
  comment: string;
  contents: string;
}
export interface AndroidGradleReplaceOp extends BaseOp {
  kind: 'androidGradleReplace';
  file: GradleFile;
  /** Regex source. */
  find: string;
  replacement: string;
  all: boolean;
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
  | AndroidManifestPermissionOp
  | AndroidManifestAppAttributeOp
  | AndroidManifestUsesFeatureOp;

const ANDROID_KINDS = new Set([
  'androidGradleProperty',
  'androidGradleBlock',
  'androidGradleReplace',
  'androidManifestPermission',
  'androidManifestAppAttribute',
  'androidManifestUsesFeature',
]);

export function isAndroidOp(op: Op): op is AndroidOp {
  return ANDROID_KINDS.has(op.kind);
}
