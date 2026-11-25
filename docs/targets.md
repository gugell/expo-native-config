# iOS targets: four ways to include one

A target is a directory of native source plus a declaration. What changes between the four forms is **where the declaration lives** and **where the directory is**.

| Form                        | Declaration lives in                 | Source lives               | Use it when                                   |
| --------------------------- | ------------------------------------ | -------------------------- | --------------------------------------------- |
| [Inline](#1-inline)         | `workspace.config.ts`                | Inside the app             | The app owns the target                       |
| [Discovered](#2-discovered) | `target.config.js` beside the source | `targetsRoot/<name>/`      | You want the target self-contained            |
| [By path](#3-by-path)       | `target.config.js` beside the source | Anywhere in the workspace  | Two apps share a folder that is not a package |
| [By package](#4-by-package) | `target.config.js` in the package    | A workspace or npm package | The target ships as a dependency              |

All four produce the same thing. Xcode references the source **in place** through a synchronized group, so nothing is copied and editing the source updates every app pointing at it.

## 1. Inline

The original form, and still the right one for a target only this app uses:

```ts
import { defineWorkspace, Target } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      Target.widget({
        name: 'MyWidget',
        source: './targets/MyWidget',
        bundleIdentifier: '.widget',
        deploymentTarget: '18.0',
      }),
    ],
  },
});
```

`source` defaults to `targetsRoot/<name>`, so it can usually be omitted. The manifest is the single source of truth.

## 2. Discovered

Put a `target.config.js` in the directory and the manifest does not need to mention it at all:

```
apps/mobile/
├── workspace.config.ts          ← can be just { schemaVersion: 1 }
└── targets/
    └── MyWidget/
        ├── target.config.js     ← this file makes it a target
        ├── Info.plist
        └── MyWidget.swift
```

```js
// targets/MyWidget/target.config.js
module.exports = {
  type: 'widget',
  bundleIdentifier: '.widget',
  deploymentTarget: '18.0',
  frameworks: ['WidgetKit', 'SwiftUI'],
};
```

Only directories directly under `targetsRoot` (default `targets/`) are scanned, and only those containing a config file. A directory without one is not a target — adding the file is what opts it in.

## 3. By path

For a directory that is neither under `targetsRoot` nor an installable package:

```ts
ios: {
  targets: [{ path: '../../shared/native/MyWidget', bundleIdentifier: '.widget' }],
}
```

The path resolves from the app root and the directory must contain a `target.config.js`. `name` defaults to the directory name.

This is the form for a monorepo that shares native source without making it a package.

## 4. By package

A package can ship a target. It needs a `target.config.js` at its root, and it must be a dependency of the app so the package manager links it:

```ts
ios: {
  targets: [
    { package: '@mono/shared-widget', name: 'SharedWidget', bundleIdentifier: '.widget' },
  ],
}
```

**Local workspace package and published npm package are the same form.** Resolution goes through the app's own module resolution, so a pnpm symlink, a yarn workspace, a bun hoist and a plain `node_modules` directory all land on the real directory without four special cases.

A package that ships a target should include the native source and the config in its published files:

```json
{
  "name": "@mono/shared-widget",
  "files": ["index.js", "target.config.js", "*.swift", "Info.plist"]
}
```

**Nothing is written into a linked package or folder.** A target the app owns (under its targets root or elsewhere in the app) gets its generated `Info.plist` and entitlements next to its source, as before. A target linked from a package, or from a folder outside the app, gets them in `ios/<TargetName>/` instead: in a real install that source is `node_modules`, and a folder shared by two apps would otherwise receive each app's entitlements in turn. A package that ships its own `Info.plist` keeps using it.

One caveat for a published package: Xcode will reference source inside `node_modules`, which is regenerated on install and usually not in version control. That works, and it is how autolinked native modules already behave — but a clean install must happen before a build, and the path changes if you switch package managers or hoisting.

## The config file

Same fields as an inline target, minus two it supplies itself:

| Field              | Notes                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | **Required.** `share`, `widget`, `clip`, `notification-service`, `notification-content`, `intent`, `action`, `safari`, `background-download` |
| `name`             | Defaults to the directory name                                                                                                               |
| `bundleIdentifier` | A leading `.` appends to the host app's identifier                                                                                           |
| `deploymentTarget` | e.g. `'18.0'`                                                                                                                                |
| `entitlements`     | App Groups must also appear in `expo.ios.entitlements`                                                                                       |
| `frameworks`       | Added to the type's defaults, not replacing them                                                                                             |
| `buildSettings`    | Xcode build settings for this target                                                                                                         |
| `pods`             | The target's CocoaPods dependencies                                                                                                          |
| `source`           | **Rejected** — the file's own directory is the source, so setting it would do nothing                                                        |

Accepted filenames: `target.config.js`, `.cjs`, `.mjs`, `.json`, `.ts`, and `expo-target.config.js`/`.cjs`/`.mjs`/`.json`.

A package can ship a complete, self-contained target — source, declaration and its own CocoaPods dependencies:

```js
// packages/shared-widget/target.config.js
module.exports = {
  type: 'widget',
  deploymentTarget: '18.0',
  frameworks: ['WidgetKit', 'SwiftUI'],
  pods: [{ pod: 'SDWebImage', version: '~> 5.0' }],
};
```

These files are **not** trusted blindly. Each goes through the same strict schema as an inline target, so a typo like `bundleIdentifer` is an error naming the file it came from, rather than something the generators receive as whatever the file exported.

## Background Assets downloader (`background-download`)

`background-download` is the Xcode 26 "Background Download Extension": the extension the system launches to fetch [Background Assets](https://developer.apple.com/documentation/backgroundassets) asset packs, including Apple-hosted ones. Unlike every other type here it is an **ExtensionKit** extension, not an app extension, and the generated project reflects that:

| What              | Generated value                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Product type      | `com.apple.product-type.extensionkit-extension`                                                             |
| Product           | `<name>.appex`, file type `wrapper.extensionkit-extension`                                                  |
| Embedded by       | The host app's "Embed ExtensionKit Extensions" phase, into `<App>.app/Extensions/` (not `PlugIns/`)         |
| Info.plist        | `EXAppExtensionAttributes` → `EXExtensionPointIdentifier = com.apple.background-asset-downloader-extension` |
| Frameworks        | `BackgroundAssets`, `StoreKit`                                                                              |
| Entitlements      | The host app's App Groups, unless the target declares its own                                               |
| Deployment target | `26.0` by default                                                                                           |

The `26.0` default is the type's, used only when nothing else sets one: the target's own `deploymentTarget` wins, then `ios.deploymentTarget`. If `ios.deploymentTarget` is lower — say `18.0` for your widgets — set `deploymentTarget: '26.0'` on this target, because `StoreDownloaderExtension` and `ManagedDownloaderExtension` are iOS 26 APIs and the Swift below will not compile against anything older.

The source is yours to provide, as with every target. The smallest one, from Apple's "Apple-Hosted, Managed" template:

```swift
import BackgroundAssets
import ExtensionFoundation
import StoreKit

@main
struct DownloaderExtension: StoreDownloaderExtension {
    func shouldDownload(_ assetPack: AssetPack) -> Bool { true }
}
```

```ts
ios: {
  targets: [Target.backgroundDownload({ name: 'AssetDownloader', bundleIdentifier: '.assets' })],
}
```

**The host app needs Background Assets configuration of its own**, which this type does not write: the asset-pack keys in the app's Info.plist (for Apple-hosted packs, `BAHasManagedAssetPacks`, `BAUsesAppleHosting` and `BAAppGroupID`) belong in `expo.ios.infoPlist`, and the App Group they name in `expo.ios.entitlements`, so the extension inherits it. Apple's Background Assets documentation is the reference for those keys.

### Shipping one from a package subpath

A package can carry the downloader in a subdirectory and the app can link that directory directly:

```ts
ios: {
  targets: [
    { package: '@acme/assets/downloader', name: 'AssetDownloader', bundleIdentifier: '.assets' },
  ],
}
```

```
@acme/assets/
├── package.json             ← "exports" must include "./downloader/package.json"
└── downloader/
    ├── package.json         ← { "private": true } is enough
    ├── target.config.js     ← module.exports = { type: 'background-download' };
    └── DownloaderExtension.swift
```

Resolution asks the app's module resolver for `<specifier>/package.json` and uses the directory it lands in, so a subpath needs a `package.json` of its own. If the parent package declares `"exports"`, that file must be exported too (`"./downloader/package.json": "./downloader/package.json"`), or Node refuses the subpath before the directory is ever read. Without `"exports"` the nested `package.json` alone is enough. `name` defaults to the last segment of the specifier (`downloader`), so set it on the entry.

## Precedence and overrides

**An inline entry wins over a discovered directory of the same `name`.** Declaring and discovering the same target does not produce two, and the manifest stays authoritative for a target the app owns.

**The entry overrides what the config file says.** For `path` and `package` forms, `name`, `bundleIdentifier`, `deploymentTarget`, `entitlements`, `frameworks` and `buildSettings` set on the entry win — the app linking a shared target is the thing that knows its own bundle identifier:

```ts
// The package says 18.0; this app needs 17.0.
{ package: '@mono/shared-widget', name: 'SharedWidget', deploymentTarget: '17.0' }
```

## Boundaries

**A target must resolve inside the workspace** — the nearest ancestor with a `pnpm-workspace.yaml` or a `package.json` with `workspaces`, falling back to the app root when there is no workspace.

A `target.config.js` is executed, so the boundary is enforced _before_ the file is read, including through a symlink under `targetsRoot`:

```
Target path "../../../elsewhere" resolves to /elsewhere, which is outside
the workspace (/repo). Nothing there is read.
```

So a target can live anywhere in your monorepo, and nowhere outside it.

## Coming from @bacons/apple-targets

`expo-target.config.js` is read, so nothing needs renaming. Two differences:

- **`pods.rb` is not read.** Declare those dependencies in the target's `pods` field instead. A `pods.rb` beside a target produces a warning naming the field, rather than silently dropping your extension's dependencies into a link error.
- **`icon`, `images` and `colors` are not supported.** Asset catalogs are not part of this package's declared surface; add them to the target directory yourself.

## Samples

| Sample                                     | Form                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [share-extension](../apps/share-extension) | Inline — declared in `workspace.config.ts`                                                                              |
| [widget](../apps/widget)                   | By package — source and `target.config.js` in [`packages/workspace-widget-target`](../packages/workspace-widget-target) |

Both compile in CI, so the package form is exercised end to end: resolved through pnpm, prebuilt, and built with `xcodebuild`. The pbxproj group resolves to `../../../packages/workspace-widget-target`.

The discovered and path forms have no sample of their own; they use the same config file as the package form and are covered by `tests/target-discovery.test.ts`.

## Related

- [Configuration reference](configuration.md) — every field
- [Monorepos](monorepos.md) — workspace layout, package managers, path bases
- [Getting started](getting-started.md) — the seven-step path
