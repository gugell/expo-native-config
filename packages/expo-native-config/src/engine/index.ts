import type { ConfigPlugin } from '@expo/config-plugins';
import type { WorkspaceConfig } from '../schema';
import {
  appDeploymentTarget,
  collectWorkspacePlan,
  fileExecutor,
  normalizeWorkspaceConfig,
  resolveInheritedDeploymentTargets,
} from './core';
import type { WorkspaceAppConfig, WorkspacePlan } from './core';
import { androidExecutor, androidGenerator } from './android';
import { androidLintGenerator } from './android/generators/lint';
import { gradleExtrasGenerator } from './android/generators/gradleExtras';
import { manifestExtrasGenerator } from './android/generators/manifestExtras';
import { androidResourcesGenerator } from './android/generators/resources';
import {
  podsGenerator,
  podfileExtrasGenerator,
  podfilePropertiesGenerator,
  podfilePropertiesExecutor,
} from './ios-pods';
import { podSettingsGenerator } from './ios-pods/generators/settings';
import { queriesGenerator, queriesExecutor } from './android/queries';
import { targetsGenerator } from './ios-targets';
import { spmGenerator } from './ios-spm';
import {
  pbxExecutor,
  schemesGenerator,
  xcodeEnvGenerator,
  fixEmbedCycleGenerator,
  mainTargetGenerator,
} from './ios-xcode';

const generators = [
  podsGenerator,
  podSettingsGenerator,
  podfileExtrasGenerator,
  podfilePropertiesGenerator,
  targetsGenerator,
  spmGenerator,
  xcodeEnvGenerator,
  schemesGenerator,
  fixEmbedCycleGenerator,
  mainTargetGenerator,
  androidGenerator,
  androidLintGenerator,
  gradleExtrasGenerator,
  manifestExtrasGenerator,
  androidResourcesGenerator,
  queriesGenerator,
];
const executors = [
  fileExecutor,
  androidExecutor,
  queriesExecutor,
  podfilePropertiesExecutor,
  pbxExecutor,
];

export function collect(
  workspaceConfig: WorkspaceConfig,
  projectRoot: string,
  appConfig: WorkspaceAppConfig,
): WorkspacePlan {
  const { config, warnings } = resolveInheritedDeploymentTargets(
    workspaceConfig,
    appDeploymentTarget(appConfig),
  );
  const plan = collectWorkspacePlan(generators, {
    manifest: normalizeWorkspaceConfig(config),
    projectRoot,
    configPath: 'workspace.config.ts',
    config: {
      ...appConfig,
      ios: appConfig.ios ? { ...appConfig.ios } : undefined,
      extra: JSON.parse(JSON.stringify(appConfig.extra ?? {})),
    },
  });
  plan.warnings.push(...warnings);
  return plan;
}
export const apply: ConfigPlugin<WorkspacePlan> = (config, plan) => {
  let next = { ...config, ...plan.config } as typeof config;
  for (const executor of executors) next = executor(next, plan.ops);
  return next;
};
export type { WorkspaceAppConfig, WorkspacePlan, Op, PlanOperation } from './core';
export { toPlanOperation, redactDeep, configPlugins, appDeploymentTarget } from './core';
export type { AppDeploymentTarget } from './core';
