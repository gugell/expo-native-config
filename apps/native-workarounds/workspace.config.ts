import {
  Abi,
  AndroidApplication,
  AndroidComponent,
  AndroidDependency,
  AndroidModule,
  BuildConfigField,
  defineWorkspace,
  MavenRepository,
  PodBuildSettings,
  ReplaceRule,
  RunScript,
  XcodeBuildSettings,
} from 'expo-native-config';

/**
 * The workarounds an Expo app reaches for once a dependency misbehaves —
 * declared instead of hand-written as one config plugin each. Every entry here
 * replaces a plugin this repository has seen in a production app.
 */
export default defineWorkspace({
  schemaVersion: 1,
  ios: {
    // A pod that ships a lower deployment target than the app fails to build
    // against a newer SDK; this raises the floor without touching the app's own.
    // Tracks expo-build-properties ios.deploymentTarget in app.json instead of
    // restating the version, which is how the two drift apart.
    minimumPodDeploymentTarget: 'inherit',
    // Typed Ruby globals, the supported form of the `$RNFirebaseAsStaticFramework`
    // line people paste into a Podfile.
    podfileGlobals: { WorkspaceSampleStaticFramework: true },
    // Podfile.properties.json is the channel Expo documents as safe: the
    // template reads it, so nothing rewrites Ruby and introspection can see it.
    podfileProperties: { 'expo.jsEngine': 'hermes' },
    // Static frameworks turn a vendor pod's plain `#import <React/...>` into a
    // hard error. Scope the escape to the offending pod, never the whole project.
    podBuildSettings: [
      PodBuildSettings.forTargetsStartingWith('WorkspaceSample', {
        CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES: 'YES',
      }),
    ],
    // Xcode 16 runs this phase for every pod and it fails on some of them.
    removePodBuildPhases: [
      { target: { startsWith: 'WorkspaceSample' }, phase: 'ExtractAppIntentsMetadata' },
    ],
    // A package whose config plugin is autolinked but whose native dependency is
    // disabled breaks pod install and Gradle configuration on both platforms.
    autolinkingExclude: ['@expo-native-config/absent-module'],
    // Build settings on the host app target, not on an extension.
    buildSettings: XcodeBuildSettings.of({ ldExportSymbols: false }),
    // The shape of a crash-reporter dSYM upload phase, without the vendor.
    runScripts: [
      RunScript.onInstall(
        'Workspace Upload Symbols',
        'echo "expo-native-config: upload dSYMs here (archive builds only)"',
      ),
    ],
    podfile: {
      // Raw post_install lines, for the case no typed field covers.
      postInstall: ["Pod::UI.puts 'expo-native-config: post_install hook ran'"],
      // The monorepo fix: a vendor plugin writes `../node_modules/<pkg>`, which
      // resolves to nothing once a workspace hoists that package. Nothing
      // matches in this sample — no such plugin is installed — so `required` is
      // false here. In a real app it must be true, or the day the vendor
      // changes that line the build silently loses the fix.
      replace: [
        {
          ...ReplaceRule.regex(
            String.raw`:path\s*=>\s*['"]\.\.(\/\.\.)*\/node_modules\/absent-vendor-pod['"]`,
            ":path => '/resolved/absolute/path'",
          ),
          all: true,
          required: false,
        },
      ],
    },
  },
  android: {
    // Preview-class builds ship one ABI; this also sets React Native's own
    // reactNativeArchitectures, without which every ABI is still compiled.
    abiFilters: [Abi.arm64],
    // A dependency that only exists on JitPack, and a private repository whose
    // credentials stay in the environment.
    mavenRepositories: [
      MavenRepository.url('https://www.jitpack.io'),
      MavenRepository.scoped('https://maven.google.com', ['com.google.android.material']),
    ],
    // Buildscript classpath for a Gradle plugin. Applying google-services also
    // needs its credentials file, so this sample stops at the classpath.
    buildscriptDependencies: ['com.google.gms:google-services:4.4.2'],
    // Two libraries pulling incompatible copies of the same artifact is the
    // usual reason an Android build fails to link resources.
    forceDependencies: ['com.google.android.material:material:1.12.0'],
    // A local Gradle module plus the dependency that actually links it.
    modules: [AndroidModule.at('workspace-native-lib', 'native/workspace-native-lib')],
    dependencies: [AndroidDependency.project('workspace-native-lib')],
    autolinkingExclude: ['@expo-native-config/absent-module'],
    manifestPlaceholders: { workspaceRedirectScheme: 'dev.exponativeconfig.workarounds' },
    buildConfigFields: [BuildConfigField.string('WORKSPACE_CHANNEL', 'preview')],
    // An SDK key belongs in <meta-data>, which `applicationAttributes` cannot express.
    metaData: { 'dev.exponativeconfig.SAMPLE_KEY': 'workspace-demo' },
    components: [
      // Attributes merged onto the activity Expo generates.
      AndroidComponent.activity('.MainActivity', {
        'android:windowSoftInputMode': 'adjustResize',
        'android:launchMode': 'singleTask',
      }),
      // A receiver a dependency merges into every manifest, dropped the
      // supported way instead of editing generated XML.
      AndroidComponent.remove('receiver', 'androidx.profileinstaller.ProfileInstallReceiver'),
    ],
    supportsScreens: { largeScreens: false, xlargeScreens: false },
    // Package visibility: without this, an intent to another app resolves to
    // nothing on Android 11+ and the failure looks like a missing app.
    queries: {
      schemes: ['geo'],
      packages: ['com.google.android.apps.maps'],
    },
    // Values native code reads before the JS engine starts, and a colour the
    // generated theme can reference. Both go through Expo's own mods.
    // Read by StartupLifecycleListener in modules/startup before the JS engine
    // starts. A string resource is the documented channel for that.
    strings: {
      workspace_sample_value: 'hello from workspace.config.ts',
      startup_value: 'configured by workspace.config.ts',
    },
    colors: { workspace_sample_accent: '#8bdad2' },
    // A resource file with no typed mod. This one permits cleartext traffic to
    // a debug proxy — the reason people hand-write this file — and is paired
    // with the application attributes below.
    resources: [
      {
        path: 'xml/workspace_network_security_config.xml',
        contents: [
          '<?xml version="1.0" encoding="utf-8"?>',
          '<network-security-config>',
          '  <!-- Debug-only: trust the user CA store so a proxy can be used.',
          '       Do not ship this configuration in a release build. -->',
          '  <debug-overrides>',
          '    <trust-anchors>',
          '      <certificates src="system" />',
          '      <certificates src="user" />',
          '    </trust-anchors>',
          '  </debug-overrides>',
          '</network-security-config>',
          '',
        ].join('\n'),
      },
    ],
    applicationAttributes: AndroidApplication.attributes({
      networkSecurityConfig: '@xml/workspace_network_security_config',
      // Large media assets exhaust the default heap before they exhaust memory.
      largeHeap: true,
    }),
  },
});
