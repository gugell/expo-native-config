# Agent instructions

Work in this repository only unless the user explicitly authorizes another location. The earlier Expo workspace repository is a reference, not a write target.

Read `docs/development-rules.md` before implementation. Define runtime schemas first with Zod, infer types, and validate external values at boundaries. Keep public consumers on package-root exports and `expo-native-workspace/plugin`. Engine modules are private implementation details of one publishable package.

Use pnpm, workspace catalog versions, and the committed lockfile. Run relevant tests plus `pnpm check`, `pnpm pack:check`, and `pnpm examples:check` before claiming release readiness. Distinguish unit validation, prebuild, native compilation and device behavior in reports.

Preserve other contributors' changes and stage explicit paths. Keep samples independent of signing secrets. Do not publish, push, or create external resources without task authorization. Do not invent npm availability, repository URLs, tool output or native-build evidence.

Packaged skills live under `packages/expo-native-workspace/skills/`. They must work outside this checkout and should not depend on private paths or unavailable skills.
