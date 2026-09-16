# Android Gradle

This app declares AndroidX Collection and a Gradle property. Inspect android/app/build.gradle and android/gradle.properties after prebuild.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @expo-native-workspace/example-android-gradle validate
pnpm --filter @expo-native-workspace/example-android-gradle plan
pnpm --filter @expo-native-workspace/example-android-gradle prebuild --platform android --no-install
pnpm --filter @expo-native-workspace/example-android-gradle android
```

The final command requires a JDK, Android SDK and emulator or connected device. Native compilation and interactive behavior require separate verification; a successful plan or prebuild does not prove them. Generated `ios/` and `android/` folders are disposable only after preserving manual edits.

For an APK compilation check after prebuild:

```sh
cd android
./gradlew :app:assembleDebug
```

Run from this sample directory before entering `android/`. A successful `expo run:android` additionally installs and launches the app.
