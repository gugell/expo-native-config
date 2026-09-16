# Expo Native Workspace implementation plan

Goal: a separate, installable, preview-ready Expo native configuration CLI, preserving the source repository.

Architecture: private pnpm root; one public package with schema-derived API and CLI; internal native engine; six private sample apps. A validated session is shared by plan, validate, doctor, and the Expo plugin. No legacy config, destructive migration, or speculative diff command.

## Work and acceptance

- [x] Reuse selected native generators with identity-based target/SPM updates; test repeat application.
- [x] Define strict Zod schemas; reject unknown fields, invalid sources and inconsistent native intent.
- [x] Implement init, plan, validate, doctor, explain and completion. Test help/version/invalid flags/JSON/error codes and config non-overwrite.
- [x] Build generated declarations and CJS entrypoints; separate helpers from Expo plugin resolution.
- [x] Six runnable examples with actual Swift source and pinned Expo versions.
- [x] release-it conventional changelog, pnpm publishing, CI and fresh tarball consumer checks.
- [x] README, API, maintenance, release, launch and compatibility docs; focused reusable skills.
- [x] Build/typecheck/lint/test, tarball installation, sample prebuild, native build where local tools permit.
- [x] Independent final review; fix findings, document evidence and external publication prerequisites.

No npm publication or remote creation is implied by local implementation. Release credentials/ownership and final native distribution signing remain account-specific.
