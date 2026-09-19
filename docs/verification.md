# Verification record

This records local verification on 2026-09-16. It is evidence for a preview candidate, not a claim of device or store certification.

## Toolchain

- macOS with Node 24.11.1 and pnpm 10.34.5.
- Expo 56.0.21, React 19.2.3, React Native 0.85.3.
- Native template explicitly pinned to `expo-template-bare-minimum@56.0.35`.
- Xcode 26.6.0 with the iPhoneSimulator 26.5 SDK.

## Completed

- `pnpm check`: build, package and all six app typechecks, ESLint, Prettier, 21 tests passed.
- `pnpm pack:check`: pnpm-packed tarball installed into an independent npm consumer; helpers, schema, plugin exports, executable, init, validate and plan passed.
- `pnpm examples:check --prebuild`: six samples validated, planned and generated; expected native settings and scheme files checked.
- `pnpm native:check`: share extension and WidgetKit targets compiled for iOS Simulator without signing.
- Full Share Extension host: CocoaPods installation and unsigned Debug build of the `ShareExtension` workspace/scheme for generic iOS Simulator passed.
- Local Swift sample package compiled independently.
- `pnpm android:check`: Android Gradle sample debug APK compiled for arm64-v8a, Java 17 / Android SDK 36 / Gradle 9.3.1. The initial build executed 160 tasks in 3m 6s.
- `pnpm release:dry-run`: version/changelog/tag preparation passed with a clean working tree retained.
- Two packaged skills have valid parsed YAML metadata; references and unfinished placeholders checked.
- Independent review findings in initialization options, native target names and source path confinement were fixed with regression coverage.

## Native surface expansion — 2026-09-19

Verified locally on the same machine with Node 22.12.0 (below the repository's own engine floor; the warning was emitted and ignored), Java 17 (Zulu 17.0.17) and the Android SDK at `~/Library/Android/sdk`.

- `pnpm check`: build, typecheck, ESLint, Prettier and 46 tests passed (34 pre-existing, 12 new).
- Android sample prebuild against `expo-template-bare-minimum@56.0.35` applied and was inspected in the generated project: buildscript `classpath`, appended `allprojects` repositories and `resolutionStrategy.force`, `defaultConfig` `ndk.abiFilters` / `manifestPlaceholders` / `buildConfigField`, `reactNativeArchitectures`, `expoAutolinking.exclude` in `settings.gradle`, `<meta-data>`, `<receiver tools:node="remove">` with the `tools` namespace added to `<manifest>`, `<supports-screens>`, and a `strings.xml` entry.
- A second prebuild over the same directory produced exactly one copy of each of those entries.
- Deleting the declarations and prebuilding again (without `--clean`) removed every generated block while leaving the unrelated declaration in place.
- `pnpm android:check`: the sample, now including ABI filters, manifest placeholders, a BuildConfig field, a `<meta-data>` entry, a component removal and a string resource, compiled to a debug APK.
- iOS sample prebuild wrote `Podfile.properties.json`, `LD_EXPORT_SYMBOLS = NO` on the host target's configurations, and one `PBXShellScriptBuildPhase`; a second prebuild left exactly one such phase.

Constructors and named constants were added after the run above and re-verified: `pnpm check` (47 tests), `pnpm pack:check` (packed npm consumer resolves every constructor namespace), `pnpm examples:check`, both samples re-prebuilt through the constructor form, and `pnpm android:check` recompiled the Android sample including the Kotlin injected into `MainApplication.onCreate` — which is what establishes that entry-point injection produces compiling source, not just matching text.

Not verified in this run: an iOS host-app compile after these changes (that needs CocoaPods installation), AppDelegate injection against a real generated AppDelegate, `ios.resources` bundling in a built app, Maven repositories with credentials, and every new extension target type beyond schema and Info.plist generation. `pnpm native:check` recompiled both extension targets; `examples:check --prebuild` was run for the two samples that changed, not all six.

## Boundaries

The plan displays intended operations, not a native state diff. Release-it offline dry run passed against the initial Git commit, calculating the next version and changelog without changing files, publishing, or contacting a remote. Interactive share-sheet/widget behavior, physical-device signing, App Store submission, Windows/Linux CI execution, and registry publication have not been verified locally. The repository includes CI jobs; those jobs do not have a remote run until the repository is created and pushed.
