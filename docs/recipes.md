# Configuration recipes

Each TypeScript example below is a complete `workspace.config.ts`. Adapt identifiers, versions, and paths to your app. These configurations declare native integration; they do not supply application behavior. Register the plugin as shown in [getting started](getting-started.md), and use the [field reference](configuration.md) for all supported options.

## Share and widget with shared storage

Create both native source directories first, using the [share](../apps/share-extension) and [widget](../apps/widget) samples as references:

```text
mobile/
  app.json
  workspace.config.ts
  targets/
    Share/ShareViewController.swift
    Widget/WorkspaceWidget.swift
```

Merge this host configuration into `app.json`. The group is an example identifier: replace it with a group registered for your app and signing team.

```json
{
  "expo": {
    "name": "Example App",
    "slug": "example-app",
    "ios": {
      "bundleIdentifier": "com.example.app",
      "entitlements": {
        "com.apple.security.application-groups": ["group.com.example.app"]
      }
    },
    "plugins": ["expo-native-workspace/plugin"]
  }
}
```

```ts
import { defineWorkspace, shareExtension, widgetExtension } from 'expo-native-workspace';

const entitlements = {
  'com.apple.security.application-groups': ['group.com.example.app'],
};

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    deploymentTarget: '18.0',
    targets: [
      shareExtension({ name: 'Share', bundleIdentifier: '.share', entitlements }),
      widgetExtension({ name: 'Widget', bundleIdentifier: '.widget', entitlements }),
    ],
  },
});
```

The resulting identifiers are `com.example.app.share` and `com.example.app.widget`. Matching entitlements permit shared-container access; your native implementation must still read/write that container and refresh the widget. Without shared storage, omit the group from both host and extensions. Keep share activation rules in the target's custom `Info.plist`.

## Local native dependencies

```text
mobile/
  workspace.config.ts
  native/
    WorkspaceMath/Package.swift
    WorkspaceMath/Sources/WorkspaceMath/WorkspaceMath.swift
    WorkspaceGreeting/WorkspaceGreeting.podspec
    WorkspaceGreeting/Sources/WorkspaceGreeting.swift
  ios/  (generated)
```

```ts
import { defineWorkspace, localSwiftPackage } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    packages: [localSwiftPackage({ path: '../native/WorkspaceMath', products: ['WorkspaceMath'] })],
    pods: [{ pod: 'WorkspaceGreeting', path: '../native/WorkspaceGreeting' }],
  },
});
```

These paths start at generated `ios/`, so `../native` points to the app's source-controlled `native/` directory. The package product and pod names must match their definitions. This links native code; JavaScript access requires a native module. The [native dependencies sample](../apps/native-dependencies) contains the package and pod implementations.

## Schemes, Xcode environment, and scoped pod settings

```ts
import { defineWorkspace, scheme } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    schemes: [
      scheme({ name: 'Example Debug', configuration: 'Debug', archive: 'Release' }),
      scheme({ name: 'Example Release', configuration: 'Release', analyze: 'Release' }),
    ],
    xcode: { env: { exports: { NATIVE_LOG_LEVEL: 'info' } } },
    podBuildSettings: [
      {
        target: 'WorkspaceGreeting',
        configurations: ['Debug'],
        settings: { SWIFT_OPTIMIZATION_LEVEL: '-Onone' },
      },
    ],
  },
});
```

This creates named schemes using existing Debug/Release configurations. It does not create another bundle ID or a staging environment. The sample environment variable only has an effect if your build scripts read it. Pod rules apply to matching installed pods; a rule does not install its target dependency.

## Android package visibility and optional camera hardware

```ts
import { defineWorkspace, androidFeature, androidLibrary } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  android: {
    permissions: ['android.permission.CAMERA'],
    features: [androidFeature('android.hardware.camera', false)],
    queries: {
      intents: [
        { action: 'android.intent.action.VIEW', scheme: 'geo' },
        { action: 'android.intent.action.VIEW', scheme: 'https' },
      ],
      packages: ['com.example.companion'],
    },
    dependencies: [androidLibrary('androidx.collection:collection-ktx:1.4.5')],
    gradleProperties: { 'org.gradle.parallel': true },
    applicationAttributes: { 'android:supportsRtl': 'true' },
  },
});
```

Use the companion application's actual package name. Queries enable discovery, permissions declare requested access, and `required: false` avoids making camera hardware mandatory. Your app must still request runtime camera permission and handle denial; the [Android manifest sample](../apps/android-manifest) demonstrates that flow.

## Local signing with EAS-managed credentials in cloud builds

```ts
import { defineWorkspace } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  android: {
    signing:
      process.env.EAS_BUILD === 'true'
        ? undefined
        : { propertiesFile: 'codesign/release.properties', optional: true },
  },
});
```

