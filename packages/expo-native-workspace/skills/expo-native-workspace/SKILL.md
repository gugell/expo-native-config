---
name: expo-native-workspace
description: Configure native iOS targets, dependencies, schemes, and Android settings in Expo apps that use expo-native-workspace.
---

Read the app's Expo config and installed package version first. Run the installed CLI's `--help` rather than guessing flags. Work from the app root, not the monorepo root.

The config is `workspace.config.ts`, default-exporting `defineWorkspace({ schemaVersion: 1, ios: { ... }, android: { ... } })`. Import helpers from `expo-native-workspace`. Register `expo-native-workspace/plugin` in the existing Expo `plugins` array while preserving other entries.

Public helpers: `shareExtension(spec)`, `widgetExtension(spec)`, `swiftPackage(spec)`, `scheme(spec)`, `androidLibrary(module, configuration?)`, `androidFeature(name, required?)`. Check the installed declarations for less common fields.

An extension spec needs a unique `name` and real native source. `source` resolves from the app root; `.share` as a bundle identifier appends to the host ID. Share activation rules belong in the source Info.plist. Widgets need a WidgetKit entry point. Add App Groups only for shared storage, consistently on host and extension.

`ios.packages` contains remote URL/requirement/products or local path/products declarations. `ios.pods` contains pod/path or remote version/git declarations. Local dependency paths resolve from generated `ios/`. Linking a library does not expose it to JavaScript.

Use `ios.minimumPodDeploymentTarget` to raise missing or lower CocoaPods deployment targets while preserving higher requirements; configure the host app target separately. `ios.podfileGlobals: { RNFirebaseAsStaticFramework: true }` supplies typed Ruby globals without executable snippets; configure static framework linkage separately. Keys omit `$` and values are primitive booleans, numbers, or literal strings.

For Android package visibility, use `android.queries: { intents: [{ action: 'android.intent.action.VIEW', scheme: 'geo' }], packages: ['com.waze'] }`. Each action/scheme pair gets its own intent. Existing queries and provider declarations are preserved, with duplicate entries removed. This enables discovery and does not grant permissions.

`ios.schemes` uses `{ name, configuration: 'Debug' | 'Release', archive? }`. Android uses typed dependencies, permissions, features, Gradle properties and application attributes. A manifest permission does not grant runtime permission.

Run `validate`, `plan`, and `doctor` through the app's package manager. Use `explain --id <operation-id>` to inspect an operation. Then run Expo prebuild for the relevant platform and inspect generated output. Config loading executes trusted project code; do not load unknown configs as if they were sandboxed data.

Preserve manual native edits before clean regeneration. A plan is not a complete native diff, and removing declarations does not guarantee stale artifact removal. Report prebuild separately from native compilation and device behavior. Custom native changes need a native development build, not Expo Go. Do not add signing secrets or publish anything merely to configure an app.

## Android signing

Use one signing source: environment references (`storeFile`, `keyAlias`, `storePassword: { env: 'STORE_PASSWORD' }`, `keyPassword: { env: 'KEY_PASSWORD' }`) or `signing: { propertiesFile: 'codesign/codesign.properties', optional: true }`. The latter references an app-root-relative private Java properties file containing `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`; a relative keystore path resolves beside that file. Gradle reads it in place, so do not copy or inspect credentials while configuring the app. Existing environment signing resolves secrets into generated Gradle properties during prebuild; treat that generated output as sensitive.

Optional missing properties allow debug builds; release tasks must receive complete, non-debug signing credentials. EAS can supply the effective release signing configuration, or the app can omit local signing when `EAS_BUILD` is `true` and let EAS own credentials. Do not assume ignored local credential files are uploaded. Preserve app-owned changes before clean regeneration when replacing a plugin that previously copied credentials into native output.
