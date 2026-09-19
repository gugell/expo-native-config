# Development rules

Use schema-first configuration and explicit package boundaries. Nx, GraphQL, and web styling rules are deliberately outside this repository's scope.

- Define runtime schemas before implementing configuration or external-data behavior. Use Zod and infer public types from the schema. Validate unknown input at boundaries; avoid `any` and unchecked casts.
- Keep the public surface small: package-root helpers, the documented plugin subpath, and the CLI. Sample apps must not deep-import engine code.
- Keep generators inspectable and execution separate. A config field is complete only when parsing, planning, native application, diagnostics, and relevant documentation agree.
- Use pnpm and the committed lockfile. Add shared dependency versions to the workspace catalog. Only `packages/expo-native-config` is published; apps are private.
- Test observable outcomes: validation errors, native project structure, repeated application, and tarball consumption. Do not equate a passing unit test with a successful native build.
- Preserve app-owned source files and avoid silent clobbering. Keep credentials out of samples, snapshots, diagnostics, and release artifacts.
- Keep each meaningful change reviewable with its tests and documentation. Use conventional commits and stage explicit paths when sharing a checkout.
- Run the repository's documented checks before claiming completion. Record unavailable native toolchains and unverified platform behavior honestly.

Agents should read [AGENTS.md](../AGENTS.md). External references in [agent skills](agent-skills.md) explain provenance without importing unrelated policies.
