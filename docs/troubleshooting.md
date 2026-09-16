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

Save manual edits and inspect generated blocks first. Removing a declaration is not a universal cleanup operation. For a managed native project, clean regeneration can establish the current desired state; it deletes generated native folders and should only be used once manual work is preserved.

## Reporting a bug

Include package, Node, Expo and platform-toolchain versions, a small config, command and redacted error output, and whether the issue reproduces from a packed package. Never include keystore passwords, provisioning secrets or private environment values. Security reports follow [SECURITY.md](../SECURITY.md).
