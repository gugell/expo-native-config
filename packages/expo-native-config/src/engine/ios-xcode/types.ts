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

/** A shell-script build phase on the main application target. */
export interface RunScriptSpec {
  /** Phase name in Xcode; also the identity used to update it in place. */
  name: string;
  script: string;
  /** Interpreter path. Default: /bin/sh. */
  shell?: string;
  inputPaths?: string[];
  outputPaths?: string[];
  inputFileListPaths?: string[];
  outputFileListPaths?: string[];
  /** "Run script only when installing". */
  runOnlyForDeploymentPostprocessing?: boolean;
  /** Skip dependency analysis and run on every build. */
  alwaysOutOfDate?: boolean;
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
  /** Build settings applied to the main application target. */
  iosBuildSettings?: Record<string, string>;
  runScripts?: RunScriptSpec[];
  /** App-root-relative files copied next to the generated project and bundled. */
  iosResources?: string[];
}
