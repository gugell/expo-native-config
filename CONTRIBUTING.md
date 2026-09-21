# Contributing

Use Node.js 24.11.1+ and the pnpm version pinned in `package.json`.

```sh
pnpm install
pnpm build
pnpm check
pnpm pack:check
pnpm examples:check
```

Read [development rules](docs/development-rules.md) and [architecture](docs/architecture.md); [implementation plan and status](docs/implementation-plan.md) records what is done and what each box's evidence was. Define schemas first, keep samples on public exports, and separate planning from native mutations. Add tests that demonstrate the behavior changed. Native changes should include the smallest relevant sample and prebuild evidence; record unavailable native build tools explicitly.

Use conventional commit messages. Keep implementation, tests and documentation together in a focused pull request. Explain the user-visible problem, resulting behavior, validation performed, and remaining limits. Avoid unrelated formatting or generated native output.

Never commit credentials or publish packages as part of an ordinary contribution. Follow [release instructions](docs/releasing.md) for an authorized release. Open issues and pull requests at <https://github.com/gugell/expo-native-config>.

For iOS extension changes on macOS, run `pnpm examples:check --prebuild` followed by `pnpm native:check`. This compiles both extension targets without signing and retains build logs. Host-app and device verification remain separate.
