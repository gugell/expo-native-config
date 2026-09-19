# Configuration reference

The app-root `workspace.config.ts` default-exports `defineWorkspace({ schemaVersion: 1, ... })`. The published TypeScript declarations and runtime schemas are the authoritative field definitions. Invalid inputs should be fixed before prebuild. Import only from `expo-native-config`, never internal engine paths.

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
import { defineWorkspace } from 'expo-native-config';

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

`defineWorkspace` supplies TypeScript authoring support; loading through the CLI or plugin performs runtime validation. JSON configurations use the object forms without imports or a default export.

## Constructors, or plain objects

Every declaration can be written as a literal. Values with more than one shape also have a constructor, so the discriminant and the defaults are supplied for you:

```ts
import { AndroidComponent, Target, XcodeBuildSettings } from 'expo-native-config';

Target.share({ name: 'Share' }); // { name: 'Share', type: 'share' }
AndroidComponent.remove('receiver', 'androidx.profileinstaller.ProfileInstallReceiver');
XcodeBuildSettings.of({ ldExportSymbols: false }); // { LD_EXPORT_SYMBOLS: 'NO' }
```

A name like `Target` is both the type and the namespace of constructors, so `Target` annotates a value and `Target.share(…)` builds one. Constructors return plain objects and validate identically — **both styles are supported, and they mix freely**. Use a literal when it is already obvious; use a constructor when it saves you a magic string.

| Namespace                 | Constructors                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Target`                  | `share`, `widget`, `appClip`, `notificationService`, `notificationContent`, `intent`, `action`, `safari` |
| `Pod`                     | `local`, `version`, `git`                                                                                |
| `Package`                 | `remote`, `local`                                                                                        |
| `SwiftPackageRequirement` | `exact`, `upToNextMajor`, `upToNextMinor`, `range`, `branch`, `revision`                                 |
| `Scheme`                  | `debug`, `release`                                                                                       |
| `RunScript`               | `shell`, `onInstall`                                                                                     |
| `PodBuildSettings`        | `forTarget`, `forTargetsStartingWith`, `forTargetsMatching`                                              |
| `AndroidDependency`       | `library`, `libraryExcluding`, `project`, `bom`                                                          |
| `AndroidComponent`        | `activity`, `service`, `receiver`, `provider`, `remove`                                                  |
| `AndroidFeature`          | `required`, `optional`, `openGlEs`                                                                       |
| `AndroidModule`           | `at`                                                                                                     |
| `MavenRepository`         | `url`, `scoped`, `private`                                                                               |
| `BuildConfigField`        | `string`, `boolean`, `int`, `raw`                                                                        |
| `ReplaceRule`             | `regex`, `literal`                                                                                       |

Named constants cover the strings that are otherwise copied from a search result: `Abi` (`arm64`, `armv7`, `x86`, `x64`, `all`), `AndroidPermission`, `AndroidHardware`, `AndroidApplication.attributes({ largeHeap: true })` (which writes the `android:` keys), and `XcodeBuildSettings.of({ … })` (which writes Xcode's names and turns booleans into `YES`/`NO` — the usual reason a hand-written build setting does nothing).

`BuildConfigField.string('CHANNEL', 'preview')` quotes the value for Gradle, and `ReplaceRule.literal` escapes its needle and defaults `required` to true, so a rule that stops matching after an SDK upgrade fails the build instead of disappearing.

The earlier standalone helpers (`shareExtension`, `widgetExtension`, `appClip`, `swiftPackage`, `localSwiftPackage`, `scheme`, `androidLibrary`, `androidFeature`) remain exported and behave exactly as before. None of these create Swift or Kotlin files.

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
pnpm exec expo-native-config validate --config config/native.json
pnpm exec expo-native-config plan --config config/native.json
```

Example `app.json` (merge these fields with your existing app):

