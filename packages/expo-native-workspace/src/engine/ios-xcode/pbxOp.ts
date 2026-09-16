import type { XcodeProject } from '@bacons/xcode';
import type { BaseOp, Op, OpMeta } from '../core';

export interface PbxApplyContext {
  project: XcodeProject;
  projectRoot: string;
  platformProjectRoot: string;
}

/**
 * A pbx op mutates the shared @bacons/xcode project at execution time. The op
 * list is the declarative plan; the `apply` closure is executor-side. All pbx
 * ops are applied against a single opened project by the pbx executor.
 */
export interface PbxOp extends BaseOp {
  kind: 'pbx';
  apply: (ctx: PbxApplyContext) => void;
}

export function isPbxOp(op: Op): op is PbxOp {
  return op.kind === 'pbx';
}

export function pbxOp(label: string, apply: (ctx: PbxApplyContext) => void, meta?: OpMeta): PbxOp {
  return { kind: 'pbx', label, apply, meta };
}
