import type { BaseOp, Op } from '../core';

/** Lines injected into a generated native entry-point source file. */
export interface SourceInjectionSpec {
  /** Import lines, inserted after the file's existing imports. */
  imports?: string[];
  /** Statements inserted at the end of the entry-point method body. */
  body?: string[];
}

export interface AppDelegateOp extends BaseOp {
  kind: 'iosAppDelegate';
  tag: string;
  spec: SourceInjectionSpec;
}

export interface MainApplicationOp extends BaseOp {
  kind: 'androidMainApplication';
  tag: string;
  spec: SourceInjectionSpec;
}

export type SourceOp = AppDelegateOp | MainApplicationOp;

const SOURCE_KINDS = new Set(['iosAppDelegate', 'androidMainApplication']);

export function isSourceOp(op: Op): op is SourceOp {
  return SOURCE_KINDS.has(op.kind);
}
