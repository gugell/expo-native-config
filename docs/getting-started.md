# Getting started

## Use the unpublished package

In this repository:

```sh
pnpm install
pnpm build
pnpm --filter expo-native-workspace pack --pack-destination /tmp
```

Install the generated tarball into an existing Expo app using its package manager. A tarball test matters: workspace linking can conceal missing package files and undeclared dependencies. `pnpm pack:check` exercises a fresh consumer automatically.

From the app directory:

```sh
pnpm exec expo-native-workspace init --template minimal --yes
pnpm exec expo-native-workspace validate
pnpm exec expo-native-workspace plan
pnpm exec expo-native-workspace doctor
```

Available templates are `minimal`, `share-extension`, `widget`, and `android`. Inspect all generated files before committing. Add the plugin to `app.json`, or the equivalent dynamic Expo configuration, alongside existing plugins:

```json
{
  "expo": {
    "plugins": ["expo-native-workspace/plugin"]
  }
}
```

Keep existing name, slug, bundle identifier, package name and other Expo fields. The plugin reads `workspace.config.ts` from the app root. Treat config files as executable code: only load trusted projects.

## Add native capabilities

Author configuration with the public helpers and source-control extension sources. Start from the complete [sample apps](../apps). A declared target alone does not supply its application behavior.

```sh
pnpm exec expo-native-workspace plan
pnpm exec expo prebuild --platform ios --no-install
```

Use `--platform android` for Android. Review the generated native files, then run `pnpm exec expo run:ios` or `pnpm exec expo run:android` on a machine with the relevant toolchain. Installing a JavaScript package or running Metro does not apply native changes to an already installed app. Expo Go cannot host custom native targets or newly linked native dependencies.

## Inspect the CLI

Run `pnpm exec expo-native-workspace --help` for the installed version's flags. `explain --id <operation-id>` explains an operation from `plan`. `completion bash`, `completion zsh`, and `completion fish` generate shell completion output; inspect the output before installing it in your shell setup.

Preserve manual edits before clean prebuild. The plugin applies desired declarations, but removing a declaration does not promise automatic removal of every previously generated artifact. Regeneration from a clean native project is the reference approach for managed projects.

## Automation and exit codes

Inspection commands accept `--project <directory>`, `--config <file>`, `--json`, and `--verbose`. `doctor --ci` uses the same diagnostics and exit codes without requiring interaction. `init` needs `--yes` when run without an interactive terminal. Unknown operation IDs make `explain` fail.

Successful commands exit zero; invalid configuration or command arguments exit one; unexpected tool failures exit two. JSON failure output has `valid: false` and diagnostics. Validate the exit code as well as consuming the JSON result. `doctor` checks configuration and the installed environment; it does not prove CocoaPods, Gradle, Xcode, or device-signing success.

The repository samples use catalog dependency references and pin their native template explicitly. Run their `pnpm prebuild` scripts rather than replacing them with an unqualified Expo prebuild command; see [compatibility](compatibility.md). Existing apps with ordinary versioned Expo dependencies should use the template appropriate to their installed SDK.
