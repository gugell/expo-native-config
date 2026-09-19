# Troubleshooting

## The CLI cannot load the config

Run it from the Expo app root and confirm `workspace.config.ts` has a default export with `schemaVersion: 1`. Build the package before using workspace-linked examples. Import public helpers from `expo-native-workspace`. Config files execute code: inspect import and environment failures as well as schema errors.

## A plan looks correct but native changes are absent

Check that `expo-native-workspace/plugin` is registered in Expo's resolved config, then rerun prebuild for the relevant platform. Planning alone does not apply anything. A previously installed development build does not update merely because Metro restarts.

## An extension does not build or appear

Confirm native sources exist in the configured source directory. Check bundle IDs, deployment targets, principal class / WidgetKit entry point, and Info.plist activation rules. Build and launch the host app before checking the widget gallery or share sheet. Device builds need valid signing for the host and extension. App Groups are necessary only for shared storage and require matching provisioning.

## A local native dependency cannot be found

SPM and CocoaPods paths resolve from generated `ios/`. In the sample, `../native/WorkspaceMath` resolves to `apps/native-dependencies/native/WorkspaceMath`. Confirm declared product and pod names match their manifests. Prebuild with `--no-install` intentionally skips CocoaPods installation.

## Android permission or feature behaves unexpectedly

A manifest permission is separate from runtime permission approval. Optional features use `required: false`; required hardware can exclude devices. Confirm the merged manifest rather than just a source manifest, because dependencies and other plugins also contribute entries.

## Repeated prebuild leaves stale changes

Save manual edits and inspect generated blocks first. Deleting a declaration removes its tagged block on the next prebuild, but it does not reverse everything: entries merged into structured files (a `gradle.properties` key, a manifest permission) and escape-hatch `replace` rules stay until a clean prebuild. For a managed native project, clean regeneration establishes the current desired state; it deletes generated native folders and should only be used once manual work is preserved.

## Inspecting what the plugins actually did

Expo's own debugging tools see the whole plugin stack, not just this package:

```bash
EXPO_DEBUG=1 npx expo prebuild
```

That prints which mods ran and in what order — the fastest way to find out whether another plugin overwrote a change. `npx expo config --type prebuild` prints the resolved config with mods unevaluated, and `npx expo config --type introspect` evaluates the _safe_ mods without writing to the project.

Introspection only covers static files: `android.manifest`, `gradleProperties`, `strings`, `colors`, `styles`, `ios.infoPlist`, `entitlements`, `expoPlist` and `podfileProperties`. Fields of this package that map onto those mods (`android.permissions`, `features`, `metaData`, `components`, `supportsScreens`, `strings`, `colors`, `styles`, `gradleProperties`, SDK versions, `ios.podfileProperties`) therefore show up in introspection. Everything that touches the Podfile, the Xcode project, Gradle files or entry-point sources does not, and needs a real prebuild to inspect.

## A change conflicts with another config plugin

Plugins run in registration order and the last write wins. If another plugin also edits the Podfile or a Gradle file, register this one after it, or move the change into a typed field that merges rather than replaces. `expo-build-properties` in particular owns `useFrameworks`, `packagingOptions`, ProGuard and the host deployment target; declare those there, not here, so the two plugins do not fight.

An escape-hatch `replace` that silently does nothing is usually an ordering problem: the text it targets has not been written yet. Pass `required: true` on the rule to turn that silence into a build failure.

## Reporting a bug

Include package, Node, Expo and platform-toolchain versions, a small config, command and redacted error output, and whether the issue reproduces from a packed package. Never include keystore passwords, provisioning secrets or private environment values. Security reports follow [SECURITY.md](../SECURITY.md).
