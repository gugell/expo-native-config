# Configuration reference

The app-root `workspace.config.ts` default-exports `defineWorkspace({ schemaVersion: 1, ... })`. The published TypeScript declarations and runtime schemas are the authoritative field definitions. Invalid inputs should be fixed before prebuild. Import only from `expo-native-workspace`, never internal engine paths.

## Which manifest belongs where?

“Workspace manifest” means `workspace.config.ts`: the package's declarative input. It is separate from Expo's `app.json` / `app.config.ts` and the generated `android/app/src/main/AndroidManifest.xml`.

| File                            | Owns                                                  | Example                                          |
| ------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `app.json` or `app.config.ts`   | Expo identity, host entitlements, plugin registration | `expo.ios.bundleIdentifier`, `expo.plugins`      |
| `workspace.config.ts`           | Native targets and dependency/build declarations      | `ios.targets`, `android.queries`                 |
| `targets/<name>/`               | App-owned native implementation                       | Swift code, custom `Info.plist`                  |
| Generated `ios/` and `android/` | Output of Expo prebuild and the plugin                | Xcode targets, Podfile, Gradle, Android manifest |

A workspace file has **no `expo` wrapper**. Both platform sections are optional. This complete example needs no extension source files:

```ts
import { defineWorkspace } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    minimumPodDeploymentTarget: '16.4',
    schemes: [{ name: 'Example Debug', configuration: 'Debug', archive: 'Release' }],
  },
  android: {
    permissions: ['android.permission.CAMERA'],
    features: [{ name: 'android.hardware.camera', required: false }],
  },
});
```

`defineWorkspace` supplies TypeScript authoring support; loading through the CLI or plugin performs runtime validation. Helpers produce ordinary declaration objects: `shareExtension({ name: 'Share' })` is equivalent to `{ name: 'Share', type: 'share' }`. They do not create Swift files. JSON configurations use the object forms without imports or a default export.

## File discovery and paths

From the Expo app root, discovery checks `workspace.config.ts`, `.js`, `.cjs`, `.mjs`, then `.json`, in that order, and loads the first existing file. Keep one active config. The legacy `workspace.manifest.js` filename is not auto-discovered. TypeScript/JavaScript configurations execute trusted project code; JSON is useful for data-only declarations.

| Input                                 | Resolution base                                | Example                       |
| ------------------------------------- | ---------------------------------------------- | ----------------------------- |
| CLI `--project`                       | Current working directory                      | `--project apps/mobile`       |
| CLI `--config`, plugin `configPath`   | Expo app root                                  | `config/native.json`          |
| `ios.targetsRoot`                     | Expo app root                                  | `native/targets`              |
| Target `source`                       | Expo app root, confined inside it              | `native/targets/Share`        |
| Omitted target `source`               | `targetsRoot/<name>`, default `targets/<name>` | `targets/Share`               |
| Local Swift package / CocoaPod `path` | Generated `ios/`                               | `../native/WorkspaceMath`     |
| Signing `propertiesFile`              | Expo app root                                  | `codesign/release.properties` |
| Environment signing `storeFile`       | Generated `android/app/`                       | `release.keystore`            |
| `storeFile` inside private properties | Directory containing that properties file      | `release.jks`                 |

Moving the config into a subdirectory does not change these bases. A custom filename must be selected in **both** the CLI and Expo plugin:

```sh
pnpm exec expo-native-workspace validate --config config/native.json
pnpm exec expo-native-workspace plan --config config/native.json
```

Example `app.json` (merge these fields with your existing app):

```json
{
  "expo": {
    "name": "Example App",
    "slug": "example-app",
    "plugins": [["expo-native-workspace/plugin", { "configPath": "config/native.json" }]]
  }
}
```

Example `config/native.json`:

```json
{
  "schemaVersion": 1,
  "android": {
    "gradleProperties": { "org.gradle.parallel": true },
    "queries": { "packages": ["com.example.companion"] }
  }
}
```

## Field map

All fields are optional unless marked required. Unknown fields are rejected rather than silently ignored. `schemaVersion` accepts only `1` and defaults to it. An otherwise empty config declares no explicit platform capabilities; the engine may still include its default maintenance operations in a plan.

