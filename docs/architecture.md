# Architecture

The repository has one publishable package, `packages/expo-native-workspace`, and six private sample apps. pnpm manages workspace dependencies and a shared catalog; samples consume the same public entry points as external users.

Configuration loading, schema validation, normalization, planning, and execution form separate boundaries. Runtime Zod schemas define the public data model before behavior is implemented. TypeScript types derive from these schemas where practical. The CLI and config plugin share the same validated configuration and planning behavior.

```mermaid
flowchart LR
  A[workspace.config.ts] --> B[Load and validate]
  B --> C[Normalize]
  C --> D[Plan native operations]
  D --> E[CLI inspection]
  D --> F[Expo config plugin]
  F --> G[Native project mods]
```

Internal engine modules divide iOS targets, Swift packages, CocoaPods, Xcode, Android, and file operations. They are implementation boundaries within one npm package, not independently published workspace packages. Consumers import helpers from the package root and the Expo plugin from `expo-native-workspace/plugin`.

Generators describe operations; executors apply them through Expo config-plugin mods. Operation IDs let users inspect an intended change with `explain`. Plans are semantic descriptions of desired work, not complete diffs against generated native projects. Config loading can execute JavaScript and TypeScript and therefore is not a sandbox.

Native projects are generated outputs for these samples. App-owned source stays outside `ios/` and `android/` where possible. Changes should survive clean prebuild, and repeated prebuild should avoid duplicate owned blocks. Removal semantics and conflicts with other plugins need explicit tests rather than assumptions.

See [development rules](development-rules.md) for contributor boundaries and [compatibility](compatibility.md) for evidence requirements.
