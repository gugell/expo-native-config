import type { WorkspaceConfig } from './schema';

export interface GuidanceDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  source?: string;
}

/** Dotted versions, shortest form wins nothing: 16.4 and 16.4.0 compare equal. */
function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

/** Text of every escape hatch, with the field it came from. */
function escapeHatchSources(config: WorkspaceConfig): Array<{ source: string; text: string }> {
  const entries: Array<{ source: string; text: string }> = [];
  const podfile = config.ios?.podfile;
  for (const [index, line] of (podfile?.postInstall ?? []).entries()) {
    entries.push({ source: `ios.podfile.postInstall[${index}]`, text: line });
  }
  for (const [index, line] of (podfile?.lines ?? []).entries()) {
    entries.push({ source: `ios.podfile.lines[${index}]`, text: line });
  }
  for (const [index, rule] of (podfile?.replace ?? []).entries()) {
    entries.push({
      source: `ios.podfile.replace[${index}]`,
      text: `${rule.find} ${rule.replacement}`,
    });
  }
  for (const file of ['app', 'project', 'settings'] as const) {
    for (const [index, rule] of (config.android?.gradle?.[file] ?? []).entries()) {
      entries.push({
        source: `android.gradle.${file}[${index}]`,
        text: `${rule.find} ${rule.replacement}`,
      });
    }
  }
  return entries;
}

/** Gradle properties that belong to a plugin Expo already ships. */
const BUILD_PROPERTY_OWNERS: Array<[RegExp, string]> = [
  [
    /^android\.enableProguardInReleaseBuilds$/i,
    'expo-build-properties android.enableProguardInReleaseBuilds',
  ],
  [/^android\.enableShrinkResourcesInReleaseBuilds$/i, 'expo-build-properties'],
  [/^expo\.useLegacyPackaging$/i, 'expo-build-properties android.useLegacyPackaging'],
  [/^newArchEnabled$/i, 'expo.newArchEnabled in the Expo config'],
  [/^expo\.jsEngine$/i, 'expo.jsEngine in the Expo config'],
];

/** Build settings that another tool owns, and the tool that owns them. */
const BUILD_SETTING_OWNERS: Array<[string, string]> = [
  ['IPHONEOS_DEPLOYMENT_TARGET', 'expo-build-properties ios.deploymentTarget'],
  ['SWIFT_VERSION', 'the target that needs it, or expo-build-properties'],
  ['PRODUCT_BUNDLE_IDENTIFIER', 'expo.ios.bundleIdentifier in the Expo config'],
  ['MARKETING_VERSION', 'expo.version in the Expo config'],
  ['CURRENT_PROJECT_VERSION', 'expo.ios.buildNumber in the Expo config'],
];

/**
 * Diagnostics that teach the supported way to do something the config is
 * attempting the hard way. These are about *where a change belongs*, not
 * whether it parses — the schema already answers that.
 *
 * Only the entry-point rule is an error: this package will not edit
 * AppDelegate or MainApplication, and a regular expression aimed at one is the
 * same change wearing a disguise.
 */
export function collectGuidance(
  config: WorkspaceConfig,
  appDeploymentTarget?: string,
): GuidanceDiagnostic[] {
  const diagnostics: GuidanceDiagnostic[] = [];

  const minimumPod = config.ios?.minimumPodDeploymentTarget;
  if (
    appDeploymentTarget &&
    minimumPod &&
    minimumPod !== 'inherit' &&
    compareVersions(minimumPod, appDeploymentTarget) < 0
  ) {
    diagnostics.push({
      severity: 'warning',
      code: 'guidance.pod-deployment-target',
      source: 'ios.minimumPodDeploymentTarget',
      message: `ios.minimumPodDeploymentTarget (${minimumPod}) is below the app's own iOS deployment target (${appDeploymentTarget}, from expo-build-properties), so pods keep a version Xcode warns about. Use "inherit" to track it instead of restating it.`,
    });
  }

  for (const { source, text } of escapeHatchSources(config)) {
    if (/AppDelegate|MainApplication|MainActivity\.(kt|java)/i.test(text)) {
      diagnostics.push({
        severity: 'error',
        code: 'guidance.entry-point',
        source,
        message: `${source} targets a generated entry point. This package does not edit AppDelegate or MainApplication, and a replace rule aimed at one breaks on the SDK that changes its shape. Use an ExpoAppDelegateSubscriber or a ReactActivityLifecycleListener in a local Expo module (npx create-expo-module --local), with its configuration in android.strings.`,
      });
    }
    if (/use_frameworks!/.test(text)) {
      diagnostics.push({
        severity: 'warning',
        code: 'guidance.use-frameworks',
        source,
        message: `${source} sets use_frameworks!. expo-build-properties owns ios.useFrameworks; setting it here fights whichever plugin runs last.`,
      });
    }
  }

  for (const resource of config.android?.resources ?? []) {
    const match = /^values(?:-[^/]+)?\/(strings|colors|styles)\.xml$/.exec(resource.path);
    if (match) {
      diagnostics.push({
        severity: 'warning',
        code: 'guidance.typed-resource',
        source: `android.resources (${resource.path})`,
        message: `android.resources writes ${resource.path} as a whole file, replacing what other plugins put there. Use android.${match[1]} instead: it merges through Expo's own mod and shows up in "expo config --type introspect".`,
      });
    }
  }

  for (const key of Object.keys(config.android?.gradleProperties ?? {})) {
    const owner = BUILD_PROPERTY_OWNERS.find(([pattern]) => pattern.test(key));
    if (owner) {
      diagnostics.push({
        severity: 'warning',
        code: 'guidance.owned-elsewhere',
        source: `android.gradleProperties.${key}`,
        message: `${key} is owned by ${owner[1]}. Declaring it here duplicates that setting, and the two can disagree.`,
      });
    }
  }

  for (const [setting, owner] of BUILD_SETTING_OWNERS) {
    if (config.ios?.buildSettings && setting in config.ios.buildSettings) {
      diagnostics.push({
        severity: 'warning',
        code: 'guidance.owned-elsewhere',
        source: `ios.buildSettings.${setting}`,
        message: `${setting} is owned by ${owner}. Setting it on the target directly is overwritten whenever that owner regenerates the project.`,
      });
    }
  }

  return diagnostics;
}
