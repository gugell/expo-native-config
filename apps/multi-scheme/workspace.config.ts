import { defineWorkspace, scheme } from 'expo-native-workspace';
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    schemes: [
      scheme({ name: 'WorkspaceDevelopment', configuration: 'Debug', archive: 'Release' }),
      scheme({ name: 'WorkspaceProduction', configuration: 'Release', archive: 'Release' }),
    ],
  },
});
