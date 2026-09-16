import { defineWorkspace, shareExtension } from 'expo-native-workspace';
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      shareExtension({
        name: 'WorkspaceShare',
        source: './targets/WorkspaceShare',
        bundleIdentifier: '.share',
        deploymentTarget: '18.0',
      }),
    ],
  },
});
