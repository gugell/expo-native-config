import { defineWorkspace, Target } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      Target.widget({
        name: 'WorkspaceWidget',
        source: './targets/WorkspaceWidget',
        bundleIdentifier: '.widget',
        deploymentTarget: '18.0',
      }),
    ],
  },
});
