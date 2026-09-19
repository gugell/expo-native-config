/**
 * Constructors for every manifest value that has more than one shape.
 *
 * A type and a value can share a name in TypeScript, so `Target` is both the
 * declaration type and this namespace: `Target.share({ name: 'Share' })` builds
 * a value of type `Target`. Defaults and discriminants live here rather than at
 * each call site, which is what keeps a config from repeating `type: 'share'`
 * or `kind: 'receiver'` by hand.
 *
 * Both authoring styles stay valid — every constructor returns a plain object,
 * and the schema accepts the same literal you would have written yourself. JSON
 * configs necessarily use literals; TypeScript configs can use either.
 */
import type {
  AndroidComponent as AndroidComponentType,
  AndroidDependency as AndroidDependencyType,
  AndroidFeature as AndroidFeatureType,
  AndroidModule as AndroidModuleType,
  BuildConfigField as BuildConfigFieldType,
  LocalSwiftPackage,
  MavenRepository as MavenRepositoryType,
  PodBuildSettings as PodBuildSettingsType,
  ReplaceRule as ReplaceRuleType,
  RunScript as RunScriptType,
  Scheme as SchemeType,
  SwiftPackage,
  TargetSpec,
} from './schema';

/** The single member of a union carrying this discriminant. */
type Of<T, K extends keyof T, V extends T[K]> = Extract<T, Record<K, V>>;

type TargetBody = Omit<TargetSpec, 'type'>;
type TargetOf<T extends TargetSpec['type']> = Of<TargetSpec, 'type', T>;
const target =
  <T extends TargetSpec['type']>(type: T) =>
  (spec: TargetBody): TargetOf<T> =>
    ({ ...spec, type }) as TargetOf<T>;

export type Target = TargetSpec;
/** iOS native targets. Each constructor supplies the `type` discriminant. */
export const Target = {
  share: target('share'),
  widget: target('widget'),
  appClip: target('clip'),
  notificationService: target('notification-service'),
  notificationContent: target('notification-content'),
  intent: target('intent'),
  action: target('action'),
  safari: target('safari'),
} as const;

type PodSpec = NonNullable<TargetSpec['pods']>[number];
type GitRef = { branch: string } | { tag: string } | { commit: string };

export type Pod = PodSpec;
/** CocoaPods dependencies. Local, versioned and git sources are distinct shapes. */
export const Pod = {
  /** A pod inside the project; `path` resolves from the generated `ios/`. */
  local: (pod: string, path: string, options: Omit<PodSpec, 'pod' | 'path'> = {}): PodSpec => ({
    pod,
    path,
    ...options,
  }),
  /** A released pod, e.g. `Pod.version('Sentry', '~> 8.0')`. */
  version: (
    pod: string,
    version: string,
    options: Omit<PodSpec, 'pod' | 'version'> = {},
  ): PodSpec => ({
    pod,
    version,
    ...options,
  }),
  /** A pod from git. Pass exactly one of branch / tag / commit. */
  git: (
    pod: string,
    git: string,
    ref: GitRef,
    options: Omit<PodSpec, 'pod' | 'git'> = {},
  ): PodSpec => ({
    pod,
    git,
    ...ref,
    ...options,
  }),
} as const;

type Requirement = SwiftPackage['requirement'];

export type SwiftPackageRequirement = Requirement;
/** Swift package version requirements; one constructor per requirement kind. */
export const SwiftPackageRequirement = {
  exact: (version: string): Requirement => ({ kind: 'exactVersion', version }),
  upToNextMajor: (minimumVersion: string): Requirement => ({
    kind: 'upToNextMajorVersion',
    minimumVersion,
  }),
  upToNextMinor: (minimumVersion: string): Requirement => ({
    kind: 'upToNextMinorVersion',
    minimumVersion,
  }),
  range: (minimumVersion: string, maximumVersion: string): Requirement => ({
    kind: 'versionRange',
    minimumVersion,
    maximumVersion,
  }),
  branch: (branch: string): Requirement => ({ kind: 'branch', branch }),
  revision: (revision: string): Requirement => ({ kind: 'revision', revision }),
} as const;

