---
name: expo-native-workspace-maintainer
description: Implement or review changes to the expo-native-workspace package, its CLI, config plugin, and sample apps.
---

Locate the package checkout and read its AGENTS.md, development rules, package scripts, and current runtime schemas. This skill targets package maintenance; ordinary app configuration belongs to the usage skill.

There is one publishable package and private sample apps. Keep public imports at the package root or documented plugin subpath. Do not expose internal engine paths to examples to bypass missing API design.

Define new runtime data with Zod before behavior, infer types where practical, and validate unknown boundary input. Follow a new option through config loading, normalization, planning, execution, diagnostics and documentation. Keep operation IDs stable and generators separate from native mutation.

Test observable outcomes, including duplicate prevention for repeated native application and a fresh tarball consumer for package changes. Use the repository's actual pnpm scripts. Exercise the affected sample's validation and prebuild when available. Record native compilation and simulator/device checks separately; do not infer them from passing tests.

Keep sample source outside disposable native output. Preserve unrelated work and app-owned files. Prefer typed capabilities over raw patches; document any escape-hatch limitations. Diagnostics and fixtures must not leak signing credentials.

Before release work, inspect current release-it configuration and release scripts. A dry run is not a publication. Verify actual remote metadata, registry ownership, packaged files and explicit release authorization before external mutations. Leave unpublished status intact until registry publication is confirmed.
