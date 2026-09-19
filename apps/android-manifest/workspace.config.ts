import {
  AndroidApplication,
  AndroidFeature,
  AndroidHardware,
  AndroidPermission,
  defineWorkspace,
} from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  android: {
    permissions: [AndroidPermission.camera],
    // Optional hardware: declaring it required would stop devices without a
    // camera from installing the app at all.
    features: [AndroidFeature.optional(AndroidHardware.camera)],
    // Named flags rather than 'android:' keys and stringly-typed booleans.
    applicationAttributes: AndroidApplication.attributes({ supportsRtl: true }),
  },
});