```json
{
  "expo": {
    "name": "Example App",
    "slug": "example-app",
    "plugins": [["expo-native-config/plugin", { "configPath": "config/native.json" }]]
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
| `buildSettings`                            | Build settings on the **host app** target                               |
| `runScripts`                               | Shell-script build phases on the host app target                        |
| `resources`                                | App-root files copied beside the project and bundled with the app       |
| `podfileProperties`                        | `Podfile.properties.json` keys; the Expo-sanctioned Podfile channel     |
| `autolinkingExclude`                       | Expo modules excluded from `use_expo_modules!`                          |
| `podfile`                                  | Escape hatch: raw `postInstall`, `lines`, regex `replace`               |

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
| `metaData`                                         | `<meta-data>` entries on `<application>` — where most SDK keys live        |
| `components`                                       | `<activity>`/`<service>`/`<receiver>`/`<provider>` entries or removals     |
| `supportsScreens`                                  | `<supports-screens>` flags, e.g. `{ largeScreens: false }`                 |
| `manifestPlaceholders`, `buildConfigFields`        | `defaultConfig` entries                                                    |
| `abiFilters`                                       | `ndk.abiFilters` plus React Native's `reactNativeArchitectures`            |
| `mavenRepositories`, `flatDirs`                    | Extra repositories for every project                                       |
| `buildscriptDependencies`, `plugins`               | Root `classpath` coordinates and applied app plugins                       |
| `forceDependencies`                                | `resolutionStrategy.force` coordinates                                     |
| `modules`                                          | Local Gradle modules included from `settings.gradle`                       |
| `autolinkingExclude`                               | Expo modules excluded from Android autolinking                             |
| `strings`, `colors`, `styles`                      | Typed resource values through Expo's introspectable mods                   |
| `resources`                                        | Raw files under `app/src/main/res` (for resources with no typed mod)       |
| `gradle`                                           | Escape hatch: regex `replace` rules per Gradle file                        |
| `lint`                                             | Optional `checkReleaseBuilds` and `abortOnError` booleans                  |
| `signing`                                          | One of the two signing shapes described below                              |

See [recipes](recipes.md) for complete configurations and [templates](templates.md) for starter file contents.

## iOS targets

```ts
import { defineWorkspace, shareExtension, widgetExtension } from 'expo-native-config';
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

| Target field       | Meaning                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `name` (required)  | Unique target name, starting with a letter; then letters, digits, `_` or `-`                            |
| `type` (required)  | `share`, `widget`, `clip`, `notification-service`, `notification-content`, `intent`, `action`, `safari` |
| `bundleIdentifier` | Explicit ID or suffix such as `.share`; resolved IDs must be unique                                     |
| `source`           | Existing source directory inside the app root                                                           |
| `deploymentTarget` | Target override, then `ios.deploymentTarget`, then generator default `18.0`                             |
| `frameworks`       | Additional system framework names                                                                       |
| `entitlements`     | Plist-shaped entitlement values                                                                         |
| `buildSettings`    | String map of Xcode build settings                                                                      |
| `pods`             | Dependencies for this target, using the Pod shape below                                                 |

The host must define `expo.ios.bundleIdentifier` when targets are declared. `appClip({ name: 'Preview', source: './targets/Preview', bundleIdentifier: '.clip' })` declares an App Clip; you supply its native app sources and app-specific setup. There is currently no App Clip init preset.

Entitlements are plist-shaped values. App Groups are needed only when sharing a container or preferences with the host app. Register the group with Apple and set matching `com.apple.security.application-groups` entries on both the host Expo config and extension declaration. Do not add a fictitious group just to make a sample look complete.

## Swift packages and CocoaPods

`ios.packages` accepts remote and local package declarations:

```ts
import { swiftPackage } from 'expo-native-config';
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
import { scheme } from 'expo-native-config';
const development = scheme({ name: 'Development', configuration: 'Debug', archive: 'Release' });
```

Put schemes in `ios.schemes`. Optional `analyze` and `includeUnitTestTarget` control those actions. Use existing build configurations; naming a scheme does not create a new build configuration, bundle ID, environment, or signing profile. Keep Expo's scheme unless replacement is explicitly needed.

## Android

