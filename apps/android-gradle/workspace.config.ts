import {
  Abi,
  AndroidComponent,
  AndroidDependency,
  BuildConfigField,
  defineWorkspace,
} from 'expo-native-workspace';

export default defineWorkspace({
  schemaVersion: 1,
  android: {
    dependencies: [AndroidDependency.library('androidx.collection:collection-ktx:1.4.5')],
    gradleProperties: { 'org.gradle.parallel': true },
    // arm64 only keeps this sample's APK small; production builds usually keep
    // all four ABIs (Abi.all) so the Play Store can split per device.
    abiFilters: [Abi.arm64],
    manifestPlaceholders: { workspaceRedirectScheme: 'dev.exponativeworkspace.androidgradle' },
    buildConfigFields: [BuildConfigField.string('WORKSPACE_TAG', 'android-gradle')],
    metaData: { 'dev.exponativeworkspace.SAMPLE_KEY': 'workspace-demo' },
    // A dependency merges this receiver into every manifest; `remove` is the
    // supported way to drop it rather than editing the generated XML.
    components: [
      AndroidComponent.remove('receiver', 'androidx.profileinstaller.ProfileInstallReceiver'),
    ],
    strings: { workspace_sample_value: 'hello from workspace.config.ts' },
    mainApplication: {
      imports: ['import android.util.Log'],
      onCreate: ['Log.i("workspace", "injected by expo-native-workspace")'],
    },
  },
});
