import { defineWorkspace, Package, Pod } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    // Both paths resolve from the generated ios/ directory, not from this file.
    packages: [Package.local('../native/WorkspaceMath', ['WorkspaceMath'])],
    pods: [Pod.local('WorkspaceGreeting', '../native/WorkspaceGreeting')],
  },
});
