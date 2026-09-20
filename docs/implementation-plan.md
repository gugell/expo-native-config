# Implementation plan and status

Goal: a separate, installable, preview-ready Expo native configuration CLI, preserving the source repository.

Architecture: private pnpm root; one public package with schema-derived API and CLI; internal native engine; seven private sample apps. A validated session is shared by `plan`, `validate`, `doctor` and the Expo plugin. No legacy config, destructive migration, or speculative diff command.

A box is checked only when the work exists in the repository and the stated evidence was actually produced. Unchecked boxes below are correct answers, not omissions.

## 1. Engine and data model — done

- [x] Reuse selected native generators with identity-based target and Swift-package updates; repeat application tested.
- [x] Strict Zod schemas define the public data model before behavior; unknown fields, invalid sources and inconsistent native intent are rejected.
- [x] TypeScript types derive from the schemas; declarations can be written as plain objects or through constructors (`Target`, `AndroidDependency`, `XcodeBuildSettings`, …).
- [x] Loading, validation, normalization, planning and execution are separate boundaries under `src/engine/`, private to the one publishable package.
- [x] Operations carry a `risk` level; anything rewriting generated Ruby, Groovy or entry-point source is `escape-hatch` and surfaced by `plan --verbose` and `doctor`.
- [x] Each generated block is tagged; a declaration that disappears emits a removal operation for its tag instead of leaving the block behind.

## 2. Declared surface — done

- [x] iOS targets: share, widget, App Clip, notification service, notification content, intent, action and Safari extensions, with entitlements, frameworks, Info.plist, build settings and deployment targets.
- [x] iOS dependencies: remote and local Swift packages with version requirements, CocoaPods, pod build settings by target prefix, removable pod build phases, autolinking exclusions.
- [x] Xcode: host-target build settings, run-script phases, resources, schemes, `.xcode.env`, extension embed-cycle fix.
- [x] Podfile: properties, globals, minimum deployment target, plus `post_install` and replacement rules as flagged escape hatches.
- [x] Android Gradle: repositories, flat dirs, classpath and buildscript dependencies, plugins, forced resolutions, local modules, ABI filters, SDK/NDK/Kotlin versions, build-config fields, properties, lint, signing.
- [x] Android manifest and resources: permissions, optional features, application attributes, meta-data, components, package-visibility queries, supported screens, placeholders, strings, colors, styles, resource files.

## 3. CLI and plugin — done

- [x] `init`, `migrate`, `plan`, `validate`, `doctor`, `explain` and `completion` implemented against the shared session.
- [x] `migrate` reads an existing project — Expo config plugins, Podfile, gradle.properties, app/build.gradle, AndroidManifest — and proposes a manifest, with `--dry-run` previewing exactly what a real run writes. It validates its own output against the schema before returning it, and never claims to translate plugin JavaScript.
- [x] Tested: help, version, invalid flags, `--json` payloads, exit codes (0 valid, 1 invalid input, 2 unexpected failure), and `init` refusing to overwrite an existing config.
- [x] Generated declarations and CJS entrypoints built; helpers separated from Expo plugin resolution.
- [x] Plugin wrapped in `createRunOncePlugin`; `@expo/config-plugins` resolved through the app's own `expo` package so a second pnpm copy cannot split the mod registry.

## 4. Samples — done

- [x] Seven runnable examples with real Swift/Kotlin source and pinned Expo versions: share-extension, widget, native-dependencies, multi-scheme, android-gradle, android-manifest, native-workarounds.
- [x] Samples consume the same public entry points as external users, and stay independent of signing secrets.
- [x] `native-workarounds` documents each declaration next to the hand-written config plugin it replaces.

## 5. Release tooling — done

- [x] release-it with conventional changelog, version bumped into the package manifest, GitHub release configured, npm publication disabled until ownership is verified.
- [x] CI plus a fresh-tarball consumer check (`pnpm pack:check`) that exercises packaged exports, CLI and plugin resolution outside the workspace.
- [x] `pnpm check` gate: build, typecheck, lint, format, lockfile, tracked paths, release-script check and unit tests.
- [x] Generated native output is not tracked; `scripts/check-tracked-paths.mjs` enforces it.
- [x] Release rehearsed on the real path with `--no-increment`; see [releasing](releasing.md).

## 6. Documentation and skills — done

- [x] README, getting started (seven numbered steps with a check per step), migration guide, monorepo guide, configuration reference, templates, recipes, architecture, development rules, troubleshooting, compatibility, releasing, launch guide.
- [x] Self-contained agent skills under `packages/expo-native-config/skills/`, usable outside this checkout.
- [x] Independent final review; findings fixed, evidence documented, external publication prerequisites stated.

## 7. Verification — done locally, with recorded limits

Recorded 2026-09-16; full detail in [compatibility](compatibility.md) and the [verification record](verification.md).

- [x] Typecheck and unit tests across the package and samples.
- [x] Declared surface exercised against `create-expo-app` projects on Expo SDK 50–55 and 57; samples pin SDK 56.
- [x] All samples prebuilt with `expo-template-bare-minimum@56.0.35` and generated artifacts checked.
- [x] `WorkspaceShare` and `WorkspaceWidget` compiled as unsigned iOS Simulator extension targets (Xcode 26.6.0, iOS 18.0 deployment target); `WorkspaceMath` Swift package compiled for macOS host.
- [x] Android Gradle sample built to an arm64-v8a debug APK (Java 17, Android SDK 36, Gradle 9.3.1).
- [x] Share-extension host app passed CocoaPods installation and an unsigned Debug Simulator build.
- [ ] Interactive share-sheet and widget behavior on a device or simulator.
- [ ] Physical Android device behavior.
- [ ] iOS host-app compilation for samples other than share-extension.
- [ ] Device signing and store acceptance.

## 8. Publication — not done

- [ ] npm registry publication. Ownership and credentials are account-specific and unverified; no install command may be advertised until a real release exists.
- [ ] Public repository URL confirmed in package metadata.
- [ ] Final native distribution signing.

Local implementation implies no npm publication and no remote resource creation.