```ts
import { androidFeature, androidLibrary, defineWorkspace } from 'expo-native-config';
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

## Host app, resources and build phases

`ios.buildSettings` applies to the **host application** target; an extension's own settings stay on its target declaration. `ios.runScripts` adds shell-script build phases, matched by `name`, so a repeated prebuild updates the phase in place instead of appending a second copy.

```ts
const ios = {
  buildSettings: { LD_EXPORT_SYMBOLS: 'NO' },
  runScripts: [{ name: 'Upload dSYMs', script: './scripts/upload-dsyms.sh' }],
  resources: ['assets/notification.wav'],
};
```

`ios.resources` copies each app-root file next to the generated project and adds it to the host target's Resources phase. Files are addressed by basename, so two entries with the same filename are rejected.

## Safe Podfile configuration

`ios.podfileProperties` writes `Podfile.properties.json`, which the versioned Expo Podfile template reads. Expo documents this as the only safe channel for Podfile configuration, and it is visible to `expo config --type introspect`. Prefer it whenever the value you need has a property.

## Android manifest components and resources

```ts
const android = {
  metaData: { 'com.example.API_KEY': 'value' },
  components: [
    { kind: 'receiver', name: 'androidx.profileinstaller.ProfileInstallReceiver', remove: true },
    { kind: 'activity', name: '.CustomActivity', attributes: { 'android:exported': 'false' } },
  ],
  supportsScreens: { largeScreens: false },
  strings: { expo_custom_value: 'hello' },
};
```

`remove: true` emits `tools:node="remove"`, the supported way to drop a component a dependency merges in; the `tools` namespace is added to `<manifest>` automatically. `strings`, `colors` and `styles` go through Expo's own `withStringsXml` / `withAndroidColors` / `withAndroidStyles` mods, so they are introspectable — and `strings.xml` is the documented channel for values native code must read before the JS engine starts. Use `android.resources` only for resource files that have no typed mod, such as `xml/network_security_config.xml`.

## Android Gradle structure

```ts
const android = {
  mavenRepositories: ['https://jitpack.io'],
  buildscriptDependencies: ['com.google.gms:google-services:4.4.2'],
  plugins: ['com.google.gms.google-services'],
  forceDependencies: ['com.google.android.material:material:1.12.0'],
  modules: [
    { name: 'watermelondb-jsi', path: 'node_modules/@nozbe/watermelondb/native/android-jsi' },
  ],
  dependencies: [
    { project: 'watermelondb-jsi' },
    { platform: 'com.google.firebase:firebase-bom:33.1.0' },
  ],
  abiFilters: ['arm64-v8a'],
};
```

A dependency entry is a Maven coordinate (`module`, with optional `exclude`), a local Gradle module (`project`), or a BOM (`platform`). `modules` writes the `include` / `projectDir` pair into `settings.gradle`; `dependencies` still has to reference the module for it to be linked. `abiFilters` sets both `ndk.abiFilters` and `reactNativeArchitectures`, because React Native compiles per architecture from its own property and would otherwise still ship every ABI.

## Work that must run at startup

This package does not edit `AppDelegate` or `MainApplication`, and has no field that will. Expo provides supported hooks for exactly this, and they survive template changes that string surgery does not:

- **iOS** — an `ExpoAppDelegateSubscriber` in an Expo module receives the AppDelegate lifecycle without anyone editing the AppDelegate.
- **Android** — `ReactActivityLifecycleListener` and the application lifecycle listeners in `expo-modules-core` do the same, and `strings.xml` carries the values they read. That is why `android.strings` goes through Expo's own mod: a listener can read a string resource before the JS engine starts.

Create a local Expo module (`npx create-expo-module --local`), implement the listener or subscriber there, and declare its configuration with `android.strings`. A library that needs registering usually ships its own config plugin — register that in `expo.plugins` rather than reproducing what it does.

## Being told where a change belongs

Validation answers whether a config parses. A second pass answers whether the change belongs here at all, and reports it through `validate`, `plan` and `doctor`:

| Situation                                                                                | What you get                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `replace` rule whose pattern names `AppDelegate`, `MainApplication` or `MainActivity`  | **Error.** This package does not edit entry points, and a regular expression aimed at one is the same edit in disguise. The message names the supported hook. |
| `ios.podfile` setting `use_frameworks!`                                                  | Warning: `expo-build-properties` owns `ios.useFrameworks`, and whichever plugin runs last wins.                                                               |
| `android.resources` writing `values/strings.xml`, `colors.xml` or `styles.xml`           | Warning: use `android.strings` / `colors` / `styles`, which merge through Expo's own mod instead of replacing the file.                                       |
| `ios.buildSettings` setting a deployment target, bundle identifier or version            | Warning, naming the Expo config field or plugin that owns it.                                                                                                 |
| `android.gradleProperties` setting a key `expo-build-properties` or the Expo config owns | Warning, same.                                                                                                                                                |

A config that uses the supported field for each change produces none of these.

## Escape hatches

`ios.podfile` (`postInstall`, `lines`, `replace`) and `android.gradle` (`app`, `project`, `settings` replace rules) edit generated Ruby and Groovy directly. Expo's plugin guidance is explicit that regular-expression rewrites of generated code are a last resort: they break silently when the template changes between SDK versions. They exist because real apps need them — repointing a vendor plugin's hardcoded `node_modules` path in a monorepo has no static equivalent — and every such operation is reported with `risk: "escape-hatch"`, listed by `plan --verbose`, and warned about by `doctor`.

Reach for a typed field first, `ios.podfileProperties` or `android.strings` second, and an escape hatch only when neither can express the change. Re-verify every escape hatch after an Expo SDK upgrade.

## Removing a declaration

Every generated block carries a tag. Deleting a declaration from the config emits a removal operation for its tag, so the block disappears on the next prebuild without `--clean`. These cleanup operations are hidden from `plan` unless `--verbose` is passed. Two things are still not reversible this way: entries merged into structured files (a `gradle.properties` key, a manifest permission) stay until a clean prebuild, and an escape-hatch `replace` cannot be undone at all, because a regular expression has no inverse.

## Scope and unsupported inputs

The public schema rejects unknown fields. Config files themselves are executable trusted project code, not safely sandboxed data. Prefer a typed capability and a focused regression test when adding first-party support.

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
