export * from './schema';
// Explicit re-exports: these names carry both a type (identical to the schema's)
// and a constructor namespace, and the explicit form wins over the star export.
export {
  Target,
  Pod,
  Package,
  SwiftPackageRequirement,
  Scheme,
  RunScript,
  PodBuildSettings,
  AndroidDependency,
  AndroidComponent,
  AndroidFeature,
  AndroidModule,
  MavenRepository,
  BuildConfigField,
  ReplaceRule,
  Abi,
  AndroidPermission,
  AndroidHardware,
  AndroidApplication,
  AndroidIntentAction,
  DeploymentTarget,
  XcodeBuildSettings,
} from './factories';
