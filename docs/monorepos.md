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

A package can ship a target. Put a `target.config.js` beside its source, and link it from any app that needs it:

```js
// packages/shared-widget/target.config.js
module.exports = {
  type: 'widget',
  deploymentTarget: '18.0',
  frameworks: ['WidgetKit', 'SwiftUI'],
};
```

```ts
// apps/mobile/workspace.config.ts
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      { package: '@mono/shared-widget', name: 'SharedWidget', bundleIdentifier: '.widget' },
    ],
  },
});
```

The package is resolved the way your app resolves any dependency, so a pnpm symlink, a yarn workspace and a bun hoist all land on the real directory without three special cases. It must be a dependency of the app — that is what makes the package manager link it, and a package that does not resolve fails with a message saying so.

The package describes the target; the app linking it overrides what it needs to. `name`, `bundleIdentifier`, `deploymentTarget`, `entitlements`, `frameworks` and `buildSettings` set on the entry win, because the app is the thing that knows its own bundle identifier.

Xcode references the source in place through a synchronized group, so nothing is copied and editing the package updates every app that links it.

### Self-describing targets inside the app

The same file works without a package. A directory under `targetsRoot` (default `targets/`) that contains a `target.config.js` is a target, with no entry in `workspace.config.ts` at all:

```
apps/mobile/
├── workspace.config.ts       ← can be just { schemaVersion: 1 }
└── targets/
    └── LocalWidget/
        ├── target.config.js  ← makes this directory a target
        ├── Info.plist
        └── LocalWidget.swift
```

`name` defaults to the directory name. `target.config.json`, `.cjs` and `.mjs` work too, and `expo-target.config.js` is accepted so a project coming from [@bacons/apple-targets](https://github.com/EvanBacon/expo-apple-targets) does not have to rename files first.

A directory without a config file is not a target — adding the file is what opts a directory in. An inline `ios.targets` entry stays authoritative over a discovered directory of the same name, so declaring and discovering the same target does not produce two.

That precedence is deliberate. Scattered per-target config is what the manifest was meant to replace, and for a target the app owns the manifest is still the better place. `target.config.js` earns its keep when a target has to travel to more than one app — which a manifest entry cannot express, because the app does not own the package's layout.

A `pods.rb` beside a target is **not** read; declare those dependencies in the target's `pods` instead. Bringing one from @bacons/apple-targets produces a warning rather than a silent drop.

These files are read, not trusted blindly: a `target.config.js` goes through the same strict schema as an inline target, so a typo like `bundleIdentifer` is rejected with the file named, rather than reaching the generators as whatever the file happened to export.

### Where paths resolve

| Input                      | Resolves from                | Can reach a sibling package?   |
| -------------------------- | ---------------------------- | ------------------------------ |
| `{ package: '…' }` target  | Node resolution from the app | Yes — this is the intended way |
| Target `source`            | Expo app root                | Yes, within the workspace      |
| Local Swift package `path` | Generated `ios/`             | Yes                            |
| Android `modules[].path`   | Generated `android/`         | Yes                            |

The boundary is the **workspace root** — the nearest ancestor with a `pnpm-workspace.yaml` or a `package.json` with `workspaces`, falling back to the app root when there is no workspace. A source outside that is refused, including through a symlink:

```
target.source: Target source must stay inside the workspace (/repo): /somewhere/else
```

So a target can live anywhere in your monorepo, and nowhere outside it.

For a plain `source` path, count the `../` segments from the app root. For Swift packages and Gradle modules, count from the _generated_ directory: `ios/` is one level below the app root, so a sibling package is `../../../` from `ios/` and `../../` from `android/`.

```ts
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    packages: [{ path: '../../../packages/native-lib', products: ['NativeLib'] }],
  },
  android: {
    modules: [{ name: 'native-lib', path: '../../packages/native-lib' }],
    dependencies: [{ project: 'native-lib' }],
  },
});
```

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

See [iOS targets](targets.md) for all four ways to include one, [getting started](getting-started.md) for the first install, and the [configuration reference](configuration.md) for the full path table.
