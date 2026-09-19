# Android Gradle

This app declares AndroidX Collection and a Gradle property, plus the Gradle and manifest surface beyond dependencies: an ABI filter, a manifest placeholder, a BuildConfig field, an `<application>` `<meta-data>` entry, a `tools:node="remove"` for a receiver a dependency merges in, and a `strings.xml` value.

After prebuild, inspect:

| File                                          | What to look for                                                 |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `android/app/build.gradle`                    | `ndk { abiFilters }`, `manifestPlaceholders`, `buildConfigField` |
| `android/gradle.properties`                   | `org.gradle.parallel`, `reactNativeArchitectures`                |
| `android/app/src/main/AndroidManifest.xml`    | `<meta-data>`, `<receiver … tools:node="remove">`                |
| `android/app/src/main/res/values/strings.xml` | `workspace_sample_value`                                         |

Deleting a declaration and prebuilding again removes its generated block; the tagged blocks are what makes that possible.

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @expo-native-config/example-android-gradle validate
pnpm --filter @expo-native-config/example-android-gradle plan
pnpm --filter @expo-native-config/example-android-gradle prebuild --platform android --no-install
pnpm --filter @expo-native-config/example-android-gradle android
```

The final command requires a JDK, Android SDK and emulator or connected device. Native compilation and interactive behavior require separate verification; a successful plan or prebuild does not prove them. Generated `ios/` and `android/` folders are disposable only after preserving manual edits.

For an APK compilation check after prebuild:

```sh
cd android
./gradlew :app:assembleDebug
```

Run from this sample directory before entering `android/`. A successful `expo run:android` additionally installs and launches the app.
