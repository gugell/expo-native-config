import { defineWorkspace } from 'expo-native-workspace';
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    packages: [{ path: '../native/WorkspaceMath', products: ['WorkspaceMath'] }],
    pods: [{ pod: 'WorkspaceGreeting', path: '../native/WorkspaceGreeting' }],
  },
});
