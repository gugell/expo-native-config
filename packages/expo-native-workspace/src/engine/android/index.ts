export { androidGenerator } from './generators/android';
export { androidExecutor } from './androidExecutor';
export { isAndroidOp } from './types';
export { androidLibrary, renderAndroidDependency, renderAndroidDependencies } from './dependencies';
export { androidFeature, normalizeAndroidFeatures } from './features';
export type {
  AndroidDependency,
  AndroidLibraryDependency,
  GradleConfiguration,
} from './dependencies';
export type { AndroidFeature, AndroidUsesFeature } from './features';
export type { AndroidManifestSlice, AndroidSlice, AndroidSigningConfig, AndroidOp } from './types';
