/** iOS native target types supported by the first-party generator (v1 registry subset). */
export type TargetType = 'share' | 'widget' | 'clip';

export interface TargetSpec {
  /** Folder name under `targetsRoot` AND the Xcode target / productName seed. */
  name: string;
  type: TargetType;
  /** Leading "." appends to the main app bundle id (".ShareExtension" => "<app>.ShareExtension"). */
  bundleIdentifier?: string;
  /** iOS deployment target. Defaults to the registry default (18.0). */
  deploymentTarget?: string;
  /** Plist-shaped entitlements; written to `generated.entitlements`. */
  entitlements?: Record<string, unknown>;
  /** Extra frameworks appended to the type's built-in framework list. */
  frameworks?: string[];
  /** Source dir relative to the app root. Defaults to `${targetsRoot}/${name}`. */
  source?: string;
  /**
   * Build settings applied to the generated target's Debug + Release configs
   * (e.g. `{ ENABLE_APP_INTENTS_METADATA_GENERATION: 'NO' }`). Override the
   * generated defaults.
   */
  buildSettings?: Record<string, string>;
  /**
   * CocoaPods dependencies for this target. Emitted as a tagged, idempotent
   * `target '<name>' do … end` block in the Podfile — a manifest-first
   * replacement for `targets/<name>/pods.rb` (which is still supported via the
   * extension loader). Don't declare the same target in both places, or
   * CocoaPods will see duplicate `target` blocks.
   */
  pods?: TargetPod[];
}

/** A CocoaPods dependency entry for a target's `pods` array. */
export interface TargetPod {
  pod: string;
  /** Path to a local pod, relative to the `ios/` directory. */
  path?: string;
  /** Version requirement, e.g. "~> 1.2" or "1.2.3". */
  version?: string;
  git?: string;
  branch?: string;
  tag?: string;
  commit?: string;
  configurations?: string[];
  modularHeaders?: boolean;
}

/** The manifest slice this package consumes. */
export interface IosTargetsManifest {
  /** Root directory (relative to app root) for target source. Default: "./targets". */
  targetsRoot?: string;
  targets?: TargetSpec[];
}
