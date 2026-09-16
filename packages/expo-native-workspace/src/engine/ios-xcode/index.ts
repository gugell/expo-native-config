export { pbxExecutor } from './pbxExecutor';
export { pbxOp, isPbxOp } from './pbxOp';
export type { PbxOp, PbxApplyContext } from './pbxOp';
export { openXcodeProject, serializeXcodeProject } from './openProject';
export type { OpenedProject } from './openProject';
export { normalizeSchemeDefinitions } from './validate';

export { schemesGenerator } from './generators/schemes';
export { xcodeEnvGenerator } from './generators/xcodeEnv';
export { fixEmbedCycleGenerator } from './generators/fixEmbedCycle';

export type {
  SchemeDefinition,
  XcodeEnvSpec,
  IosXcodeManifest,
  XcodeBuildConfiguration,
} from './types';
