# Multiple Schemes

Open the generated Xcode workspace and choose WorkspaceDevelopment or WorkspaceProduction. Both use the same app identity.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @expo-native-workspace/example-multi-scheme validate
pnpm --filter @expo-native-workspace/example-multi-scheme plan
pnpm --filter @expo-native-workspace/example-multi-scheme prebuild --platform ios --no-install
pnpm --filter @expo-native-workspace/example-multi-scheme ios
```

The final command requires macOS, Xcode and CocoaPods. Native compilation and interactive behavior require separate verification; a successful plan or prebuild does not prove them. Generated `ios/` and `android/` folders are disposable only after preserving manual edits.

For a simulator compilation check after CocoaPods installation, open the generated `.xcworkspace` in Xcode, select the host scheme and an iOS Simulator, and choose Product → Build. A successful `expo run:ios` also compiles and launches the host app. For share/widget samples, then exercise the share sheet/widget gallery manually. A host launch alone does not verify extension interaction.
