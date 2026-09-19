# Native Workarounds

Every declaration in [`workspace.config.ts`](workspace.config.ts) replaces a config plugin that would otherwise be hand-written, reviewed and maintained per app. This sample exists to show the two forms side by side.

The point is not that the plugin file was long. It is that the plugin file was **untyped, unplanned and unverified**: nothing told you it ran, nothing told you what it would change before it changed it, and nothing told you when an SDK upgrade stopped it from matching.

## Before and after

### A pod that breaks under static frameworks

```ts
// before — src/plugins/withPodBuildSetting.ts, registered in app.config.ts
const withPodBuildSetting: ConfigPlugin = (config) =>
  withPodfile(config, (podfileConfig) => {
    const { contents } = podfileConfig.modResults;
    if (contents.includes(MARKER)) return podfileConfig; // idempotency, by hand
    const postInstall = 'post_install do |installer|';
    if (!contents.includes(postInstall)) throw new Error('no post_install hook to patch');
    podfileConfig.modResults.contents = contents.replace(postInstall, `${postInstall}\n${PATCH}`);
    return podfileConfig;
  });
```

```ts
// after
podBuildSettings: [
  PodBuildSettings.forTargetsStartingWith('WorkspaceSample', {
    CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES: 'YES',
  }),
],
```

### A local Android library module

```ts
// before — three mods that must agree with each other
withSettingsGradle(config, (mod) => {
  mod.modResults.contents += `\ninclude ':workspace-native-lib'\nproject(…).projectDir = …\n`;
  return mod;
});
withAppBuildGradle(config, (mod) => {
  mod.modResults.contents = mod.modResults.contents.replace(
    /dependencies\s*\{/,
    `dependencies {\n    implementation project(':workspace-native-lib')`,
  );
  return mod;
});
withMainApplication(config, (mod) => {
  /* string surgery on generated Kotlin, in two languages, idempotent by hand */
});
```

```ts
// after
modules: [AndroidModule.at('workspace-native-lib', 'native/workspace-native-lib')],
dependencies: [AndroidDependency.project('workspace-native-lib')],
mainApplication: {
  imports: ['import dev.exponativeconfig.workarounds.lib.WorkspaceGreeting'],
  onCreate: ['Log.i(WorkspaceGreeting.TAG, WorkspaceGreeting.greeting())'],
},
```

### A receiver a dependency merges into every manifest

```ts
// before
withAndroidManifest(config, (config) => {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
  app.receiver = [
    ...(app.receiver ?? []),
    { $: { 'android:name': 'androidx…ProfileInstallReceiver', 'tools:node': 'remove' } },
  ];
  return config; // and remember to add xmlns:tools to <manifest> yourself
});
```

```ts
// after
components: [
  AndroidComponent.remove('receiver', 'androidx.profileinstaller.ProfileInstallReceiver'),
],
```

### One ABI

```ts
// before — two files, and the second one is the one everybody forgets
withGradleProperties(config, (c) => {
  /* reactNativeArchitectures=arm64-v8a */
});
withAppBuildGradle(config, (c) => {
  /* defaultConfig { ndk { abiFilters 'arm64-v8a' } } */
});
```

```ts
// after — one declaration, both files
abiFilters: [Abi.arm64],
```

## What you get that a plugin file does not

|               | Hand-written plugin                             | Declaration                                                             |
| ------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Invalid input | Fails during prebuild, or silently does nothing | Fails validation before prebuild, naming the field                      |
| Preview       | None — run prebuild and read the diff           | `plan` lists every operation with its source field                      |
| Risk          | Invisible; a regex looks like a typed API       | Escape hatches are planned as `risk: "escape-hatch"` and `doctor` warns |
| Idempotency   | Each plugin reimplements its own marker check   | Tagged blocks; a repeated prebuild updates in place                     |
| Removal       | Delete the plugin, then `--clean` and hope      | Delete the declaration; the block is removed on the next prebuild       |

## Run it

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @expo-native-config/example-native-workarounds validate
pnpm --filter @expo-native-config/example-native-workarounds plan
pnpm --filter @expo-native-config/example-native-workarounds prebuild --no-install
```

`plan` is worth reading before the prebuild: it lists each operation, its source field, and warns about the three escape hatches this sample deliberately uses.

## What to inspect afterwards

| File                                              | What the config put there                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ios/Podfile`                                     | pod globals, scoped `post_install` build settings, a removed build phase, a raw hook, `use_expo_modules!(exclude: …)` |
| `ios/Podfile.properties.json`                     | `expo.jsEngine`, written through Expo's own mod rather than by rewriting Ruby                                         |
| `ios/*.xcodeproj/project.pbxproj`                 | `LD_EXPORT_SYMBOLS` on the app target and an install-only script phase                                                |
| `ios/NativeWorkarounds/AppDelegate.swift`         | the injected line, inside a tagged block                                                                              |
| `android/settings.gradle`                         | the local module include and `expoAutolinking.exclude`                                                                |
| `android/build.gradle`                            | JitPack, a scoped repository, a buildscript classpath and a forced version                                            |
| `android/app/build.gradle`                        | `ndk.abiFilters`, a manifest placeholder, a BuildConfig field, the module dependency                                  |
| `android/app/src/main/AndroidManifest.xml`        | `<meta-data>`, merged `.MainActivity` attributes, the removed receiver, `<supports-screens>`, `<queries>`             |
| `android/app/src/main/res/`                       | `workspace_sample_value`, `workspace_sample_accent`, the network security config                                      |
| `android/app/src/main/java/**/MainApplication.kt` | the injected import and `onCreate` line                                                                               |

## Compiling it

```sh
cd android
./gradlew :app:assembleDebug
```

Needs a JDK and the Android SDK. This compiles the local Gradle module and the injected Kotlin, which is what proves those two declarations produce real source rather than matching text. The iOS host app additionally needs `pod install`; the sample is not set up for signing, and interactive behavior is not verified by any of the above.

## The escape hatches here are deliberate

Three declarations in this sample rewrite generated code: the raw `post_install` lines, the Podfile `replace` rule, and both entry-point injections. Expo's plugin guidance is explicit that regular-expression rewrites of generated files are a last resort, because they break silently when the template changes between SDK versions.

They are included because real apps need them, and because seeing them flagged is the point: `plan` and `doctor` name each one so it can be re-checked after an SDK upgrade. The `replace` rule here is the monorepo path fix and intentionally matches nothing in this sample, which is why it sets `required: false`. In a real app it must be `required: true`, or the day the vendor changes that line, the build quietly loses the fix.
