# Getting started

A step-by-step path from an existing Expo app to a native change you declared and verified. Each step says what to run, what you should see, and what would mean it went wrong.

Already have config plugins you want to replace? Do [step 1](#step-1-install-the-package), then jump to [migrating an existing app](migrate.md) and come back at [step 5](#step-5-review-the-plan).

In a monorepo, run every command from the app package and read [monorepos](monorepos.md) first — the one rule is that the config lives beside `app.json`, never at the workspace root.

## Before you start

- An existing Expo app. This package does not create one, and `init` will not register its own plugin for you.
- Node.js 22.14 or newer for the CLI.
- Expo SDK 50–57. `doctor` errors below 50 and warns above 57.
- For native builds: Xcode for iOS, JDK 17 and the Android SDK for Android. You do not need either for steps 1–5.

Expo Go cannot host custom native targets or newly linked native dependencies. Anything below needs a development build.

## Step 1: install the package

Not published to npm yet. Pack it from a checkout of this repository:

```sh
pnpm install
pnpm build
pnpm --filter expo-native-config pack --pack-destination /tmp
```

Then install the tarball in your app, with your app's package manager:

```sh
pnpm add /tmp/expo-native-config-0.1.0.tgz
```

A tarball install matters even when a workspace link would be convenient: linking hides missing package files and undeclared dependencies until someone else installs it.

**Check:** `pnpm exec expo-native-config --version` prints a version.

## Step 2: create a config

```sh
pnpm exec expo-native-config init --template minimal --yes
```

That writes `workspace.config.ts` and nothing else:

```ts
import { defineWorkspace } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
});
```

An almost-empty config is the expected result of `minimal` — it is a starting point you compose, not a broken run. The five templates and the files each one writes are in [templates](templates.md); pick a source-bearing one (`share-extension`, `widget`, `lifecycle-module`) if you want working native source to edit.

`init` refuses to overwrite an existing config, and it is not a merge command. Run it once.

**Check:** `workspace.config.ts` exists in the app root, beside `app.json`.

## Step 3: register the plugin

This is the step people skip, and skipping it means prebuild silently applies nothing.

Add `expo-native-config/plugin` **last** in your existing plugins array, preserving what is already there:

```json
{
  "expo": {
    "plugins": ["expo-router", "expo-native-config/plugin"]
  }
}
```

With a dynamic config, append instead of replacing:

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Example App',
  slug: config.slug ?? 'example-app',
  plugins: [...(config.plugins ?? []), 'expo-native-config/plugin'],
});
```

Register it in one place only — static or dynamic, never both. Do not add `expo-router` because it appears above; that example exists to show an existing entry surviving.

Keep your existing `name`, `slug`, `bundleIdentifier` and package name where they are. `app.json` owns app identity; `workspace.config.ts` owns native structure. If you are declaring a share or widget target, `expo.ios.bundleIdentifier` must be set, for example `com.example.app`.

**Check:** your Expo config's plugins array contains `expo-native-config/plugin`.

Nothing verifies this for you — `doctor` checks your Node version, your Expo SDK and your declarations, not whether the plugin is registered. An unregistered plugin produces a valid config, a clean `plan`, and a prebuild that applies none of it. If a later step generates nothing, come back here first.

## Step 4: declare something

Edit `workspace.config.ts`. Start from a [sample app](../apps) or a [recipe](recipes.md); the [configuration reference](configuration.md) documents every field, path base and validation boundary.

```ts
import { defineWorkspace, Target } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [Target.share({ name: 'ShareExtension', bundleIdentifier: '.share' })],
  },
});
```

Declaring a target does not write its Swift source. Outside `init`, that source is yours to provide — an extension with no implementation compiles into an extension that does nothing.

**Check:**

```sh
pnpm exec expo-native-config validate
```

Prints `✓ validate`. A schema error here names the exact field, and is much cheaper than finding the same mistake during a native build.

## Step 5: review the plan

```sh
pnpm exec expo-native-config plan
```

Every line is one operation with an ID and the config field it came from:

```
✓ Native intent plan — workspace.config.ts
  target:ShareExtension:infoPlist  target:ShareExtension:Info.plist
  target:podfileLoader             targetsPodfileLoader
  target:all                       targets
  xcode.embedCycle                 fixEmbedCycle
