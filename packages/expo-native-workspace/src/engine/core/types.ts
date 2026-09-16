import type { ConfigPlugin } from '@expo/config-plugins';

export type OpPlatform = 'ios' | 'android' | 'shared';
export type OpStatus = 'add' | 'update' | 'remove' | 'noop';
export type OpRisk = 'low' | 'medium' | 'high' | 'escape-hatch';

/** Serializable semantic envelope. Executor `kind` stays the routing key. */
export interface OpMeta {
  id: string;
  platform: OpPlatform;
  semanticKind: string;
  source: string;
  status: OpStatus;
  files?: string[];
  risk?: OpRisk;
  desired?: unknown;
  current?: unknown;
  phase?: string;
}

export interface PlanOperation {
  id: string;
  platform: OpPlatform;
  kind: string;
  source: string;
  status: OpStatus;
  label: string;
  files?: string[];
  risk?: OpRisk;
  desired?: unknown;
  current?: unknown;
  phase?: string;
  executorKind: string;
}

/**
 * Minimal structural view of the resolved Expo config that generators read.
 * Loose (index signature) so an `ExpoConfig` is structurally assignable.
 */
export interface WorkspaceAppConfig {
  name?: string;
  version?: string;
  ios?: {
    bundleIdentifier?: string;
    appleTeamId?: string;
    buildNumber?: string;
    version?: string;
    entitlements?: Record<string, unknown>;
    [key: string]: unknown;
  };
  android?: {
    package?: string;
    versionCode?: number;
    [key: string]: unknown;
  };
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Generator-facing canonical config. Always flat (the shape existing
 * generators already read). Nested `workspace.config.ts` is flattened by
 * `normalizeWorkspaceConfig` before it reaches this type.
 */
export interface RawManifest {
  manifestVersion: 1;
  schemaVersion?: 1;
  [key: string]: unknown;
}

/** Where a file op's relative path is anchored. */
export type FileBase = 'ios' | 'android' | 'project';

/** Base shape every op shares. `kind` routes the op to an executor. */
export interface BaseOp {
  kind: string;
  label: string;
  /** Semantic envelope used by plan / doctor / JSON. Executor `kind` is unchanged. */
  meta?: OpMeta;
}

export interface WriteFileOp extends BaseOp {
  kind: 'writeFile';
  base?: FileBase;
  path: string;
  contents: string;
  overwrite: 'always' | 'ifAbsent';
}

export interface MergeBlockOp extends BaseOp {
  kind: 'mergeBlock';
  base?: FileBase;
  path: string;
  tag: string;
  newSrc: string;
  anchor: RegExp;
  offset: number;
  comment: string;
  appendIfNoAnchor?: boolean;
}

export interface AppendOnceOp extends BaseOp {
  kind: 'appendOnce';
  base?: FileBase;
  path: string;
  marker: string;
  contents: string;
}

export interface DeleteGlobOp extends BaseOp {
  kind: 'deleteGlob';
  base?: FileBase;
  dir: string;
  match: (filename: string) => boolean;
}

export type FileOp = WriteFileOp | MergeBlockOp | AppendOnceOp | DeleteGlobOp;

export const FILE_OP_KINDS = new Set(['writeFile', 'mergeBlock', 'appendOnce', 'deleteGlob']);

export function isFileOp(op: BaseOp): op is FileOp {
  return FILE_OP_KINDS.has(op.kind);
}

/** An op is the open base type; capability packages narrow it by `kind`. */
export type Op = BaseOp;

export interface GeneratorContext {
  /** Canonical (flattened) manifest; each generator validates and reads its own slice. */
  manifest: RawManifest;
  config: WorkspaceAppConfig;
  /** Absolute path to the app project root. */
  projectRoot: string;
  /** Absolute path of the loaded workspace config file. */
  configPath: string;
}

export interface GeneratorResult {
  ops: Op[];
  warnings?: string[];
}

/**
 * A generator turns one manifest concern into a declarative plan of ops.
 * `contributeConfig` optionally mutates the static Expo config.
 */
export interface Generator {
  name: string;
  contributeConfig?(config: WorkspaceAppConfig, ctx: GeneratorContext): WorkspaceAppConfig;
  generate(ctx: GeneratorContext): GeneratorResult;
}

/**
 * An executor is a ConfigPlugin that applies the ops whose `kind` it recognizes
 * (ignoring the rest). The orchestrator passes the full op list to each executor.
 */
export type Executor = ConfigPlugin<Op[]>;