| iOS field                                  | Shape / purpose                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `deploymentTarget`                         | Dotted version string; default for additional targets, not the host app |
| `minimumPodDeploymentTarget`               | Dotted version string; floor for CocoaPods build settings               |
| `targetsRoot`, `targets`                   | Default source directory and array of native targets                    |
| `packages`, `pods`                         | Swift packages and host CocoaPods dependencies                          |
| `podfileGlobals`                           | Ruby identifier keys (without `$`), boolean/number/string values        |
| `podBuildSettings`, `removePodBuildPhases` | Scoped CocoaPods target rules                                           |
| `schemes`                                  | Named Debug/Release schemes                                             |
| `replaceExpoScheme`                        | Boolean; opt into replacing the default Expo scheme                     |
| `fixExtensionEmbedCycle`                   | Boolean; control extension embed-cycle correction                       |
| `xcode.env.exports`                        | String map exported into generated Xcode environment configuration      |
| `xcode.env.lines`                          | Array of shell lines for the Xcode environment; executable shell code   |

| Android field                                      | Shape / purpose                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `minSdkVersion`                                    | Integer, at least 24                                                       |
| `compileSdkVersion`, `targetSdkVersion`            | Positive integers; supplied values must respect min ≤ target ≤ compile     |
| `buildToolsVersion`, `ndkVersion`, `kotlinVersion` | Dotted version strings                                                     |
| `gradleProperties`                                 | String/number/boolean map                                                  |
| `permissions`                                      | Array of manifest permission strings                                       |
| `features`                                         | Feature names or `{ name, required?, glEsVersion? }`                       |
| `queries`                                          | `{ intents?: [{ action, scheme }], packages?: string[] }`                  |
| `dependencies`                                     | `{ module, configuration? }[]`, Maven `group:artifact:version` coordinates |
| `applicationAttributes`                            | String map of Android manifest application attributes                      |
| `lint`                                             | Optional `checkReleaseBuilds` and `abortOnError` booleans                  |
| `signing`                                          | One of the two signing shapes described below                              |

See [recipes](recipes.md) for complete configurations and [templates](templates.md) for starter file contents.

## iOS targets

```ts
import { defineWorkspace, shareExtension, widgetExtension } from 'expo-native-workspace';
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      shareExtension({ name: 'Share', source: './targets/Share', bundleIdentifier: '.share' }),
      widgetExtension({ name: 'Widget', source: './targets/Widget', bundleIdentifier: '.widget' }),
    ],
  },
});
```

Each target has a unique `name`, target `type` supplied by the helper, optional `source`, `bundleIdentifier`, `deploymentTarget`, `frameworks`, `entitlements`, `buildSettings`, and `pods`. A leading dot in the bundle identifier appends to the host app identifier. Source paths resolve from the app root; the default is `targets/<name>`. Keep Info.plist and native sources in that directory when custom behavior is needed. `ios.deploymentTarget` supplies a default for extension targets only; it does not configure the host app deployment target.

| Target field       | Meaning                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `name` (required)  | Unique target name, starting with a letter; then letters, digits, `_` or `-` |
| `type` (required)  | `share`, `widget`, or `clip`; helpers supply it                              |
| `bundleIdentifier` | Explicit ID or suffix such as `.share`; resolved IDs must be unique          |
| `source`           | Existing source directory inside the app root                                |
| `deploymentTarget` | Target override, then `ios.deploymentTarget`, then generator default `18.0`  |
| `frameworks`       | Additional system framework names                                            |
| `entitlements`     | Plist-shaped entitlement values                                              |
| `buildSettings`    | String map of Xcode build settings                                           |
| `pods`             | Dependencies for this target, using the Pod shape below                      |

The host must define `expo.ios.bundleIdentifier` when targets are declared. `appClip({ name: 'Preview', source: './targets/Preview', bundleIdentifier: '.clip' })` declares an App Clip; you supply its native app sources and app-specific setup. There is currently no App Clip init preset.

Entitlements are plist-shaped values. App Groups are needed only when sharing a container or preferences with the host app. Register the group with Apple and set matching `com.apple.security.application-groups` entries on both the host Expo config and extension declaration. Do not add a fictitious group just to make a sample look complete.

## Swift packages and CocoaPods

`ios.packages` accepts remote and local package declarations:

```ts
import { swiftPackage } from 'expo-native-workspace';
const remotePackage = swiftPackage({
  url: 'https://github.com/apple/swift-collections',
  requirement: { kind: 'exactVersion', version: '1.1.4' },
  products: ['Collections'],
});
const localPackage = { path: '../native/WorkspaceMath', products: ['WorkspaceMath'] };
```

Every remote declaration needs `url`, `products` (at least one product), and exactly one requirement shape:

