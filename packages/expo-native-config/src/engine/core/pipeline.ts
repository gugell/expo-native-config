import type { Generator, GeneratorContext, Op, WorkspaceAppConfig } from './types';

export interface WorkspacePlan {
  ops: Op[];
  warnings: string[];
  config: WorkspaceAppConfig;
  configPath: string;
  projectRoot: string;
}

/**
 * Run contributeConfig + generate for every generator. Does not apply executors.
 * Used by the Expo plugin and by the plan/doctor/validate CLI.
 */
export function collectWorkspacePlan(
  generators: Generator[],
  ctx: GeneratorContext,
): WorkspacePlan {
  const working: GeneratorContext = { ...ctx, config: ctx.config };

  for (const generator of generators) {
    if (generator.contributeConfig) {
      working.config = generator.contributeConfig(working.config, working);
    }
  }

  const ops: Op[] = [];
  const warnings: string[] = [];
  for (const generator of generators) {
    const result = generator.generate(working);
    ops.push(...result.ops);
    for (const warning of result.warnings ?? []) {
      warnings.push(`${generator.name}: ${warning}`);
    }
  }

  return {
    ops,
    warnings,
    config: working.config,
    configPath: working.configPath,
    projectRoot: working.projectRoot,
  };
}
