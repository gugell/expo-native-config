---
name: expo-native-config-maintainer
description: Implement or review changes to the expo-native-config package, its CLI, config plugin, and sample apps.
---

Locate the package checkout and read its AGENTS.md, development rules, package scripts, and current runtime schemas. This skill targets package maintenance; ordinary app configuration belongs to the usage skill.

There is one publishable package and private sample apps. Keep public imports at the package root or documented plugin subpath. Do not expose internal engine paths to examples to bypass missing API design.

Define new runtime data with Zod before behavior, infer types where practical, and validate unknown boundary input. Follow a new option through config loading, normalization, planning, execution, diagnostics and documentation. Keep operation IDs stable and generators separate from native mutation.

Test observable outcomes, including duplicate prevention for repeated native application and a fresh tarball consumer for package changes. Use the repository's actual pnpm scripts. Exercise the affected sample's validation and prebuild when available. Record native compilation and simulator/device checks separately; do not infer them from passing tests.

Two policies decide whether a proposed field belongs at all. First, this package never edits a generated entry point: no field, and no escape hatch aimed at AppDelegate, MainApplication or MainActivity — the guidance pass makes that an error, and `init --template lifecycle-module` is the answer to the need behind it. Second, a field whose job the Expo app config or expo-build-properties already does is duplication, not convenience; `<uses-feature>` and `queries` are here because the Expo config types have no equivalent, and `android.permissions` was removed once it turned out they do.

When you remove a field, add it to the moved-field map in `session.ts` so an unrecognized key names its new home instead of just failing.

Keep sample source outside disposable native output. Preserve unrelated work and app-owned files. Prefer typed capabilities over raw patches; document any escape-hatch limitations. Diagnostics and fixtures must not leak signing credentials.

Before release work, inspect current release-it configuration and release scripts. A dry run is not a publication. Verify actual remote metadata, registry ownership, packaged files and explicit release authorization before external mutations. Leave unpublished status intact until registry publication is confirmed.

For Android properties-file signing, keep credential loading in Gradle and generated output limited to file references. Cover absent optional credentials allowing debug builds, release tasks failing closed, independent EAS release configuration, path resolution beside the properties file, and repeated application. Never read production credentials to write fixtures or test signing configuration.
