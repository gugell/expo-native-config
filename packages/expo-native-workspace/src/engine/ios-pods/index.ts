export { podsGenerator } from './generators/pods';
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
