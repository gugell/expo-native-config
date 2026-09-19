export { podsGenerator } from './generators/pods';
export { podfileExtrasGenerator } from './generators/podfileExtras';
export { podfilePropertiesGenerator } from './generators/podfileProperties';
export { podfilePropertiesExecutor } from './podfilePropertiesExecutor';
export {
  normalizeLocalPods,
  normalizeRemotePods,
  normalizePodBuildSettingsRules,
  normalizeRemovePodBuildPhases,
} from './validate';
export type {
  LocalPodDeclaration,
  RemotePodDeclaration,
  PodBuildSettingsRule,
  PodRemoveBuildPhaseRule,
  PodTargetMatcher,
  IosPodsManifest,
} from './types';
