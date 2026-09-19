# Native Dependencies

A local Swift package and CocoaPod are linked to the iOS app. Inspect the generated Xcode project and Podfile after prebuild.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @expo-native-config/example-native-dependencies validate
pnpm --filter @expo-native-config/example-native-dependencies plan
pnpm --filter @expo-native-config/example-native-dependencies prebuild --platform ios --no-install
pnpm --filter @expo-native-config/example-native-dependencies ios
```

The final command requires macOS, Xcode and CocoaPods. Native compilation and interactive behavior require separate verification; a successful plan or prebuild does not prove them. Generated `ios/` and `android/` folders are disposable only after preserving manual edits.

The local libraries contain callable native functions, but are not exposed to JavaScript. Linking a dependency does not create an Expo module. Paths are relative to generated `ios/`, so `../native/...` resolves to source-controlled files. No external SDK repository is required.

For a simulator compilation check after CocoaPods installation, open the generated `.xcworkspace` in Xcode, select the host scheme and an iOS Simulator, and choose Product → Build. A successful `expo run:ios` also compiles and launches the host app. For share/widget samples, then exercise the share sheet/widget gallery manually. A host launch alone does not verify extension interaction.