export type Package = SwiftPackage | LocalSwiftPackage;
/** Swift packages. `remote` needs a requirement; `local` needs a path. */
export const Package = {
  remote: (
    url: string,
    requirement: Requirement,
    products: string[],
    options: Omit<SwiftPackage, 'url' | 'requirement' | 'products'> = {},
  ): SwiftPackage => ({ url, requirement, products, ...options }),
  local: (
    path: string,
    products: string[],
    options: Omit<LocalSwiftPackage, 'path' | 'products'> = {},
  ): LocalSwiftPackage => ({ path, products, ...options }),
} as const;

export type Scheme = SchemeType;
/** Xcode schemes. The configuration is the discriminating choice, so it names the constructor. */
export const Scheme = {
  debug: (name: string, options: Omit<SchemeType, 'name' | 'configuration'> = {}): SchemeType => ({
    name,
    configuration: 'Debug',
    ...options,
  }),
  release: (
    name: string,
    options: Omit<SchemeType, 'name' | 'configuration'> = {},
  ): SchemeType => ({
    name,
    configuration: 'Release',
    ...options,
  }),
} as const;

export type RunScript = RunScriptType;
/** Shell-script build phases on the host app target. */
export const RunScript = {
  shell: (
    name: string,
    script: string,
    options: Omit<RunScriptType, 'name' | 'script'> = {},
  ): RunScriptType => ({
    name,
    script,
    ...options,
  }),
  /** "Run script only when installing" — archive builds only. */
  onInstall: (
    name: string,
    script: string,
    options: Omit<RunScriptType, 'name' | 'script' | 'runOnlyForDeploymentPostprocessing'> = {},
  ): RunScriptType => ({
    name,
    script,
    runOnlyForDeploymentPostprocessing: true,
    ...options,
  }),
} as const;

export type PodBuildSettings = PodBuildSettingsType;
/** Scoped CocoaPods `post_install` build settings. The matcher shape names the constructor. */
export const PodBuildSettings = {
  forTarget: (
    name: string,
    settings: PodBuildSettingsType['settings'],
    options: Omit<PodBuildSettingsType, 'target' | 'settings'> = {},
  ): PodBuildSettingsType => ({ target: name, settings, ...options }),
  forTargetsStartingWith: (
    prefix: string,
    settings: PodBuildSettingsType['settings'],
    options: Omit<PodBuildSettingsType, 'target' | 'settings'> = {},
  ): PodBuildSettingsType => ({ target: { startsWith: prefix }, settings, ...options }),
  forTargetsMatching: (
    regex: string,
    settings: PodBuildSettingsType['settings'],
    options: Omit<PodBuildSettingsType, 'target' | 'settings'> = {},
  ): PodBuildSettingsType => ({ target: { regex }, settings, ...options }),
} as const;

export type AndroidDependency = AndroidDependencyType;
type GradleConfiguration = NonNullable<AndroidDependencyType['configuration']>;
/** App-module Gradle dependencies: Maven coordinate, local project, or BOM. */
export const AndroidDependency = {
  library: (
    module: string,
    configuration: GradleConfiguration = 'implementation',
  ): AndroidDependencyType => ({ module, configuration }),
  /** A Maven coordinate with transitive dependencies excluded. */
  libraryExcluding: (
    module: string,
    exclude: Array<{ group: string; module?: string }>,
    configuration: GradleConfiguration = 'implementation',
  ): AndroidDependencyType => ({ module, exclude, configuration }),
  /** A local Gradle module; declare it in `android.modules` as well. */
  project: (
    project: string,
    configuration: GradleConfiguration = 'implementation',
  ): AndroidDependencyType => ({ project, configuration }),
  /** A BOM, rendered as `implementation platform('…')`. */
  bom: (
    platform: string,
    configuration: GradleConfiguration = 'implementation',
  ): AndroidDependencyType => ({ platform, configuration }),
} as const;

export type AndroidComponent = AndroidComponentType;
type ComponentKind = AndroidComponentType['kind'];
const component =
  (kind: ComponentKind) =>
  (name: string, attributes?: Record<string, string>): AndroidComponentType => ({
    kind,
    name,
    ...(attributes ? { attributes } : {}),
  });

/** AndroidManifest application components. `remove` emits `tools:node="remove"`. */
export const AndroidComponent = {
  activity: component('activity'),
  service: component('service'),
  receiver: component('receiver'),
  provider: component('provider'),
  /** Drop a component a dependency merged into the manifest. */
  remove: (kind: ComponentKind, name: string): AndroidComponentType => ({
    kind,
    name,
    remove: true,
  }),
} as const;

