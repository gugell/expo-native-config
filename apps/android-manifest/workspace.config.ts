import { androidFeature, defineWorkspace } from 'expo-native-workspace';
export default defineWorkspace({
  schemaVersion: 1,
  android: {
    permissions: ['android.permission.CAMERA'],
    features: [androidFeature('android.hardware.camera', false)],
    applicationAttributes: { 'android:supportsRtl': 'true' },
  },
});
