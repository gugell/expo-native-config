import type { ConfigPlugin } from '@expo/config-plugins';
import type { WorkspaceConfig } from '../schema';
import { collectWorkspacePlan, fileExecutor, normalizeWorkspaceConfig } from './core';
import type { WorkspaceAppConfig, WorkspacePlan } from './core';
import { androidExecutor, androidGenerator } from './android';
import { podsGenerator } from './ios-pods';
import { targetsGenerator } from './ios-targets';
import { spmGenerator } from './ios-spm';
import {
  pbxExecutor,
  schemesGenerator,
  xcodeEnvGenerator,
  fixEmbedCycleGenerator,
} from './ios-xcode';

const generators = [
  podsGenerator,
  targetsGenerator,
  spmGenerator,
  xcodeEnvGenerator,
  schemesGenerator,
  fixEmbedCycleGenerator,
  androidGenerator,
];
const executors = [fileExecutor, androidExecutor, pbxExecutor];

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
export { toPlanOperation, redactDeep } from './core';
