export { spmGenerator } from './generators/spm';
export { normalizeRemotePackages, normalizeLocalPackages, normalizeTargetRef } from './validate';
export type {
  IosSpmManifest,
  SpmRemotePackage,
  SpmLocalPackage,
  SpmTargetRef,
  SwiftPackageRequirement,
} from './types';
