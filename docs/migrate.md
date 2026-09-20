# Migrating an existing app

`expo-native-config migrate` reads a project you already have — its Expo config, its config plugins, and its generated native directories — and proposes a `workspace.config.ts` for it.

It is an advisor, not a converter. It extracts what it can read unambiguously, reports what belongs to somebody else, and names the field for everything left over. It never rewrites your plugins, and it never claims to have translated one.

## Always start with a dry run

```sh
pnpm exec expo-native-config migrate --dry-run
```

`--dry-run` prints the proposed config and the findings, and writes nothing. The printed config is byte-for-byte what a real run would write, so there is no second guess between preview and result.

When you are satisfied:

```sh
pnpm exec expo-native-config migrate
```

That writes `workspace.config.ts` and nothing else. It refuses to run if any `workspace.config.*` already exists — merge from `--dry-run` output by hand instead.

## What the four statuses mean

Every finding has one.

| Status             | Meaning                                                             | Your move                                                                     |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `extracted`        | Read from your project and placed in the proposed config            | Review it — extraction proves the value was there, not that you still want it |
| `manual`           | Recognized, but a person has to write it                            | Read the named field and declare it yourself                                  |
| `owned-elsewhere`  | Belongs to an Expo template, the Expo config, or a published plugin | Nothing. Declaring it here would create a second writer for one value         |
| `already-declared` | Already handled                                                     | Nothing                                                                       |

Only `extracted` changes the emitted manifest. Run with `--verbose` to see the `owned-elsewhere` group, which is hidden by default because it is the longest and the least actionable.

## What it reads

| Source                          | Extracted                                   | Reported only                                                                                                                                                  |
| ------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo config `plugins[]`         | —                                           | Every entry, classified. Local plugins are matched against the Expo mods they import, and the finding names the workspace field that expresses the same change |
| `ios/Podfile`                   | Literal `pod` lines                         | A `post_install` hook, pointing at `ios.podBuildSettings`                                                                                                      |
| `android/gradle.properties`     | App-added properties                        | Anything a template, the Expo config or `expo-build-properties` owns                                                                                           |
| `android/app/build.gradle`      | Coordinate and `project(':…')` dependencies | `abiFilters`, pointing at `android.abiFilters`                                                                                                                 |
| `android/…/AndroidManifest.xml` | `uses-feature`, app-owned `meta-data`       | `<queries>`, and the generated application element                                                                                                             |

Autolinked pods arrive through `use_expo_modules!`, so a literal `pod` line in a generated Podfile was added by your app or a plugin — which is why those are safe to extract and the rest are not.

## What it will not do

**It does not translate plugin JavaScript.** A config plugin body is arbitrary code with conditionals, environment reads and helper calls. `migrate` reads which Expo mods a local plugin imports and tells you which workspace field covers that kind of change:

```
manual (1):
  Expo config plugins[2] (plugins/withPodTweak.js) → ios.pods, ios.podBuildSettings or ios.podfile
    Uses a mod this package can express. Rewrite it as ios.pods, ios.podBuildSettings or
    ios.podfile, then remove the plugin entry. The plugin body is JavaScript, so this
    command will not translate it for you.
```

**It does not execute your plugins.** Reading the plugins array through `@expo/config` would either strip it or resolve and run every plugin, which fails on exactly the half-migrated projects this command exists for. A static config is parsed as JSON; a dynamic one is loaded, and if it cannot be evaluated standalone its source is scanned for local plugin paths and the finding says so.

**It does not extract your whole native project.** Telling an app's own activity from a generated one needs a person, so components are reported rather than extracted.

**It does not touch `app.json`.** Identity, permissions and plugin registration stay where they are. Removing a plugin entry is your edit to make, after you have replaced what it did.

## The order that works

1. `migrate --dry-run`, and read every `manual` finding.
2. `migrate` to write the config.
3. Declare the `manual` items by hand, one at a time.
4. `validate`, then `plan`, and check the operation list against what the app actually needs.
5. Remove one plugin from `expo.plugins`, then `prebuild --clean` and compare the native output.
6. Repeat step 5 per plugin. One at a time is what makes a regression attributable.

Do not delete plugins before step 5. The proposal is a starting point; `plan` is what tells you the declarations took.

## Limits

`migrate` reads generated native directories with line and element matching, not with a Groovy or Ruby parser. A heavily customized `build.gradle` or `Podfile` can carry entries it does not find. It fails closed in one direction only: the manifest it proposes is validated against the schema before it is returned, so `migrate` cannot hand you a config that `validate` would reject.

Run it after a prebuild if you want native state considered at all — with no `ios/` or `android/` directory it reads the Expo config alone and says so.

See [getting started](getting-started.md) for a first install, [monorepos](monorepos.md) for workspace layouts, and the [configuration reference](configuration.md) for the fields the findings name.
