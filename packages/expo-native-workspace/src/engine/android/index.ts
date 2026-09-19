export { androidGenerator } from './generators/android';
export { gradleExtrasGenerator } from './generators/gradleExtras';
export { manifestExtrasGenerator } from './generators/manifestExtras';
export { androidResourcesGenerator } from './generators/resources';
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
