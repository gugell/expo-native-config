# Agent instructions

Work in this repository only unless the user explicitly authorizes another location. The earlier Expo workspace repository is a reference, not a write target.

Read `docs/development-rules.md` before implementation. Define runtime schemas first with Zod, infer types, and validate external values at boundaries. Keep public consumers on package-root exports and `expo-native-config/plugin`. Engine modules are private implementation details of one publishable package.

Use pnpm, workspace catalog versions, and the committed lockfile. Run relevant tests plus `pnpm check`, `pnpm pack:check`, and `pnpm examples:check` before claiming release readiness. Distinguish unit validation, prebuild, native compilation and device behavior in reports.

Commit per meaningful change, not per session. One commit is one reviewable unit — a capability with the code it needs, or the tests, docs or samples for work already committed — with a conventional commit subject. Do not squash unrelated capabilities into one commit, and do not split a change so far that a commit cannot stand on its own. Stage explicit paths rather than `git add -A`, and never commit generated native output.

Every branch answers `.github/pull_request_template.md`: the problem, the resulting behavior, the validation actually performed (the template's checklist), and remaining limits. Fill it from evidence, never from intent — an unchecked box is a correct answer. Create the template if it is missing. When no remote is configured, produce the same description for the repository owner instead of inventing a pull request URL.

Preserve other contributors' changes. Keep samples independent of signing secrets. Do not publish, push, or create external resources without task authorization. Do not invent npm availability, repository URLs, tool output or native-build evidence.

Packaged skills live under `packages/expo-native-config/skills/`. They must work outside this checkout and should not depend on private paths or unavailable skills.
