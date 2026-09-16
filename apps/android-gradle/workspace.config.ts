import { androidLibrary, defineWorkspace } from 'expo-native-workspace';
export default defineWorkspace({
  schemaVersion: 1,
  android: {
    dependencies: [androidLibrary('androidx.collection:collection-ktx:1.4.5')],
    gradleProperties: { 'org.gradle.parallel': true },
  },
});
