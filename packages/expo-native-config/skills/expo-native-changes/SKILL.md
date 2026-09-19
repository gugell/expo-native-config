---
name: expo-native-changes
description: Decide where a native change belongs in an Expo app that uses prebuild (CNG) — app config, expo-build-properties, a library's own plugin, a local Expo module, or a config plugin you write — and verify it landed. Use when asked to add native capability, patch a Podfile or Gradle file, run code at launch, or fix a plugin that stopped working after an SDK upgrade.
---

An Expo app that runs `prebuild` regenerates `ios/` and `android/`. Anything you change there by hand is lost. The question is never "how do I edit the native project" but "which mechanism owns this change". Work down this list and stop at the first level that can express it.

## 1. The Expo app config

`app.json` / `app.config.ts` owns identity and the things every app needs: `name`, `slug`, `version`, `scheme`, icons and splash, `ios.bundleIdentifier`, `ios.infoPlist`, `ios.entitlements`, `ios.associatedDomains`, `android.package`, `android.permissions`, `android.blockedPermissions` (which removes a permission a dependency merged in), `android.intentFilters`, `googleServicesFile`, and `plugins`.

If a field exists here, use it here. A second declaration elsewhere does not add safety — it splits the answer to "what does this app do" across two files that can disagree.

## 2. expo-build-properties

Owns the build knobs: `ios.deploymentTarget`, `ios.useFrameworks`, `android.compileSdkVersion` / `targetSdkVersion` / `minSdkVersion`, `kotlinVersion`, `packagingOptions`, `extraProguardRules`, `enableProguardInReleaseBuilds`, `extraMavenRepos`, `usesCleartextTraffic`.

Reaching into the Podfile or `build.gradle` for something on this list means two plugins writing the same setting, and the one that runs last wins.

## 3. The library's own config plugin

Most libraries that need native setup ship one. Register it in `expo.plugins` rather than reproducing what it does — it will keep working across SDK upgrades, and your copy will not.

## 4. A local Expo module

For native code you own, `npx create-expo-module --local` creates `modules/<name>`, which autolinking discovers with no registration step.

**Startup work belongs here, not in a generated entry point.** Expo provides hooks:

- iOS: a class conforming to `ExpoAppDelegateSubscriber`, registered through `apple.appDelegateSubscribers` in the module's `expo-module.config.json`.
- Android: a `BasePackage` subclass returning an `ApplicationLifecycleListener` (application `onCreate`) or `ReactActivityLifecycleListener` (activity `onCreate`). The Gradle plugin puts it in the generated package list that `ApplicationLifecycleDispatcher` reads — no config entry needed.

Values those hooks need before the JS engine starts go in `strings.xml` on Android (`withStringsXml`, or a field that wraps it) and the Info.plist on iOS. That is the documented channel; do not read them from JavaScript and do not hardcode them in the native source.

## 5. A config plugin you write

Only for what nothing above covers. Prefer the typed mods, which parse and re-serialize a structured file instead of editing text:

`withAndroidManifest`, `withStringsXml`, `withAndroidColors`, `withAndroidStyles`, `withGradleProperties`, `withInfoPlist`, `withEntitlementsPlist`, `withPodfileProperties`, `withXcodeProject`, `withAppBuildGradle`, `withProjectBuildGradle`, `withSettingsGradle`.

Rules that keep a plugin alive across upgrades:

- **Import through `expo/config-plugins`, not `@expo/config-plugins`.** Under pnpm or Yarn PnP the direct import can resolve a second copy, and two copies of the mod registry silently drop each other's mods.
- **Wrap the export in `createRunOncePlugin`.** A config that registers your plugin twice otherwise applies everything twice.
- **Be idempotent.** Use `mergeContents` from `expo/config-plugins` with a stable tag, so a second prebuild replaces the block instead of appending one. Hand-rolled "does the file already contain X" checks are where duplication bugs live.
- **Generate, move and delete files only in a dangerous mod.** Doing it elsewhere breaks introspection.
- **`Podfile.properties.json` is the only safe Podfile channel** (`withPodfileProperties`). The Podfile is Ruby; the versioned template reads that JSON file, so writing it changes behavior without rewriting code.
- **Do not add interactive prompts or network calls to a mod.**

## 6. Regular expressions over generated files — last resort

Sometimes there is no mechanism: a vendor plugin hardcodes `../node_modules/<pkg>` and a workspace hoists that package. When you must:

- Make it **fail loudly** when the pattern stops matching. A silent no-op after an SDK upgrade is the failure mode of every regex patch — the build succeeds and ships without the fix.
- Add a marker so a second prebuild skips it.
- Write down which SDK you verified it against, and re-check on upgrade.

**Never do this to `AppDelegate` or `MainApplication`.** Their shape changes between SDKs (Objective-C to Swift, Java to Kotlin, a brace on a different line), and level 4 covers every legitimate reason to want it.

## Anti-patterns

| Smell                                                          | What it causes                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Editing `ios/` or `android/` and committing it                 | Lost at the next prebuild, or a merge conflict with the template |
| A regex that patches an entry point                            | Breaks on the SDK that reshapes the file                         |
| The same setting in app config _and_ a plugin                  | The two disagree; the last mod to run wins, silently             |
| A plugin that reimplements a library's own plugin              | Diverges on the library's next release                           |
| `pod install` or Gradle edits committed as "fixes"             | Regenerated away; the real fix is a mechanism above              |
| A mod that reads a file, `.replace()`s once and writes it back | Applies twice on the second prebuild                             |

## Verify it landed — every time

1. `npx expo prebuild --clean` and read the generated file, not the plugin. Intent is not evidence.
2. Run `npx expo prebuild` **again** without `--clean` and confirm exactly one copy of your change.
3. `EXPO_DEBUG=1 npx expo prebuild` prints which mods ran and in what order — the fastest way to see another plugin overwriting yours.
4. `npx expo config --type introspect` evaluates the safe mods with no prebuild. It covers `android.manifest`, `gradleProperties`, `strings`, `colors`, `styles`, `ios.infoPlist`, `entitlements`, `expoPlist` and `podfileProperties`. Anything touching the Podfile, the Xcode project, Gradle files or native source is not introspectable and needs a real prebuild.
5. Compile. A generated file containing your string proves the text arrived, not that it builds. Report compilation separately from prebuild, and say plainly which one you actually ran.

## When an upgrade breaks a plugin

Check in this order: did the field move into the app config or `expo-build-properties`; did the template rename the anchor the plugin matches; did the entry point change language or shape; is the plugin importing its own copy of `@expo/config-plugins`. Rewrite toward a higher level on this list rather than repairing the regex — the repair will break again.
