# Configuration reference

The app-root `workspace.config.ts` default-exports `defineWorkspace({ schemaVersion: 1, ... })`. The published TypeScript declarations and runtime schemas are the authoritative field definitions. Invalid inputs should be fixed before prebuild. Import only from `expo-native-workspace`, never internal engine paths.

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

Remote requirements support exact version, next major/minor, version range, branch, and revision forms. Prefer reviewed versions or revisions for reproducibility. An optional `target` names one or several Xcode targets. `podTarget` attaches products to CocoaPods targets through generated Podfile integration. Local paths resolve from generated `ios/`, not the config directory.

`ios.pods` accepts `{ pod: 'WorkspaceGreeting', path: '../native/WorkspaceGreeting' }` for local pods or version/git declarations for remote pods. An extension can use its own `pods` array. A linked library is not automatically a JavaScript-accessible native module.

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

`androidLibrary(module, configuration)` defaults to `implementation`. `androidFeature(name, required)` defaults to required. Optional hardware avoids unnecessarily excluding devices. Declaring a permission does not grant runtime access; request dangerous permissions at runtime.

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