```ts
// Alternative values for a remote package's requirement field:
const requirements = [
  { kind: 'exactVersion', version: '1.1.4' },
  { kind: 'upToNextMajorVersion', minimumVersion: '1.1.4' },
  { kind: 'upToNextMinorVersion', minimumVersion: '1.1.4' },
  { kind: 'versionRange', minimumVersion: '1.1.0', maximumVersion: '2.0.0' },
  { kind: 'branch', branch: 'main' },
  { kind: 'revision', revision: '<reviewed-commit-sha>' },
];
```

A local declaration uses `path` and `products` instead of `url` and `requirement`. Prefer reviewed versions or revisions for reproducibility. An optional `target` names one or several Xcode targets. `podTarget` attaches products to CocoaPods targets through generated Podfile integration. Local paths resolve from generated `ios/`, not the config directory.

`ios.pods` accepts `{ pod: 'WorkspaceGreeting', path: '../native/WorkspaceGreeting' }` for local pods or version/git declarations for remote pods. An extension can use its own `pods` array. A linked library is not automatically a JavaScript-accessible native module.

A Pod declaration requires `pod`. Additional fields are `path` for a local pod, or `version` / `git` with optional `branch`, `tag`, or `commit` for a remote pod; `configurations` accepts `Debug` and/or `Release`, and `modularHeaders` is boolean. Use the source form appropriate to the dependency; do not combine a local path with remote selection options. Host pods go in `ios.pods`; extension pods go in `ios.targets[].pods`, not a `target` property on a Pod declaration.

A Swift package's `target` can be one target name or an array; omitting it selects the host. Use declared native target names or the sanitized Expo app name. `podTarget` can likewise be one name or an array of CocoaPods target names.

## Podfile build settings

```ts
const ios = {
  minimumPodDeploymentTarget: '16.4',
  podfileGlobals: { RNFirebaseAsStaticFramework: true },
};
```

`ios.minimumPodDeploymentTarget` raises missing or lower `IPHONEOS_DEPLOYMENT_TARGET` values in CocoaPods targets during `post_install`. Equal and higher versions remain unchanged; inherited expressions remain unchanged. Set the host app deployment target separately, for example through Expo build properties. The floor does not lower a dependency's minimum OS requirement.

`ios.podfileGlobals` writes typed Ruby globals at the start of the Podfile. Keys omit `$` and use letters, digits, and underscores, beginning with a letter or underscore. Values are booleans, finite numbers, or literal strings; strings are escaped rather than evaluated. `RNFirebaseAsStaticFramework: true` sets the React Native Firebase flag; configure static framework linkage separately in the app's Expo build properties. Globals do not remove pods injected by other plugins.

## Xcode schemes

```ts
import { scheme } from 'expo-native-workspace';
const development = scheme({ name: 'Development', configuration: 'Debug', archive: 'Release' });
```

Put schemes in `ios.schemes`. Optional `analyze` and `includeUnitTestTarget` control those actions. Use existing build configurations; naming a scheme does not create a new build configuration, bundle ID, environment, or signing profile. Keep Expo's scheme unless replacement is explicitly needed.

## Android

```ts
import { androidFeature, androidLibrary, defineWorkspace } from 'expo-native-workspace';
export default defineWorkspace({
  schemaVersion: 1,
  android: {
    dependencies: [androidLibrary('androidx.collection:collection-ktx:1.4.5')],
    gradleProperties: { 'org.gradle.parallel': true },
    permissions: ['android.permission.CAMERA'],
    features: [androidFeature('android.hardware.camera', false)],
    applicationAttributes: { 'android:supportsRtl': 'true' },
  },
});
```

`androidLibrary(module, configuration)` defaults to `implementation`. Supported configurations are `implementation`, `api`, `compileOnly`, `runtimeOnly`, `debugImplementation`, and `releaseImplementation`. `androidFeature(name, required)` defaults to required. Optional hardware avoids unnecessarily excluding devices. Declaring a permission does not grant runtime access; request dangerous permissions at runtime.

Android settings also cover SDK versions, build tools, NDK, Kotlin, and signing. Prefer Expo's defaults unless a dependency requires a change. Signing credentials must stay in environment references or private credential files and must not be committed. Sample apps deliberately use ordinary debug signing defaults.

## Android package visibility

```ts
const queries = {
  intents: [
    { action: 'android.intent.action.VIEW', scheme: 'geo' },
    { action: 'android.intent.action.VIEW', scheme: 'https' },
  ],
  packages: ['com.google.android.apps.maps', 'com.waze'],
};
// Set android.queries = queries inside defineWorkspace(...).
```

