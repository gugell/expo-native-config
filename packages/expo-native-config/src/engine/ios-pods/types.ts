import type { BaseOp, Op } from '../core';
import type { NameMatcher, XcodeBuildConfiguration } from '../core';

export type PodTargetMatcher = NameMatcher;

export interface LocalPodDeclaration {
  pod: string;
  /** Path relative to the `ios/` directory (Podfile location). */
  path: string;
}

export interface RemotePodDeclaration {
  pod: string;
  /** Version requirement, e.g. "~> 1.2" or "1.2.3". */
  version?: string;
  git?: string;
  branch?: string;
  tag?: string;
  commit?: string;
  configurations?: string[];
  modularHeaders?: boolean;
}

export interface PodBuildSettingsRule {
  target: string | PodTargetMatcher;
  settings: Record<string, string>;
  configurations?: XcodeBuildConfiguration[];
}

export interface PodRemoveBuildPhaseRule {
  target: string | PodTargetMatcher;
  /** Build phase name to delete from matching pod targets (e.g. "ExtractAppIntentsMetadata"). */
  phase: string;
}

/** The manifest slice this package consumes. */
export interface IosPodsManifest {
  localPods?: LocalPodDeclaration[];
  remotePods?: RemotePodDeclaration[];
  podBuildSettings?: PodBuildSettingsRule[];
  removePodBuildPhases?: PodRemoveBuildPhaseRule[];
}

/** Writes keys into the template-read `Podfile.properties.json`. */
export interface PodfilePropertiesOp extends BaseOp {
  kind: 'iosPodfileProperties';
  properties: Record<string, string>;
}

export function isPodfilePropertiesOp(op: Op): op is PodfilePropertiesOp {
  return op.kind === 'iosPodfileProperties';
}
