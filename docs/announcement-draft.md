# Preview announcement draft

Publish only after the registry release and installation smoke check succeed. Replace links with the verified public repository.

## Draft

Expo Native Workspace keeps application-level native configuration in one typed file.

Declare share extensions, widgets, Swift packages, CocoaPods, Xcode schemes and Android settings in `workspace.config.ts`. Run `expo-native-workspace plan` to inspect the intended operations, then let Expo prebuild generate the native project.

The first preview includes six complete sample apps, strict config validation, JSON diagnostics, a doctor command and agent skills. It targets Expo SDK 56. Removing declared native configuration requires a clean prebuild; the plan does not compare generated native state.

Try the share-extension sample first. Feedback is particularly useful from apps currently maintaining local config plugins or manual Xcode edits.

## Demo script

1. Start with the checked-in share-extension sample and show its Swift source and config.
2. Run `pnpm validate`, then `pnpm plan` from that app.
3. Run `pnpm prebuild --clean --platform ios` and show the generated extension target.
4. After a verified native build, demonstrate the actual share-sheet UI.
5. Run clean prebuild again to demonstrate reproducible configuration.

Use real output. Do not describe simulator compilation as physical-device signing or store approval.
