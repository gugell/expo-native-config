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
- Two packaged skills have valid parsed YAML metadata; references and unfinished placeholders checked.
- Independent review findings in initialization options, native target names and source path confinement were fixed with regression coverage.

## Boundaries

The plan displays intended operations, not a native state diff. Release rehearsal is recorded below after the initial repository commit. Interactive share-sheet/widget behavior, physical-device signing, App Store submission, Windows/Linux CI execution, and registry publication have not been verified locally. The repository includes CI jobs; those jobs do not have a remote run until the repository is created and pushed.
