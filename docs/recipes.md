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
