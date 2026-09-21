import { z } from 'zod';
import { isRecord } from './guards';
import { ERR } from './validation';
import type { WorkspaceAppConfig } from './types';

/**
 * Only the one field this package reads. `expo-build-properties` owns the app's
 * iOS deployment target — there is no Expo manifest field for it — so a
 * workspace config that needs the same number either restates it or inherits it.
 */
const BuildPropertiesSchema = z.object({
  ios: z.object({ deploymentTarget: z.string() }).partial().optional(),
});

export interface AppDeploymentTarget {
  /** The app's own iOS deployment target, when one is declared and visible. */
  value?: string;
  /**
   * Whether the Expo config's `plugins` array could be read at all.
   *
   * `getConfig(root, { skipPlugins: true })` *deletes* `exp.plugins`, so the
   * CLI cannot see them for a dynamic `app.config.ts`. The Expo plugin runs
   * with the live config and always can. An absent value therefore means "not
   * declared" in the plugin and "cannot tell yet" in the CLI, and only the
   * first of those is an error.
   */
  visible: boolean;
}

/** The app's iOS deployment target as declared by `expo-build-properties`. */
export function appDeploymentTarget(config: WorkspaceAppConfig): AppDeploymentTarget {
  const plugins: unknown = config.plugins;
  if (!Array.isArray(plugins)) return { visible: false };
  for (const entry of plugins) {
    // A bare 'expo-build-properties' string carries no props, so it sets nothing.
    if (!Array.isArray(entry) || entry[0] !== 'expo-build-properties') continue;
    const parsed = BuildPropertiesSchema.safeParse(entry[1]);
    const target = parsed.success ? parsed.data.ios?.deploymentTarget : undefined;
    if (target) return { value: target, visible: true };
  }
  return { visible: true };
}

const INHERITABLE = ['deploymentTarget', 'minimumPodDeploymentTarget'] as const;

/**
 * Replace `'inherit'` iOS deployment targets with the app's own, before the
 * config is flattened. Resolution belongs here rather than in `normalize`
 * because this is the only layer that holds the Expo config.
 *
 * When the plugins array is not visible the value stays unresolved and the
 * caller warns: the Expo plugin resolves it during prebuild, which is the run
 * that writes files.
 */
export function resolveInheritedDeploymentTargets<T>(
  workspaceConfig: T,
  app: AppDeploymentTarget,
): { config: T; warnings: string[] } {
  if (!isRecord(workspaceConfig) || !isRecord(workspaceConfig.ios)) {
    return { config: workspaceConfig, warnings: [] };
  }
  const ios = { ...workspaceConfig.ios };
  const warnings: string[] = [];
  let changed = false;
  for (const field of INHERITABLE) {
    if (ios[field] !== 'inherit') continue;
    changed = true;
    if (app.value) {
      ios[field] = app.value;
      continue;
    }
    if (app.visible) {
      throw new Error(
        `${ERR} ios.${field} is "inherit", but the Expo config does not set expo-build-properties ios.deploymentTarget. Add it there, or write the version in ios.${field}.`,
      );
    }
    delete ios[field];
    warnings.push(
      `ios.${field} is "inherit"; this command cannot read the Expo config's plugins, so the value is resolved during prebuild and is missing from this plan.`,
    );
  }
  if (!changed) return { config: workspaceConfig, warnings: [] };
  return { config: { ...workspaceConfig, ios } as T, warnings };
}
