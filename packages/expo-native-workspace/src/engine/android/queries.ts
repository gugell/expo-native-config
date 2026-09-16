import { withAndroidManifest } from '@expo/config-plugins';
import { withMeta } from '../core';
import type { Executor, Generator, BaseOp } from '../core';
import type { WorkspaceConfig } from '../../schema';

type Queries = NonNullable<NonNullable<WorkspaceConfig['android']>['queries']>;
interface QueriesOp extends BaseOp {
  kind: 'androidQueries';
  queries: Queries;
}
type XmlNode = Record<string, unknown>;
function entries(value: unknown): XmlNode[] {
  const array = Array.isArray(value) ? value : value ? [value] : [];
  return array.filter((item): item is XmlNode => Boolean(item) && typeof item === 'object');
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function unique(values: XmlNode[]): XmlNode[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = canonical(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/** Preserve existing provider and intent attributes while consolidating one queries root. */
export function mergeQueries(existing: unknown, desired: Queries): XmlNode {
  const combined: XmlNode = {};
  const collections = new Map<string, XmlNode[]>();
  for (const fragment of entries(existing)) {
    for (const [key, value] of Object.entries(fragment)) {
      if (key === '$') {
        combined.$ = { ...(combined.$ as XmlNode | undefined), ...(value as XmlNode) };
        continue;
      }
      collections.set(key, [...(collections.get(key) ?? []), ...entries(value)]);
    }
  }
  collections.set('intent', [
    ...(collections.get('intent') ?? []),
    ...(desired.intents ?? []).map((intent) => ({
      action: [{ $: { 'android:name': intent.action } }],
      data: [{ $: { 'android:scheme': intent.scheme } }],
    })),
  ]);
  collections.set('package', [
    ...(collections.get('package') ?? []),
    ...(desired.packages ?? []).map((name) => ({ $: { 'android:name': name } })),
  ]);
  for (const [key, values] of collections) {
    if (values.length) combined[key] = unique(values);
  }
  return combined;
}
export const queriesGenerator: Generator = {
  name: 'androidQueries',
  generate({ manifest }) {
    const queries = (manifest.android as { queries?: Queries } | undefined)?.queries;
    if (!queries || (!queries.intents?.length && !queries.packages?.length)) return { ops: [] };
    return {
      ops: [
        withMeta(
          { kind: 'androidQueries', label: 'android:queries', queries } satisfies QueriesOp,
          {
            id: 'android.queries',
            platform: 'android',
            semanticKind: 'android.manifest.queries.merge',
            source: 'android.queries',
            status: 'update',
            files: ['android/app/src/main/AndroidManifest.xml'],
            desired: queries,
          },
        ),
      ],
    };
  },
};
export const queriesExecutor: Executor = (config, ops) => {
  const queries = ops.filter((op): op is QueriesOp => op.kind === 'androidQueries');
  if (!queries.length) return config;
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest as unknown as XmlNode;
    for (const op of queries) manifest.queries = mergeQueries(manifest.queries, op.queries);
    return mod;
  });
};
