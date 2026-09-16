import type { BaseOp, OpMeta, PlanOperation } from './types';

export function withMeta<T extends BaseOp>(op: T, meta: OpMeta): T {
  return { ...op, meta };
}

export function toPlanOperation(op: BaseOp, index: number): PlanOperation {
  const meta = op.meta;
  return {
    id: meta?.id ?? `${op.kind}:${index}`,
    platform: meta?.platform ?? inferPlatform(op),
    kind: meta?.semanticKind ?? op.kind,
    source: meta?.source ?? '(generator)',
    status: meta?.status ?? 'add',
    label: op.label,
    files: meta?.files,
    risk: meta?.risk,
    desired: meta?.desired,
    current: meta?.current,
    phase: meta?.phase,
    executorKind: op.kind,
  };
}

function inferPlatform(op: BaseOp): OpMeta['platform'] {
  const base = (op as { base?: string }).base;
  if (base === 'android') return 'android';
  if (base === 'ios' || base === 'project') return 'ios';
  if (op.kind.startsWith('android')) return 'android';
  if (op.kind === 'pbx' || op.kind === 'patch') return 'ios';
  return 'shared';
}
