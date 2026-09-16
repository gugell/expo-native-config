# Compatibility and verification

The sample dependency catalog targets Expo SDK 56 (`~56.0.21`), React `19.2.3`, and React Native `0.85.3`. The published CLI requires Node.js 22.14 or newer. Repository development and releases use Node.js 24.11.1 or newer. The repository pins pnpm 10.34.5.

These are the intended baseline, not a blanket compatibility guarantee. Do not infer support for older Expo SDKs, arbitrary Xcode/Gradle versions, or every plugin combination from package peer dependency ranges.

| Check                      | What it establishes                                 | What it does not establish              |
| -------------------------- | --------------------------------------------------- | --------------------------------------- |
| Typecheck and unit tests   | Public typing and covered planning/execution cases  | Every Expo project or native toolchain  |
| Fresh tarball consumer     | Packaged exports, CLI and plugin resolution         | Native compilation                      |
| Sample validate / plan     | Sample declarations are accepted and inspectable    | Applied native state                    |
| Expo prebuild              | Config plugin executes and native projects generate | CocoaPods/SPM resolution or compilation |
| Simulator / emulator build | Native compilation for that recorded toolchain      | Device signing or store acceptance      |
| Physical device exercise   | Observed behavior for that device and build         | All hardware and OS releases            |

Check CI logs and release validation notes for actual completed runs. Native builds, device signing, widget behavior, share-sheet interaction, and store submission must be tested explicitly before describing a release as verified for those scenarios. Only the specific completed checks recorded below are claimed.

The share and widget samples request iOS 18.0 for their extension targets. Align host deployment targets when adapting them to another app. Custom extensions require a development or native build; they cannot be exercised in Expo Go.

The sample app configs explicitly set `sdkVersion: "56.0.0"`. Their package manifests use pnpm `catalog:` references, which Expo cannot always interpret when selecting a prebuild template. During verification, auto-selection chose an SDK 57 template even with this field set. Each sample's `prebuild` script and the example verifier therefore pin `expo-template-bare-minimum@56.0.35`, whose declared baseline is Expo `~56.0.21` and React Native `0.85.3`. Use the sample's `pnpm prebuild` script so the verified template selection is preserved. Update this pin together with the dependency catalog when changing SDKs.

On macOS, `pnpm native:check` builds the generated share and widget extension targets for iOS Simulator with signing disabled. Run `pnpm examples:check --prebuild` first. Logs and products are retained in a printed temporary directory. The command does not require host CocoaPods installation because these two extension targets use system frameworks only; it does not compile the React Native host app or exercise extension UI. CI runs this command after prebuild on macOS.

## Recorded local verification — 2026-09-16

The six sample apps passed TypeScript checking. All six completed explicit `expo-template-bare-minimum@56.0.35` prebuilds and generated-artifact checks. `pnpm native:check` then compiled `WorkspaceShare` and `WorkspaceWidget` as unsigned iOS Simulator extension targets using Xcode 26.6.0 / iPhoneSimulator SDK 26.5, with iOS 18.0 deployment targets. The standalone `WorkspaceMath` Swift package also compiled for the local macOS host.

The Android Gradle sample also compiled to an arm64-v8a debug APK with Java 17, Android SDK 36 and Gradle 9.3.1. Run `pnpm android:check` after generating that sample, with `JAVA_HOME` and `ANDROID_HOME` set.

The complete share-extension host app also passed CocoaPods installation and an unsigned Debug build for a generic iOS Simulator, using its generated `ShareExtension.xcworkspace` and `ShareExtension` scheme. This run used Node.js 24.11.1, Expo 56.0.21, React Native 0.85.3, and the same Xcode / Simulator SDK as the extension checks. The [share sample README](../apps/share-extension/README.md) contains the headless build recipe.

These checks do not establish interactive widget/share-sheet behavior, physical Android device behavior, device signing, or store acceptance. Host apps other than the share sample were not compiled for iOS in this run. Such results must be recorded separately.
