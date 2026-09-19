import {
  AndroidApplication,
  AndroidFeature,
  AndroidHardware,
  defineWorkspace,
} from 'expo-native-config';

// The camera permission lives in app.json, under expo.android.permissions:
// Expo owns permissions, and declaring them here as well would split the
// answer to "what does this app request?" across two files.
export default defineWorkspace({
  schemaVersion: 1,
  android: {
    // <uses-feature> has no equivalent in the Expo config, so it belongs here.
    // Optional hardware: required would stop devices without a camera from
    // installing the app at all.
    features: [AndroidFeature.optional(AndroidHardware.camera)],
    applicationAttributes: AndroidApplication.attributes({ supportsRtl: true }),
  },
});