4 declared operations. Preview only; native state is not compared.
```

Useful flags:

- `--verbose` adds each operation's kind, source field and desired state, and shows cleanup operations that remove blocks a previous config left behind.
- `--json` gives the same result for scripts and CI.
- `explain --id <operation-id>` explains one operation from the list.

A plan is intent. It does not diff the existing native project, and it does not prove a native build succeeds.

```sh
pnpm exec expo-native-config doctor
```

`doctor` adds environment checks and warns about escape hatches — declarations that rewrite generated Ruby, Groovy or entry-point source. Expo's own guidance treats those as a last resort because they break silently across SDK upgrades, so a warning here is worth reading rather than clearing.

**Check:** the operation list matches what you meant to declare. Nothing extra, nothing missing.

## Step 6: generate the native projects

```sh
pnpm exec expo prebuild --platform ios --no-install
```

Use `--platform android` for Android. Add `--clean` when you want to regenerate from scratch; preserve manual native edits first, because a clean prebuild discards them.

**Check:** open the generated files the plan named and confirm your change is there, inside a tagged block. Repeating prebuild should update that block, not add a second copy.

## Step 7: build and exercise it

```sh
pnpm exec expo run:ios      # or: expo run:android
```

Installing a JavaScript package or restarting Metro does not apply native changes to an already installed app — you need a new native build.

**Check:** the feature works on a device or simulator. This is the only step that establishes native compilation and runtime behavior; steps 4–6 establish that your declarations are valid, inspectable and applied.

## Removing a declaration

Delete the field. Each generated block is tagged, so a generator whose declaration disappeared emits a removal operation for its tag, and `plan --verbose` lists it under cleanup.

Removal is not a promise to reverse every artifact a previous prebuild produced. For managed projects, regenerating from a clean native project is the reference approach — after preserving any manual edits.

## Automation and exit codes

Inspection commands accept `--project <directory>`, `--config <file>`, `--json` and `--verbose`. `doctor --ci` runs the same diagnostics without a terminal. `init` and `migrate` need `--yes` or `--dry-run` respectively when there is no interactive terminal.

| Exit code | Meaning                                    |
| --------- | ------------------------------------------ |
| 0         | Success                                    |
| 1         | Invalid configuration or command arguments |
| 2         | Unexpected tool failure                    |

JSON failure output carries `valid: false` and a `diagnostics` array. Check the exit code as well as parsing the JSON — an unreadable config and an invalid one are different problems.

`--config <file>` selects a custom filename, and must be set in **both** the CLI and the Expo plugin, or the two will read different files.

## If something is wrong

| Symptom                                                           | Likely cause                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Prebuild runs but nothing changed                                 | Plugin not registered — [step 3](#step-3-register-the-plugin)        |
| `Workspace config not found`                                      | No config in the app root, or you are in the wrong directory         |
| `Cannot load …: Install expo-native-config in this project first` | Config imports the package, package not installed in this app        |
| Duplicate blocks after prebuild                                   | Two copies of `@expo/config-plugins` — see [monorepos](monorepos.md) |
| Target source rejected                                            | Extension source must stay inside the app package                    |

[Troubleshooting](troubleshooting.md) has the longer list. The repository samples pin their prebuild template explicitly; use their `pnpm prebuild` scripts rather than a bare `expo prebuild`, and see [compatibility](compatibility.md) for why.

## Next

- [Migrating an existing app](migrate.md) — turn config plugins into declarations
- [iOS targets](targets.md) — inline, discovered, by path, by package
- [Monorepos](monorepos.md) — pnpm, yarn, bun and npm workspaces
- [Configuration reference](configuration.md) — every field
- [Recipes](recipes.md) — twelve complete configurations
