---
name: expo-native-workspace
description: Configure native iOS targets, dependencies, schemes, and Android settings in Expo apps that use expo-native-workspace.
---

Read the app's Expo config and installed package version first. Run the installed CLI's `--help` rather than guessing flags. Work from the app root, not the monorepo root.

The config is `workspace.config.ts`, default-exporting `defineWorkspace({ schemaVersion: 1, ios: { ... }, android: { ... } })`. Import helpers from `expo-native-workspace`. Register `expo-native-workspace/plugin` in the existing Expo `plugins` array while preserving other entries.

Declarations can be plain objects or constructor calls; both validate identically and mix freely. Prefer constructors, which supply discriminants and defaults: `Target.share|widget|appClip|notificationService|notificationContent|intent|action|safari(spec)`, `Pod.local|version|git`, `Package.remote|local` with `SwiftPackageRequirement.exact|upToNextMajor|range|branch|revision`, `Scheme.debug|release`, `RunScript.shell|onInstall`, `PodBuildSettings.forTarget|forTargetsStartingWith|forTargetsMatching`, `AndroidDependency.library|libraryExcluding|project|bom`, `AndroidComponent.activity|service|receiver|provider|remove`, `AndroidFeature.required|optional|openGlEs`, `AndroidModule.at`, `MavenRepository.url|scoped|private`, `BuildConfigField.string|boolean|int|raw`, `ReplaceRule.regex|literal`.

Named constants replace copied strings: `Abi`, `AndroidPermission`, `AndroidHardware`, `AndroidApplication.attributes({ largeHeap: true })` (writes `android:` keys), `XcodeBuildSettings.of({ ldExportSymbols: false })` (writes Xcode names, booleans become `YES`/`NO`). The older flat helpers (`shareExtension`, `widgetExtension`, `swiftPackage`, `scheme`, `androidLibrary`, `androidFeature`) still work. Check the installed declarations for less common fields.

An extension spec needs a unique `name` and real native source. `source` resolves from the app root; `.share` as a bundle identifier appends to the host ID. Share activation rules belong in the source Info.plist. Widgets need a WidgetKit entry point. Add App Groups only for shared storage, consistently on host and extension.

`ios.packages` contains remote URL/requirement/products or local path/products declarations. `ios.pods` contains pod/path or remote version/git declarations. Local dependency paths resolve from generated `ios/`. Linking a library does not expose it to JavaScript.

Use `ios.minimumPodDeploymentTarget` to raise missing or lower CocoaPods deployment targets while preserving higher requirements; configure the host app target separately. `ios.podfileGlobals: { RNFirebaseAsStaticFramework: true }` supplies typed Ruby globals without executable snippets; configure static framework linkage separately. Keys omit `$` and values are primitive booleans, numbers, or literal strings.

For Android package visibility, use `android.queries: { intents: [{ action: 'android.intent.action.VIEW', scheme: 'geo' }], packages: ['com.waze'] }`. Each action/scheme pair gets its own intent. Existing queries and provider declarations are preserved, with duplicate entries removed. This enables discovery and does not grant permissions.

`ios.schemes` uses `{ name, configuration: 'Debug' | 'Release', archive? }`. Android uses typed dependencies, permissions, features, Gradle properties and application attributes. A manifest permission does not grant runtime permission.

## Choosing where a change belongs

Work down this list and stop at the first level that can express the change:

1. **Expo's own config** — `app.json` owns identity, host `infoPlist`, entitlements, `intentFilters`, `blockedPermissions`, `googleServicesFile`. `expo-build-properties` owns `useFrameworks`, host `deploymentTarget`, `packagingOptions`, ProGuard. Do not duplicate those here.
2. **A typed field of this package** — host `ios.buildSettings`, `ios.runScripts`, `ios.resources`, `ios.targets`, `ios.packages`, `ios.pods`, `ios.podBuildSettings`; `android.metaData`, `components`, `supportsScreens`, `manifestPlaceholders`, `buildConfigFields`, `abiFilters`, `mavenRepositories`, `buildscriptDependencies`, `plugins`, `forceDependencies`, `modules`, `dependencies`, `autolinkingExclude`.
3. **An introspectable value channel** — `ios.podfileProperties` (`Podfile.properties.json`) and `android.strings|colors|styles`. These go through Expo's own safe mods, so `expo config --type introspect` shows them without a prebuild. `strings.xml` is the documented way to pass values to native code that runs before the JS engine.
4. **Entry-point injection** — `ios.appDelegate` / `android.mainApplication` insert your own native lines into a replaceable tagged block. Nothing checks that they compile; prefer a library's `ReactActivityLifecycleListener` where one exists.
5. **Escape hatches** — `ios.podfile` (`postInstall`, `lines`, `replace`) and `android.gradle` replace rules rewrite generated Ruby/Groovy. Expo's guidance treats regex rewrites of generated code as a last resort; they break silently across SDK upgrades. Every one is planned with `risk: "escape-hatch"` and warned about by `doctor`. Set `required: true` so a rule that stops matching fails the build. Re-verify them after every SDK upgrade.

