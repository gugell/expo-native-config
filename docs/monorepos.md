# Monorepos

This package has no monorepo mode. It operates on one Expo app at a time, identified by the directory holding that app's Expo config. Everything below follows from that.

## The one rule

**`workspace.config.ts` lives beside `app.json`, in the app package — never at the workspace root.**

A monorepo root is not an Expo app. It has no bundle identifier, no `ios/`, no `android/`, and nothing for a declaration to apply to. Config discovery looks in the app root only:

```
my-monorepo/
├── package.json                 ← workspace root, no config here
├── apps/
│   └── mobile/
│       ├── app.json             ← Expo config
│       ├── workspace.config.ts  ← here
│       ├── targets/             ← extension source
│       ├── ios/                 ← generated
│       └── android/             ← generated
└── packages/
    └── native-lib/              ← reachable, see "Sharing native code"
```

Two Expo apps in one repository get two configs, one each. They share nothing implicitly.

## Selecting the app

Every command takes `--project`, resolved from your current working directory:

```sh
pnpm exec expo-native-config plan --project apps/mobile
```

Or run inside the app package and let it default to the working directory. Both forms are equivalent; the second is easier in package scripts.

The most portable form is a script in the app's `package.json`, run through your manager's workspace selector:

```json
{ "scripts": { "native:plan": "expo-native-config plan" } }
```

| Manager | Run that script from the root       |
| ------- | ----------------------------------- |
| pnpm    | `pnpm --filter mobile native:plan`  |
| bun     | `bun --filter mobile native:plan`   |
| npm     | `npm run native:plan -w mobile`     |
| yarn    | `yarn workspace mobile native:plan` |

The pnpm, bun and npm forms were run against a scratch workspace while writing this page; the yarn form is its documented workspace selector and was not run here. `pnpm --dir apps/mobile exec …` also works and needs no package name.

## Where to install it

Install `expo-native-config` in the **app package**, not the workspace root. The Expo plugin has to resolve from the app that runs prebuild, and the CLI resolves your app's `expo` package to reach `@expo/config-plugins`.

That last point is why root-only installs cause trouble. This package deliberately reaches config-plugins through your app's own `expo`:

```ts
try {
  return require('expo/config-plugins');
} catch {
  return require('@expo/config-plugins');
}
```

Importing `@expo/config-plugins` directly can resolve a _second_ copy under pnpm's isolated store or Yarn PnP, and two copies of the mod registry silently drop each other's mods — you get a prebuild that runs cleanly and applies half your changes. Installing in the app package keeps one copy on the resolution path.

## Per-manager notes

**pnpm.** The default isolated `node_modules` is the layout this package is developed and tested against. Nothing extra is needed. If you have set `node-linker=hoisted`, verify with `plan` after prebuild that operations still appear — hoisting changes which copy of `expo` resolves first.

**yarn (node-modules linker).** Behaves like npm. No extra configuration.

**yarn (Plug'n'Play).** The config file is TypeScript loaded at runtime, and native tooling downstream — CocoaPods, Gradle, Xcode build scripts — reads real files from disk, not a zip-backed virtual filesystem. If prebuild or the native build cannot resolve modules, set `nodeLinker: node-modules` for the app workspace. Nothing in this package inspects PnP state, so a failure here surfaces as an ordinary resolution error from whichever tool hit it first.

**bun.** Bun workspaces hoist to the root `node_modules`. Install the package in the app workspace anyway so the app's own `expo` stays on the resolution path. `bun --filter` selects a workspace by package name.

**npm.** Workspaces hoist. `npm exec -w <name>` selects the workspace.

None of these change what gets generated. The manager decides where files land on disk; the declarations and the plan are identical.

## Sharing native code between apps

Two path bases apply, and they differ — this is the part that surprises people:

| Input                        | Resolves from                         | Can reach a sibling package? |
| ---------------------------- | ------------------------------------- | ---------------------------- |
| Target `source` (extensions) | Expo app root, **confined inside it** | **No**                       |
| Local Swift package `path`   | Generated `ios/`                      | Yes                          |
| Android `modules[].path`     | Generated `android/`                  | Yes                          |

An extension's source must live inside the app package. Pointing at a sibling fails validation, before prebuild:

```
target.source: Target source must stay inside the project: /repo/packages/shared-native/Share
```

A native library is a different story, because those paths resolve from the _generated_ native directories and are allowed to climb out:

```ts
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    // from apps/mobile/ios/ up to the repo root
    packages: [{ path: '../../../packages/native-lib', products: ['NativeLib'] }],
  },
  android: {
    // from apps/mobile/android/
    modules: [{ name: 'native-lib', path: '../../packages/native-lib' }],
    dependencies: [{ project: 'native-lib' }],
  },
});
```

So: **share libraries, copy extensions.** To use one share extension in two apps, keep its Swift source in a shared package and copy or symlink it into each app's `targets/` as a build step — or accept two copies. Declaring it from outside the app package is not supported.

Count the `../` segments from the generated directory, not from the config file. `ios/` is one level below the app root, so a sibling package is `../../../` from `ios/` and `../../` from `android/`.

## CI

Inspection commands are the cheap part of a native pipeline and need no toolchain:

```sh
pnpm exec expo-native-config validate --project apps/mobile
pnpm exec expo-native-config plan --project apps/mobile --json
pnpm exec expo-native-config doctor --project apps/mobile --ci
```

Exit codes are 0 for success, 1 for invalid configuration or arguments, and 2 for an unexpected tool failure. Check the exit code as well as parsing the JSON. `doctor --ci` runs the same diagnostics without needing a terminal.

Run these per app, not once for the repository. A workspace with three Expo apps runs three plans.

## Migrating a monorepo

Run [`migrate`](migrate.md) per app, from that app's directory:

```sh
pnpm exec expo-native-config migrate --dry-run --project apps/mobile
```

It reads that app's Expo config and that app's native directories — not sibling packages. A plugin registered by a relative path _is_ followed out of the app package, so a shared plugin at `../../packages/plugins/withShared` is read and classified like any other local one. Its finding is reported once per app that registers it, and rewriting it as declarations is a per-app edit.

See [getting started](getting-started.md) for the first install and [configuration reference](configuration.md) for the full path table.
