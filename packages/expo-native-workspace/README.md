# Expo Native Workspace

Typed native configuration for Expo SDK 56: iOS extensions, Swift packages, CocoaPods, Xcode schemes, Android Gradle and manifest settings.

This package is prepared for release; registry publication is not assumed. Install a locally packed `.tgz` until a real registry release is available. The CLI requires Node.js 22.14 or newer.

Register `expo-native-workspace/plugin` in the Expo config's `plugins` array. Create `workspace.config.ts` in the app root:

```ts
import { defineWorkspace, androidLibrary } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  android: {
    dependencies: [androidLibrary('androidx.collection:collection-ktx:1.4.5')],
  },
});
```

From the app directory, use your package manager to run:

```sh
pnpm exec expo-native-workspace validate
pnpm exec expo-native-workspace plan
pnpm exec expo-native-workspace doctor
pnpm exec expo prebuild --platform android
```

`init --template minimal|share-extension|widget|android --yes` scaffolds configuration. `explain --id <operation-id>` inspects a planned operation. `completion bash|zsh|fish` prints shell completion. Run `--help` for flags.

Public helpers include `defineWorkspace`, `shareExtension`, `widgetExtension`, `swiftPackage`, `scheme`, `androidLibrary`, and `androidFeature`. Extension declarations need real native source. Dependency paths resolve from generated `ios/`; extension source paths resolve from the app root. Plans describe intended operations, not a complete diff of native state. Removed declarations may require clean prebuild after preserving manual native changes.

Native compilation and device behavior need separate testing. Expo Go cannot host custom native targets. Config files execute code and must be trusted. Keep signing credentials in environment references.

Self-contained agent skills are bundled in `skills/expo-native-workspace` and `skills/expo-native-workspace-maintainer`. Copy the desired whole folder into your agent's configured skill directory after reviewing it.

The source repository contains complete sample apps and documentation. Confirm the repository URL in package metadata is publicly available before publication. MIT licensed.
