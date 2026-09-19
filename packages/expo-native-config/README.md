# Expo Native Config

Typed native configuration for Expo SDK 56: iOS extensions, Swift packages, CocoaPods, Xcode schemes, Android Gradle and manifest settings.

This package is prepared for release; registry publication is not assumed. Install a locally packed `.tgz` until a real registry release is available. The CLI requires Node.js 22.14 or newer.

Register `expo-native-config/plugin` in the Expo config's `plugins` array. Create `workspace.config.ts` in the app root:

```ts
import { defineWorkspace, androidLibrary } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  android: {
    dependencies: [androidLibrary('androidx.collection:collection-ktx:1.4.5')],
  },
});
```

From the app directory, use your package manager to run:

```sh
pnpm exec expo-native-config validate
pnpm exec expo-native-config plan
pnpm exec expo-native-config doctor
pnpm exec expo prebuild --platform android
```

Choose one starter in an existing Expo app without a workspace config:

```sh
pnpm exec expo-native-config init --template minimal --yes
```

| Template          | Generated files                                             | Purpose                                                                  |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `minimal`         | `workspace.config.ts`                                       | Compose any supported capabilities yourself                              |
| `share-extension` | Config + `targets/ShareExtension/ShareViewController.swift` | Starting share controller; implement attachment handling and persistence |
| `widget`          | Config + `targets/WorkspaceWidget/WorkspaceWidget.swift`    | Static small WidgetKit widget; implement real data and refresh           |
| `android`         | Config with camera permission and optional camera feature   | Manifest example; implement runtime permissions and UI                   |

These four presets cover common starting points, not the package's full capability list. Init does not create an Expo app or register its plugin, and cannot merge into an existing config. Add packages, pods, schemes, Android settings, or more targets by editing the same config. App Clips are supported declarations without an init preset.

The workspace manifest has optional `schemaVersion: 1`, `ios`, and `android` fields, with no `expo` wrapper. `app.json` owns host identity and plugin registration. Preserve existing plugins and append this one:

```json
{
  "expo": {
    "name": "Example App",
    "slug": "example-app",
    "ios": { "bundleIdentifier": "com.example.app" },
    "plugins": ["expo-native-config/plugin"]
  }
}
```

For example, after initializing a share extension, its config can also declare Android visibility:

```ts
import { defineWorkspace, shareExtension } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [shareExtension({ name: 'ShareExtension', bundleIdentifier: '.share' })],
  },
  android: {
    queries: { intents: [{ action: 'android.intent.action.VIEW', scheme: 'geo' }] },
  },
});
```

Here `.share` appends to the host bundle ID, and omitted `source` means `targets/ShareExtension`. Declaring a target does not generate its source files outside init. `explain --id <operation-id>` inspects a planned operation. `completion bash` prints Bash completion; use `zsh` or `fish` for those shells. Run `--help` for flags.

Public helpers include `defineWorkspace`, `shareExtension`, `widgetExtension`, `appClip`, `swiftPackage`, `localSwiftPackage`, `scheme`, `androidLibrary`, and `androidFeature`. Extension declarations need real native source. Dependency paths resolve from generated `ios/`; extension source paths resolve from the app root. Plans describe intended operations, not a complete diff of native state. Removed declarations may require clean prebuild after preserving manual native changes.

Native compilation and device behavior need separate testing. Expo Go cannot host custom native targets. Config files execute code and must be trusted. Keep signing credentials in environment references or private properties files. Environment signing resolves secrets into generated Gradle properties during prebuild; protect that output.

Self-contained agent skills are bundled in `skills/expo-native-config` and `skills/expo-native-config-maintainer`. Copy the desired whole folder into your agent's configured skill directory after reviewing it.

The source repository contains complete sample apps and documentation. Confirm the repository URL in package metadata is publicly available before publication. MIT licensed.
