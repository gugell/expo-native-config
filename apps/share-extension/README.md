# Share Extension

Receive text and web links from the iOS share sheet. Build this app, open Safari, choose Share, and enable Workspace Share.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @expo-native-workspace/example-share-extension validate
pnpm --filter @expo-native-workspace/example-share-extension plan
pnpm --filter @expo-native-workspace/example-share-extension prebuild --platform ios --no-install
pnpm --filter @expo-native-workspace/example-share-extension ios
```

The final command requires macOS, Xcode and CocoaPods. Native compilation and interactive behavior require separate verification; a successful plan or prebuild does not prove them. Generated `ios/` and `android/` folders are disposable only after preserving manual edits.

No App Group entitlement is needed: this example does not share storage with the host app. When adding shared storage, configure the same registered App Group on both targets and regenerate provisioning profiles. Physical-device builds require your own Apple signing team.

For a simulator compilation check after CocoaPods installation, open the generated `.xcworkspace` in Xcode, select the host scheme and an iOS Simulator, and choose Product → Build. A successful `expo run:ios` also compiles and launches the host app. For share/widget samples, then exercise the share sheet/widget gallery manually. A host launch alone does not verify extension interaction.

For a headless unsigned host build after installing pods, run from this app directory:

```sh
xcodebuild -workspace ios/ShareExtension.xcworkspace -scheme ShareExtension \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/expo-native-workspace-host-build \
  CODE_SIGNING_ALLOWED=NO build
```

The workspace is created by `pod install` from `ios/`; use the documented Node version on your PATH when installing pods and building.
