/** Stable top-level anchor for workspace-owned extension Podfile targets. */
export const TARGETS_LOADER_MARKER = 'expo-native-config-extension-targets';
export function buildTargetsPodfileLoader(_targetsRoot: string): string {
  return `# ${TARGETS_LOADER_MARKER}\n`;
}
