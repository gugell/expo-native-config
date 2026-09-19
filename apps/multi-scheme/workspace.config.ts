import { defineWorkspace, Scheme } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    // The constructor names the configuration, so the pair cannot drift:
    // Scheme.debug builds Debug, Scheme.release builds Release.
    schemes: [
      Scheme.debug('WorkspaceDevelopment', { archive: 'Release' }),
      Scheme.release('WorkspaceProduction', { archive: 'Release' }),
    ],
  },
});
