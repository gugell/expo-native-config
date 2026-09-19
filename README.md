# Expo Native Workspace

Declare native project changes in `workspace.config.ts`, review a plan, and apply them through Expo prebuild.

## The idea

Every Expo app eventually needs a native change that `app.json` cannot express, and the answer is always the same: write a config plugin that does string surgery on a generated file.

```ts
// before — src/plugins/withPodBuildSetting.ts, plus a line in app.config.ts
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
// after — workspace.config.ts
podBuildSettings: [
  PodBuildSettings.forTargetsStartingWith('NativeMedia', {
    CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES: 'YES',
  }),
],
```

The difference is not length. The declaration is validated before prebuild runs, appears in `plan` with the field it came from, merges into a tagged block that a repeated prebuild updates instead of duplicating, and disappears from the native project when you delete it. A dozen of these plugins in one app is a normal amount; the [native-workarounds sample](apps/native-workarounds) shows that dozen as declarations, with the plugin each one replaces.

Where nothing typed can express a change, the escape hatches are still there — planned with `risk: "escape-hatch"`, listed by `plan --verbose` and warned about by `doctor`, because Expo's own guidance is that rewriting generated code breaks silently across SDK upgrades.

One package provides an Expo config plugin, a CLI, typed helpers, and agent skills. It supports iOS extensions (share, widget, App Clip, notification service/content, intent, action, Safari), Swift packages, CocoaPods, host-target build settings and build phases, Xcode schemes, Android Gradle structure (repositories, classpath, local modules, ABI filters, dependency resolution), Android manifest and resource entries, and — where nothing typed can express the change — explicitly flagged escape hatches.

**Release status:** this is an unpublished project prepared for release. Registry availability and ownership must be verified before advertising an npm install command. Use the local workspace or a packed tarball now.

## Try it locally

Repository development requires Node.js 24.11.1 or newer and pnpm 10.34.5. The published CLI supports Node.js 22.14 or newer. Native builds additionally need the platform toolchain.

```sh
pnpm install
pnpm build
pnpm --filter @expo-native-workspace/example-share-extension validate
pnpm --filter @expo-native-workspace/example-share-extension plan
pnpm --filter @expo-native-workspace/example-share-extension prebuild --platform ios --no-install
```

For an existing Expo app, pack the package with `pnpm --filter expo-native-workspace pack --pack-destination /tmp`, install the resulting `.tgz` using that app's package manager, and run `expo-native-workspace init --template minimal --yes` through the package manager. Register `expo-native-workspace/plugin` in your Expo config's `plugins` array. See [getting started](docs/getting-started.md).

```ts
import { defineWorkspace, Target } from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      Target.share({
        name: 'WorkspaceShare',
        source: './targets/WorkspaceShare',
        bundleIdentifier: '.share',
      }),
    ],
  },
});
```

Declarations can be written as plain objects or built with constructors — `Target.share(…)`, `AndroidDependency.project(…)`, `XcodeBuildSettings.of({ ldExportSymbols: false })` — which supply the discriminants, the Xcode and `android:` key names, and the defaults, so the config carries fewer magic strings. Both styles validate identically; JSON configs use the object form.

Run `expo-native-workspace validate`, `plan`, and `doctor` before `expo prebuild`. A plan describes intended operations; it does not compare every byte of the existing native project or prove that a native build succeeds.

The example expects `targets/WorkspaceShare/` to contain native sources. To generate a source-bearing starter instead, use `init --template share-extension --yes` in an app without an existing workspace config. See [all four starter presets](docs/templates.md) for exact files and remaining implementation work. Add Android settings, packages, or schemes to the same manifest as needed; templates do not restrict its capabilities.

## Samples

| App                                             | Demonstrates                                                    |
| ----------------------------------------------- | --------------------------------------------------------------- |
| [share-extension](apps/share-extension)         | UIKit share sheet with text and URL activation rules            |
| [widget](apps/widget)                           | A real SwiftUI / WidgetKit timeline widget                      |
| [native-dependencies](apps/native-dependencies) | Source-controlled Swift package and CocoaPod                    |
| [multi-scheme](apps/multi-scheme)               | Debug and Release Xcode schemes                                 |
| [android-gradle](apps/android-gradle)           | Typed Maven dependency and Gradle properties                    |
| [android-manifest](apps/android-manifest)       | Optional camera feature and runtime permission request          |
| [native-workarounds](apps/native-workarounds)   | The plugins apps hand-write, as declarations, with before/after |

## Documentation

- [Getting started](docs/getting-started.md) and [configuration reference](docs/configuration.md)
- [Templates: what they generate and why](docs/templates.md) and [complete configuration recipes](docs/recipes.md)
- [Architecture](docs/architecture.md) and [development rules](docs/development-rules.md)
- [Compatibility and verification limits](docs/compatibility.md) and [local verification record](docs/verification.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Release procedure](docs/releasing.md) and [launch guide](docs/launch-guide.md)
- [Agent skills](docs/agent-skills.md)

See [contributing](CONTRIBUTING.md), [security](SECURITY.md), and the [code of conduct](CODE_OF_CONDUCT.md). Licensed under [MIT](LICENSE).
