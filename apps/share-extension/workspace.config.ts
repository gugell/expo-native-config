import { defineWorkspace, RunScript, Target, XcodeBuildSettings } from 'expo-native-config';

export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    targets: [
      Target.share({
        name: 'WorkspaceShare',
        source: './targets/WorkspaceShare',
        bundleIdentifier: '.share',
        deploymentTarget: '18.0',
      }),
    ],
    // Build settings on the host app target, not the extension. The named
    // fields spell the Xcode keys, and booleans become YES/NO.
    buildSettings: XcodeBuildSettings.of({ ldExportSymbols: false }),
    // Podfile.properties.json is the mechanism Expo documents as safe for
    // Podfile configuration: the template reads it, no Ruby is rewritten.
    podfileProperties: { 'expo.jsEngine': 'hermes' },
    runScripts: [
      RunScript.shell('Workspace Sample Script', 'echo "expo-native-config sample build phase"'),
    ],
  },
});