export type MavenRepository = MavenRepositoryType;
/** Extra Maven repositories. `private` reads credentials from the environment. */
export const MavenRepository = {
  url: (url: string): MavenRepositoryType => url,
  /** Restrict a repository to the groups it actually serves. */
  scoped: (url: string, includeGroups: string[]): MavenRepositoryType => ({ url, includeGroups }),
  private: (url: string, usernameEnv: string, passwordEnv: string): MavenRepositoryType => ({
    url,
    credentials: { username: { env: usernameEnv }, password: { env: passwordEnv } },
  }),
} as const;

export type AndroidModule = AndroidModuleType;
/** A local Gradle module included from settings.gradle. */
export const AndroidModule = {
  at: (name: string, path: string): AndroidModuleType => ({ name, path }),
} as const;

export type BuildConfigField = BuildConfigFieldType;
/** `defaultConfig.buildConfigField` entries; the String form quotes for you. */
export const BuildConfigField = {
  string: (name: string, value: string): BuildConfigFieldType => ({
    type: 'String',
    name,
    value: JSON.stringify(value),
  }),
  boolean: (name: string, value: boolean): BuildConfigFieldType => ({
    type: 'boolean',
    name,
    value: String(value),
  }),
  int: (name: string, value: number): BuildConfigFieldType => ({
    type: 'int',
    name,
    value: String(value),
  }),
  raw: (type: string, name: string, value: string): BuildConfigFieldType => ({ type, name, value }),
} as const;

export type AndroidFeature = AndroidFeatureType;
/** `<uses-feature>` entries. Optional hardware avoids excluding devices. */
export const AndroidFeature = {
  required: (name: string): AndroidFeatureType => ({ name, required: true }),
  optional: (name: string): AndroidFeatureType => ({ name, required: false }),
  openGlEs: (glEsVersion: string, required = true): AndroidFeatureType => ({
    name: 'android.hardware.opengles.version',
    glEsVersion,
    required,
  }),
} as const;

export type ReplaceRule = ReplaceRuleType;
/**
 * Escape-hatch replacements over generated Ruby or Groovy. Every constructor
 * defaults `required` to true: a rule that silently stops matching after an SDK
 * upgrade is the failure mode these are known for, so it fails the build instead.
 */
export const ReplaceRule = {
  regex: (
    find: string,
    replacement: string,
    options: Omit<ReplaceRuleType, 'find' | 'replacement'> = {},
  ): ReplaceRuleType => ({
    find,
    replacement,
    required: true,
    ...options,
  }),
  /** Escapes the needle, so it matches literally. */
  literal: (
    find: string,
    replacement: string,
    options: Omit<ReplaceRuleType, 'find' | 'replacement'> = {},
  ): ReplaceRuleType => ({
    find: find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    replacement,
    required: true,
    all: true,
    ...options,
  }),
} as const;

/** Android ABIs. `Abi.all` is the Play Store default; a preview build often ships `[Abi.arm64]`. */
export const Abi = {
  arm64: 'arm64-v8a',
  armv7: 'armeabi-v7a',
  x86: 'x86',
  x64: 'x86_64',
  all: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
} as const;

/** Frequently declared Android permissions, spelled once. Any other string is still accepted. */
export const AndroidPermission = {
  camera: 'android.permission.CAMERA',
  recordAudio: 'android.permission.RECORD_AUDIO',
  modifyAudioSettings: 'android.permission.MODIFY_AUDIO_SETTINGS',
  internet: 'android.permission.INTERNET',
  accessNetworkState: 'android.permission.ACCESS_NETWORK_STATE',
  accessFineLocation: 'android.permission.ACCESS_FINE_LOCATION',
  accessCoarseLocation: 'android.permission.ACCESS_COARSE_LOCATION',
  accessBackgroundLocation: 'android.permission.ACCESS_BACKGROUND_LOCATION',
  postNotifications: 'android.permission.POST_NOTIFICATIONS',
  readMediaImages: 'android.permission.READ_MEDIA_IMAGES',
  readMediaVideo: 'android.permission.READ_MEDIA_VIDEO',
  readMediaAudio: 'android.permission.READ_MEDIA_AUDIO',
  readExternalStorage: 'android.permission.READ_EXTERNAL_STORAGE',
  writeExternalStorage: 'android.permission.WRITE_EXTERNAL_STORAGE',
  vibrate: 'android.permission.VIBRATE',
  useBiometric: 'android.permission.USE_BIOMETRIC',
  bluetoothConnect: 'android.permission.BLUETOOTH_CONNECT',
  bluetoothScan: 'android.permission.BLUETOOTH_SCAN',
  foregroundService: 'android.permission.FOREGROUND_SERVICE',
  scheduleExactAlarm: 'android.permission.SCHEDULE_EXACT_ALARM',
  activityRecognition: 'android.permission.ACTIVITY_RECOGNITION',
} as const;