Keep `codesign/release.properties` and its keystore out of version control. The properties file needs `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`; a relative keystore path is relative to that file. Optional absence permits debug builds, but release tasks require valid release signing. This recipe assumes EAS credentials are separately configured; it does not create them. See the [signing reference](configuration.md#android-release-signing) for the environment-reference alternative and generated-secret behavior.

## Inspect from a monorepo root

These commands select the Expo app explicitly:

```sh
pnpm --dir apps/mobile exec expo-native-workspace validate
pnpm --dir apps/mobile exec expo-native-workspace plan --json
pnpm --dir apps/mobile exec expo-native-workspace doctor --ci
```

For a CLI available in the root workspace, the equivalent project selection is:

```sh
pnpm exec expo-native-workspace plan --project apps/mobile --verbose
```

Copy a real operation ID from that plan into `explain --id <operation-id>`. After reviewing the plan, run prebuild from the app directory, then compile and exercise the changed feature. See [verification](verification.md) for the checks actually performed on this repository.

## Push notifications with a Notification Service Extension

A rich-push provider needs its own extension target. Create `targets/Notify/NotificationService.swift` with a `UNNotificationServiceExtension` subclass first.

```ts
import { defineWorkspace, notificationServiceExtension } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      notificationServiceExtension({
        name: 'Notify',
        bundleIdentifier: '.notify',
        entitlements: {
          'com.apple.security.application-groups': ['group.com.example.app'],
        },
      }),
    ],
    resources: ['assets/notification.wav'],
  },
});
```

The generated Info.plist points `NSExtensionPrincipalClass` at `$(PRODUCT_MODULE_NAME).NotificationService`; rename the class or the plist key together. `ios.resources` copies the sound file next to the generated project and bundles it with the host app. Register the App Group on both host and extension, and configure the provider's payload separately.

## A vendor pod that hardcodes a `node_modules` path

Some third-party plugins write `:path => '../node_modules/<package>'` into the Podfile, which resolves to nothing in a pnpm or Yarn workspace where the package is hoisted. The config file is ordinary TypeScript, so resolve the real path and repoint the line:

```ts
import path from 'node:path';
import { defineWorkspace } from 'expo-native-workspace';

const vendorPod = path.dirname(require.resolve('clevertap-react-native/package.json'));

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    podfile: {
      replace: [
        {
          find: String.raw`:path\s*=>\s*['"]\.\.(\/\.\.)*\/node_modules\/clevertap-react-native['"]`,
          replacement: `:path => '${vendorPod}'`,
          all: true,
          required: true,
        },
      ],
    },
  },
});
```

This is an escape hatch: `plan` and `doctor` flag it, and it must be re-checked after an Expo SDK upgrade or a vendor plugin update. `required: true` turns "the pattern no longer matches" into a build failure instead of a silently missing fix — which matters, because the plugin that writes the line must run _before_ this one.

## Excluding an autolinked module

A package whose config plugin is auto-discovered but whose native dependency is disabled will break `pod install` and Gradle configuration. Exclude it on both platforms:

```ts
export default defineWorkspace({
  schemaVersion: 1,
  ios: { autolinkingExclude: ['@clevertap/clevertap-expo-plugin'] },
  android: { autolinkingExclude: ['@clevertap/clevertap-expo-plugin'] },
});
```

iOS rewrites a bare `use_expo_modules!` into `use_expo_modules!(exclude: [...])` and leaves an existing argument list alone; Android sets `expoAutolinking.exclude` before `useExpoModules()`.

## A local Android library module with JSI registration

```ts
export default defineWorkspace({
  schemaVersion: 1,
  android: {
    modules: [
      { name: 'watermelondb-jsi', path: 'node_modules/@nozbe/watermelondb/native/android-jsi' },
    ],
    dependencies: [{ project: 'watermelondb-jsi' }],
    mainApplication: {
      imports: ['import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage'],
      onCreate: ['packages.add(WatermelonDBJSIPackage())'],
    },
  },
});
```

`modules` writes the `include` and `projectDir` pair into `settings.gradle`; the dependency entry links it into the app module. The `mainApplication` lines are injected into a tagged block, so a repeated prebuild replaces them rather than stacking copies — but they are your own Kotlin, and nothing checks that they compile. Where the library offers a `ReactActivityLifecycleListener`, prefer that plus `android.strings` over injection.

## Trimming ABIs and keeping React Native in step

```ts
export default defineWorkspace({
  schemaVersion: 1,
  android: {
    abiFilters: ['arm64-v8a'],
    buildConfigFields: [{ type: 'String', name: 'BUILD_CHANNEL', value: '"preview"' }],
    manifestPlaceholders: { appAuthRedirectScheme: 'com.example.app' },
  },
});
```

One declaration sets `defaultConfig.ndk.abiFilters` _and_ `reactNativeArchitectures`. Setting only the Gradle block leaves React Native compiling and packaging every architecture, so the APK does not actually shrink. Keep all four ABIs for Play Store builds that rely on per-device splits.

## Firebase-style Gradle wiring

```ts
export default defineWorkspace({
  schemaVersion: 1,
  android: {
    mavenRepositories: ['https://jitpack.io'],
    buildscriptDependencies: ['com.google.gms:google-services:4.4.2'],
    plugins: ['com.google.gms.google-services'],
    dependencies: [
      { platform: 'com.google.firebase:firebase-bom:33.1.0' },
      { module: 'com.google.firebase:firebase-analytics' },
    ],
    forceDependencies: ['com.google.android.material:material:1.12.0'],
  },
});
```

Point `expo.android.googleServicesFile` at your `google-services.json` in the Expo config; this package wires the plugin, not the credentials file. `forceDependencies` resolves the version conflicts that surface when two libraries pull incompatible copies of the same artifact.
