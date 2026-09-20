import { defineWorkspace } from 'expo-native-config';

// The widget's source and declaration live in packages/workspace-widget-target,
// so more than one app could ship it. See docs/targets.md for the other three
// ways to include a target.
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      {
        package: 'workspace-widget-target',
        name: 'WorkspaceWidget',
        bundleIdentifier: '.widget',
      },
    ],
  },
});