Deleting a declaration removes its generated block on the next prebuild. Entries merged into structured files (a `gradle.properties` key, a manifest permission) and escape-hatch replacements are not reversible that way and need a clean prebuild.

Debug the whole plugin stack with `EXPO_DEBUG=1 npx expo prebuild` (prints which mods ran, in order), `npx expo config --type prebuild` (resolved config, mods unevaluated) and `npx expo config --type introspect` (evaluates safe mods without writing).

Run `validate`, `plan`, and `doctor` through the app's package manager. Use `explain --id <operation-id>` to inspect an operation. Then run Expo prebuild for the relevant platform and inspect generated output. Config loading executes trusted project code; do not load unknown configs as if they were sandboxed data.

Preserve manual native edits before clean regeneration. A plan is not a complete native diff, and removing declarations does not guarantee stale artifact removal. Report prebuild separately from native compilation and device behavior. Custom native changes need a native development build, not Expo Go. Do not add signing secrets or publish anything merely to configure an app.

## Android signing

Use one signing source: environment references (`storeFile`, `keyAlias`, `storePassword: { env: 'STORE_PASSWORD' }`, `keyPassword: { env: 'KEY_PASSWORD' }`) or `signing: { propertiesFile: 'codesign/codesign.properties', optional: true }`. The latter references an app-root-relative private Java properties file containing `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`; a relative keystore path resolves beside that file. Gradle reads it in place, so do not copy or inspect credentials while configuring the app. Existing environment signing resolves secrets into generated Gradle properties during prebuild; treat that generated output as sensitive.

Optional missing properties allow debug builds; release tasks must receive complete, non-debug signing credentials. EAS can supply the effective release signing configuration, or the app can omit local signing when `EAS_BUILD` is `true` and let EAS own credentials. Do not assume ignored local credential files are uploaded. Preserve app-owned changes before clean regeneration when replacing a plugin that previously copied credentials into native output.

For CocoaPods-specific workarounds, use scoped `ios.podBuildSettings` and `ios.removePodBuildPhases` rules rather than editing the generated Podfile. Targets accept an exact name or `equals`/`startsWith`/`regex` predicates. Preserve existing CI scheme names, including spaces. Keep app identifiers, vendor-specific values and source paths in the consuming application's configuration, never in the CLI implementation.

## Manifest and starter examples

`workspace.config.ts` is distinct from Expo's `app.json` and generated AndroidManifest.xml. It has optional `schemaVersion: 1`, `ios`, and `android` sections, with no `expo` wrapper. Unknown fields fail validation. `defineWorkspace` provides authoring types; CLI/plugin loading performs runtime validation.

Choose one init preset only when no workspace config exists: `minimal` writes a config, `android` writes camera permission/optional hardware declarations, `share-extension` adds a placeholder Swift share controller, and `widget` adds a static WidgetKit source file. These are composable starting points, not feature restrictions. They do not install dependencies, register plugins, implement content persistence, or configure shared storage. Do not rerun init to add another capability; edit the existing config and supply source files.

Complete example after `init --template share-extension --yes`:

```ts
import { defineWorkspace, Scheme, Target } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [Target.share({ name: 'ShareExtension', bundleIdentifier: '.share' })],
    schemes: [Scheme.debug('Example Debug', { archive: 'Release' })],
  },
  android: {
    queries: { intents: [{ action: 'android.intent.action.VIEW', scheme: 'geo' }] },
  },
});
```

The source defaults to `targets/ShareExtension`; host `expo.ios.bundleIdentifier` is required. Local Swift packages and pods use paths relative to generated `ios/`, for example `{ path: '../native/WorkspaceMath', products: ['WorkspaceMath'] }` in `ios.packages`. Moving the workspace config does not change path bases.

Discovery checks `workspace.config.ts`, `.js`, `.cjs`, `.mjs`, and `.json` in order. For a custom path, pair CLI `--config config/native.json` with Expo plugin registration `['expo-native-workspace/plugin', { configPath: 'config/native.json' }]`. Keep other plugins and append this registration once. JSON uses ordinary objects, such as `{ name: 'Share', type: 'share' }`, instead of helper calls.
