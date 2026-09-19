# Getting started

## Use the unpublished package

In this repository:

```sh
pnpm install
pnpm build
pnpm --filter expo-native-config pack --pack-destination /tmp
```

Install the generated tarball into an existing Expo app using its package manager. A tarball test matters: workspace linking can conceal missing package files and undeclared dependencies. `pnpm pack:check` exercises a fresh consumer automatically.

From the app directory, install the tarball first (replace the filename with the version you packed):

```sh
pnpm add /tmp/expo-native-config-0.1.0.tgz
```

Choose a starter for this existing Expo app:

```sh
pnpm exec expo-native-config init --template minimal --yes
pnpm exec expo-native-config validate
pnpm exec expo-native-config plan
pnpm exec expo-native-config doctor
```

`minimal` creates only a config, `share-extension` adds a Swift share controller, `widget` adds a static WidgetKit starter, and `android` demonstrates camera permission plus optional hardware. These are starting points that can be combined in the same config, not the full feature list. See [template selection and generated files](templates.md) before choosing; init refuses to overwrite an existing config.

Register the plugin once at the end of the existing Expo `plugins` array. For example, an app that already uses `expo-router` keeps that entry:

```json
{
  "expo": {
    "plugins": ["expo-router", "expo-native-config/plugin"]
  }
}
```

Do not add `expo-router` just for this package; the example illustrates preserving an existing plugin. Keep existing name, slug, bundle identifier, package name and other Expo fields. For share/widget targets, ensure `expo.ios.bundleIdentifier` is set (for example `com.example.app`).

With a dynamic `app.config.ts`, preserve the input and append the plugin instead:

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Example App',
  slug: config.slug ?? 'example-app',
  plugins: [...(config.plugins ?? []), 'expo-native-config/plugin'],
});
```

Use either static or dynamic registration; do not register it in both. If your existing dynamic config already builds a plugin array, append there. The plugin reads `workspace.config.ts` from the app root. Treat config files as executable code: only load trusted projects.

## Add native capabilities

Author configuration with the public helpers and source-control extension sources. Start from the complete [sample apps](../apps), or adapt a [configuration recipe](recipes.md). The [manifest reference](configuration.md) explains every section, path base, helper, and validation boundary. A declared target alone does not supply its application behavior.

```sh
pnpm exec expo-native-config plan
pnpm exec expo prebuild --platform ios --no-install
```

Use `--platform android` for Android. Review the generated native files, then run `pnpm exec expo run:ios` or `pnpm exec expo run:android` on a machine with the relevant toolchain. Installing a JavaScript package or running Metro does not apply native changes to an already installed app. Expo Go cannot host custom native targets or newly linked native dependencies.

## Inspect the CLI

Run `pnpm exec expo-native-config --help` for the installed version's flags. `explain --id <operation-id>` explains an operation from `plan`. `completion bash`, `completion zsh`, and `completion fish` generate shell completion output; inspect the output before installing it in your shell setup.

Preserve manual edits before clean prebuild. The plugin applies desired declarations, but removing a declaration does not promise automatic removal of every previously generated artifact. Regeneration from a clean native project is the reference approach for managed projects.

## Automation and exit codes

Inspection commands accept `--project <directory>`, `--config <file>`, `--json`, and `--verbose`. `doctor --ci` uses the same diagnostics and exit codes without requiring interaction. `init` needs `--yes` when run without an interactive terminal. Unknown operation IDs make `explain` fail.

Successful commands exit zero; invalid configuration or command arguments exit one; unexpected tool failures exit two. JSON failure output has `valid: false` and diagnostics. Validate the exit code as well as consuming the JSON result. `doctor` checks configuration and the installed environment; it does not prove CocoaPods, Gradle, Xcode, or device-signing success.

The repository samples use catalog dependency references and pin their native template explicitly. Run their `pnpm prebuild` scripts rather than replacing them with an unqualified Expo prebuild command; see [compatibility](compatibility.md). Existing apps with ordinary versioned Expo dependencies should use the template appropriate to their installed SDK.
