import type { Generator } from '../../core';
import { withMeta } from '../../core';
import type { AndroidGradleBlockOp, AndroidSlice } from '../types';

/** Configure AGP's lint DSL without replacing app-owned Android blocks. */
export const androidLintGenerator: Generator = {
  name: 'android-lint',
  generate({ manifest }) {
    const lint = (manifest.android as AndroidSlice | undefined)?.lint;
    if (!lint || Object.keys(lint).length === 0) return { ops: [] };
    const lines = Object.entries(lint).map(([key, value]) => `    ${key} ${value}`);
    const op: AndroidGradleBlockOp = {
      kind: 'androidGradleBlock',
      file: 'app',
      tag: 'expo-native-config-android-lint',
      anchor: '^android\\s*\\{',
      offset: 1,
      comment: '//',
      contents: `  lint {\n${lines.join('\n')}\n  }`,
      label: 'android:lint',
    };
    return {
      ops: [
        withMeta(op, {
          id: 'android.lint',
          semanticKind: 'android.lint.configure',
          source: 'android.lint',
          platform: 'android',
          status: 'update',
          files: ['android/app/build.gradle'],
          desired: lint,
        }),
      ],
    };
  },
};
