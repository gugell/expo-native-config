import type { XcodeBuildConfiguration } from '../core';

export type { XcodeBuildConfiguration };

export interface SchemeDefinition {
  /** Xcode scheme display name (also used as the `.xcscheme` filename). */
  name: string;
  configuration: XcodeBuildConfiguration;
  archive?: XcodeBuildConfiguration;
  analyze?: XcodeBuildConfiguration;
  /** Include a TestAction with the unit-test target (if present). Default: false. */
  includeUnitTestTarget?: boolean;
}

export interface XcodeEnvSpec {
  exports?: Record<string, string>;
  lines?: string[];
}

/** The manifest slice this package consumes. */
export interface IosXcodeManifest {
  schemes?: SchemeDefinition[];
  replaceExpoScheme?: boolean;
  xcodeEnv?: XcodeEnvSpec;
  /** Reorder "Embed Foundation Extensions" after Resources. Default: true. */
  fixExtensionEmbedCycle?: boolean;
}
