import type { ConfigPlugin } from '@expo/config-plugins';
import type { WorkspaceConfig } from '../schema';
import { collectWorkspacePlan, fileExecutor, normalizeWorkspaceConfig } from './core';
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
import { sourceExecutor, sourceGenerator } from './source';
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
  sourceGenerator,
];
const executors = [
  fileExecutor,
  androidExecutor,
  queriesExecutor,
  podfilePropertiesExecutor,
  sourceExecutor,
  pbxExecutor,
];

export function collect(
  workspaceConfig: WorkspaceConfig,
  projectRoot: string,
  appConfig: WorkspaceAppConfig,
): WorkspacePlan {
  return collectWorkspacePlan(generators, {
    manifest: normalizeWorkspaceConfig(workspaceConfig),
    projectRoot,
    configPath: 'workspace.config.ts',
    config: {
      ...appConfig,
      ios: appConfig.ios ? { ...appConfig.ios } : undefined,
      extra: JSON.parse(JSON.stringify(appConfig.extra ?? {})),
    },
  });
}
export const apply: ConfigPlugin<WorkspacePlan> = (config, plan) => {
  let next = { ...config, ...plan.config } as typeof config;
  for (const executor of executors) next = executor(next, plan.ops);
  return next;
};
export type { WorkspaceAppConfig, WorkspacePlan, Op, PlanOperation } from './core';
export { toPlanOperation, redactDeep, configPlugins } from './core';
