# Choosing an init template

An init template is a small starter preset for an **existing Expo app**. It writes `workspace.config.ts` and, for the two extension presets, a Swift source file. It does not create an Expo app, install dependencies, register the plugin, or generate native projects.

The current five presets cover an empty starting point, two source-bearing iOS capabilities, a small Android manifest example, and a local Expo module for startup work. They are not mutually exclusive product modes or the complete list of supported features. There is no `template` field in the resulting config. Swift packages, CocoaPods, schemes, signing, and App Clips are configured directly; they do not each need a separate initializer.

| Preset              | Choose it when                                                              | Files written                                               | Still yours to implement                                                |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `minimal` (default) | You want to compose your own capabilities or migrate existing configuration | `workspace.config.ts`                                       | Every desired declaration and any native source                         |
| `share-extension`   | You need a starting share-sheet controller                                  | Config + `targets/ShareExtension/ShareViewController.swift` | Activation rules, attachment handling, persistence/upload, host handoff |
| `widget`            | You need a starting WidgetKit implementation                                | Config + `targets/WorkspaceWidget/WorkspaceWidget.swift`    | Real timeline/data, refresh behavior, shared storage if needed          |
| `android`           | You want an example of permission + optional hardware declarations          | `workspace.config.ts`                                       | Runtime permission handling and camera UI                               |

Choose **one** command, from the app directory:

```sh
pnpm exec expo-native-config init --template minimal --yes
```

Or, in an app that does not already have a workspace config:

```sh
pnpm exec expo-native-config init --template share-extension --yes
```

The other choices are `--template widget`, `--template android` and `--template lifecycle-module`. `--yes` accepts file creation without an interactive prompt. Init refuses existing supported config filenames and existing destination source files. It is not a merge command: do not run several of them in the same app.

## Exact configuration shapes

The initializer wraps one of the following objects in `defineWorkspace(...)`, imports that helper, and default-exports the result. Formatting below is expanded for readability.

Minimal:

```ts
{
  schemaVersion: 1;
}
```

Share extension:

```ts
{
  schemaVersion: 1,
  ios: {
    targets: [{ name: 'ShareExtension', type: 'share', bundleIdentifier: '.share' }],
  },
}
```

Widget:

```ts
{
  schemaVersion: 1,
  ios: {
    targets: [{ name: 'WorkspaceWidget', type: 'widget', bundleIdentifier: '.widget' }],
  },
}
```

Android:

```ts
{
  schemaVersion: 1,
  android: {
    permissions: ['android.permission.CAMERA'],
    features: [{ name: 'android.hardware.camera', required: false }],
  },
}
```

The share Swift starter subclasses `SLComposeServiceViewController`. Its Post action only completes the extension request; it does not save or send content. The widget starter displays static text in a small widget and uses a `.never` timeline policy. Neither starter configures an App Group. The widget source uses `containerBackground`, so account for its API availability if lowering the generated target's default iOS deployment target of 18.0.

## Combining capabilities

Start once, then edit the same config. For example, after the share initializer, adding the Android section does not require another init command:

```ts
import { defineWorkspace, shareExtension } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [shareExtension({ name: 'ShareExtension', bundleIdentifier: '.share' })],
  },
  android: {
    permissions: ['android.permission.CAMERA'],
    features: [{ name: 'android.hardware.camera', required: false }],
  },
});
```

To add a widget as well, bring its source into `targets/WorkspaceWidget/` and add a `widgetExtension` declaration. The [widget sample](../apps/widget) provides source to study. Do not add a declaration pointing at a directory that does not exist.

## What to review after init

1. Confirm the config was created in the Expo app directory, not the monorepo root.
2. For iOS targets, set the host bundle ID, review target names/ID suffixes, and inspect every generated Swift file. Replace placeholder behavior and define appropriate share activation rules before shipping.
3. Keep native sources under version control. Choose App Groups only if the app actually exchanges data with an extension.
4. Register the plugin alongside existing plugins using [getting started](getting-started.md), then run `validate` and `plan`.
5. Prebuild and review native output. Compile and exercise the feature on its platform; successful init/validation is not a working feature test.

The seven [sample apps](../apps) are separate runnable examples with their own Expo setup. They demonstrate more than the five init presets: local dependencies and schemes are useful examples even though they require no special starter source generator. See [recipes](recipes.md) for additional combinations.

## Lifecycle module

`init --template lifecycle-module` writes a local Expo module under `modules/startup` plus a workspace config that feeds it:

| File                                                     | Purpose                                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/startup/expo-module.config.json`                | Registers the iOS subscriber through `apple.appDelegateSubscribers`                                                                                              |
| `modules/startup/android/.../StartupPackage.kt`          | A `BasePackage` returning an `ApplicationLifecycleListener`; the Gradle plugin puts it in the generated package list that `ApplicationLifecycleDispatcher` reads |
| `modules/startup/ios/StartupAppDelegateSubscriber.swift` | Runs from `didFinishLaunchingWithOptions` without touching the AppDelegate                                                                                       |
| `modules/startup/android/.../res/values/strings.xml`     | The default (empty) value                                                                                                                                        |
| `workspace.config.ts`                                    | `android.strings.startup_value`, which overrides that default at prebuild                                                                                        |

This is the supported alternative to editing a generated entry point, which this package does not do. Verified end to end on an SDK 57 app: after `expo prebuild` the string reaches the app's `strings.xml`, the Android project compiles, and `expo.modules.startup.StartupPackage()` appears in the generated package list. The iOS subscriber's registration is confirmed from the autolinking source; it was not compiled, which needs CocoaPods.
