# Home Screen Widget

Build the iOS app, then add Workspace Widget from the Home Screen widget gallery. The native widget shows a daily focus prompt.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @expo-native-config/example-widget validate
pnpm --filter @expo-native-config/example-widget plan
pnpm --filter @expo-native-config/example-widget prebuild --platform ios --no-install
pnpm --filter @expo-native-config/example-widget ios
```

The final command requires macOS, Xcode and CocoaPods. Native compilation and interactive behavior require separate verification; a successful plan or prebuild does not prove them. Generated `ios/` and `android/` folders are disposable only after preserving manual edits.

No App Group entitlement is needed: this example does not share storage with the host app. When adding shared storage, configure the same registered App Group on both targets and regenerate provisioning profiles. Physical-device builds require your own Apple signing team.

For a simulator compilation check after CocoaPods installation, open the generated `.xcworkspace` in Xcode, select the host scheme and an iOS Simulator, and choose Product → Build. A successful `expo run:ios` also compiles and launches the host app. For share/widget samples, then exercise the share sheet/widget gallery manually. A host launch alone does not verify extension interaction.
