import { defineWorkspace, widgetExtension } from 'expo-native-config';
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      widgetExtension({
        name: 'WorkspaceWidget',
        source: './targets/WorkspaceWidget',
        bundleIdentifier: '.widget',
        deploymentTarget: '18.0',
      }),
    ],
  },
});