Each intent produces a separate `<intent>` query containing one action and scheme. Existing queries are merged into one `<queries>` root; duplicate entries are removed and provider queries are preserved. Package visibility enables discovery; it does not install applications or grant permissions. Removing a declaration requires clean prebuild to remove stale generated entries.

## Scope and unsupported inputs

The public schema rejects unknown fields, including arbitrary patch declarations. Prefer a typed capability and a focused regression test when adding first-party support. Config files themselves are executable trusted project code, not safely sandboxed data.

## Android release signing

Choose one signing source; do not combine these shapes. Existing environment signing remains supported:

```ts
signing: {
  storeFile: 'release.keystore',
  keyAlias: 'release',
  storePassword: { env: 'STORE_PASSWORD' },
  keyPassword: { env: 'KEY_PASSWORD' },
}
```

Here `storeFile` resolves from `android/app`. Both environment references are required. This mode resolves passwords during prebuild into generated Gradle properties; protect generated build files as credentials and never commit them.

To use an existing private Java properties file without copying credentials or a keystore into generated Android output:

```ts
signing: {
  propertiesFile: 'codesign/codesign.properties',
  optional: true,
}
```

`propertiesFile` resolves from the Expo app root. It must provide `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`. Its relative `storeFile` resolves beside the properties file: `storeFile=keystore.jks` refers to `codesign/keystore.jks` in this example. Absolute keystore paths are also accepted. Gradle reads the original files at build time; config validation, planning, and prebuild do not read their contents. Keep both files out of version control and supply them only to authorized build environments.

`optional` defaults to `false`, so a missing file normally fails Gradle configuration. With `optional: true`, a developer without release credentials can still build debug variants. Release validation and packaging require a complete, non-debug signing configuration and an existing keystore; a missing optional file never permits fallback to Expo's debug signing configuration. This checks availability, not whether a keystore or password is valid; Android's signing task performs those checks.

EAS may inject complete release credentials after prebuild; the release guard checks the effective signing configuration at task execution. If EAS owns signing entirely, omit this local signing declaration when `process.env.EAS_BUILD === 'true'` and use EAS credential configuration. Do not assume local ignored files are uploaded to EAS. When migrating away from a plugin that copied signing files, preserve app-owned changes and regenerate clean native output to remove previously copied credentials.

### Android lint

Use `android.lint: { checkReleaseBuilds: false, abortOnError: false }` only when the app intentionally suppresses release lint checks. Both booleans are optional; omitted values keep AGP defaults. These settings use AGP's `lint` DSL with an updateable generated block. For native library packaging, prefer the official `expo-build-properties` `android.packagingOptions` API.

### CocoaPods target rules

`ios.podBuildSettings` accepts `{ target, settings, configurations? }` rules, where `settings` maps Xcode build-setting names to string values and `configurations` optionally scopes a rule to `Debug` or `Release`. `ios.removePodBuildPhases` accepts `{ target, phase }` rules. A target matcher is an exact name or an object with `equals`, `startsWith`, and/or `regex` (Ruby regular expression syntax); provided predicates all apply. Prefer a narrow exact name or prefix so unrelated vendor targets remain untouched.

```ts
podBuildSettings: [{
  target: { startsWith: 'NativeMedia' },
  settings: { SWIFT_VERSION: '5.9' },
}],
removePodBuildPhases: [{
  target: { startsWith: 'NativeMedia' },
  phase: 'ExtractAppIntentsMetadata',
}],
```

Scheme names may contain spaces, for example `Example App Debug`; names must remain safe filenames. Existing CI scheme names can therefore be preserved during migration.

## Validation examples

These are invalid workspace fragments:

```ts
// Unknown root field: Expo settings belong in app.json/app.config.ts.
const wrongRoot = { expo: { ios: { bundleIdentifier: 'com.example.app' } } };
// Unsupported target kind: use share, widget, or clip.
const wrongTarget = { name: 'Watch', type: 'watch' };
// Unsupported custom build configuration: create/use Debug or Release schemes.
const wrongScheme = { name: 'Staging', configuration: 'Staging' };
// SDK ordering must be coherent.
const wrongAndroid = { minSdkVersion: 35, targetSdkVersion: 34 };
```

Schema validation also checks field shapes and unknown keys. Semantic validation checks source directories, target names and bundle identifier collisions, App Group consistency, and package target references. It cannot prove that Swift code compiles, a Maven artifact exists, or signing credentials work. Run `validate`, inspect `plan`, then prebuild and compile the relevant native app.
