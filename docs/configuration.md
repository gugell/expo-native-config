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

Android settings also cover SDK versions, build tools, NDK, Kotlin, and signing. Prefer Expo's defaults unless a dependency requires a change. Signing credentials should use environment references and must not be committed. Sample apps deliberately use ordinary debug signing defaults.

## Scope and unsupported inputs

The public schema rejects unknown fields, including arbitrary patch declarations. Prefer a typed capability and a focused regression test when adding first-party support. Config files themselves are executable trusted project code, not safely sandboxed data.

Signing uses `{ storeFile, keyAlias, storePassword: { env: 'STORE_PASSWORD' }, keyPassword: { env: 'KEY_PASSWORD' } }`. Both environment references are required when signing is configured. Resolve credentials only in the authorized build environment.