/** Android hardware features, for `android.features`. */
export const AndroidHardware = {
  camera: 'android.hardware.camera',
  cameraAny: 'android.hardware.camera.any',
  cameraAutofocus: 'android.hardware.camera.autofocus',
  microphone: 'android.hardware.microphone',
  locationGps: 'android.hardware.location.gps',
  bluetoothLe: 'android.hardware.bluetooth_le',
  touchscreen: 'android.hardware.touchscreen',
  nfc: 'android.hardware.nfc',
} as const;

interface ApplicationFlags {
  largeHeap?: boolean;
  allowBackup?: boolean;
  supportsRtl?: boolean;
  usesCleartextTraffic?: boolean;
  hardwareAccelerated?: boolean;
  requestLegacyExternalStorage?: boolean;
  /** Resource reference, e.g. `@xml/network_security_config`. */
  networkSecurityConfig?: string;
  /** Anything with no named flag yet, spelled with its full `android:` key. */
  extra?: Record<string, string>;
}

/** Attributes on the manifest `<application>` element. */
export const AndroidApplication = {
  /**
   * Builds the `android.applicationAttributes` record from named flags, so a
   * config carries `largeHeap: true` rather than `'android:largeHeap': 'true'`.
   */
  attributes: ({ extra, ...flags }: ApplicationFlags): Record<string, string> => {
    const attributes: Record<string, string> = { ...extra };
    for (const [key, value] of Object.entries(flags)) {
      if (value === undefined) continue;
      attributes[`android:${key}`] = String(value);
    }
    return attributes;
  },
} as const;

interface XcodeSettings {
  /** e.g. `arm64` to skip the simulator slice. */
  excludedArchs?: string;
  swiftVersion?: string;
  /** Bridging header path, relative to the generated `ios/`. */
  swiftObjcBridgingHeader?: string;
  otherLdFlags?: string;
  otherSwiftFlags?: string;
  enableBitcode?: boolean;
  alwaysEmbedSwiftStandardLibraries?: boolean;
  clangAllowNonModularIncludesInFrameworkModules?: boolean;
  ldExportSymbols?: boolean;
  codeSignIdentity?: string;
  developmentTeam?: string;
  /** Any build setting with no named field, spelled with its Xcode name. */
  extra?: Record<string, string>;
}

const XCODE_SETTING_NAMES: Record<Exclude<keyof XcodeSettings, 'extra'>, string> = {
  excludedArchs: 'EXCLUDED_ARCHS',
  swiftVersion: 'SWIFT_VERSION',
  swiftObjcBridgingHeader: 'SWIFT_OBJC_BRIDGING_HEADER',
  otherLdFlags: 'OTHER_LDFLAGS',
  otherSwiftFlags: 'OTHER_SWIFT_FLAGS',
  enableBitcode: 'ENABLE_BITCODE',
  alwaysEmbedSwiftStandardLibraries: 'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES',
  clangAllowNonModularIncludesInFrameworkModules:
    'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES',
  ldExportSymbols: 'LD_EXPORT_SYMBOLS',
  codeSignIdentity: 'CODE_SIGN_IDENTITY',
  developmentTeam: 'DEVELOPMENT_TEAM',
};

/** Xcode build settings, by name rather than by string key. */
export const XcodeBuildSettings = {
  /**
   * Builds a build-settings record from named fields. Booleans become Xcode's
   * `YES`/`NO` rather than `true`/`false`, which is the usual reason a
   * hand-written setting silently does nothing.
   */
  of: ({ extra, ...named }: XcodeSettings): Record<string, string> => {
    const settings: Record<string, string> = { ...extra };
    for (const [key, value] of Object.entries(named)) {
      if (value === undefined) continue;
      const name = XCODE_SETTING_NAMES[key as keyof typeof XCODE_SETTING_NAMES];
      settings[name] = typeof value === 'boolean' ? (value ? 'YES' : 'NO') : String(value);
    }
    return settings;
  },
} as const;
