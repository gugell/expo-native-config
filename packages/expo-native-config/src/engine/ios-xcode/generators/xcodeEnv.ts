import type { Generator, MergeBlockOp } from '../../core';
import { withMeta } from '../../core';

import type { XcodeEnvSpec } from '../types';

const XCODE_ENV_TAG = 'expo-native-config-xcode-env';

function formatExportLine(key: string, value: string): string {
  const safeKey = key.replace(/[^A-Za-z0-9_]/g, '');
  if (!safeKey) {
    throw new Error(`[expo-native-config] Invalid xcodeEnv export key: "${key}"`);
  }
  const raw = String(value);
  if (/^[A-Za-z0-9_.-]+$/.test(raw)) {
    return `export ${safeKey}=${raw}`;
  }
  const escaped = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `export ${safeKey}="${escaped}"`;
}

function buildXcodeEnvBlock(spec: XcodeEnvSpec): string {
  const lines: string[] = [];
  if (spec.exports) {
    for (const [key, value] of Object.entries(spec.exports)) {
      lines.push(formatExportLine(key, value));
    }
  }
  if (spec.lines?.length) {
    lines.push(...spec.lines);
  }
  return lines.join('\n');
}

export const xcodeEnvGenerator: Generator = {
  name: 'xcodeEnv',
  generate({ manifest }) {
    const spec = manifest.xcodeEnv as XcodeEnvSpec | undefined;
    if (!spec) {
      return { ops: [] };
    }
    const block = buildXcodeEnvBlock(spec);
    if (!block.trim()) {
      return { ops: [] };
    }

    const op: MergeBlockOp = {
      kind: 'mergeBlock',
      path: '.xcode.env',
      tag: XCODE_ENV_TAG,
      newSrc: block,
      anchor: /export NODE_BINARY=/,
      offset: 1,
      comment: '#',
      appendIfNoAnchor: true,
      label: 'xcodeEnv',
    };
    return {
      ops: [
        withMeta(op, {
          id: 'xcode.env',
          platform: 'ios',
          semanticKind: 'ios.xcode.env.set',
          source: 'ios.xcode.env',
          status: 'update',
          files: ['ios/.xcode.env'],
          desired: spec,
        }),
      ],
    };
  },
};
