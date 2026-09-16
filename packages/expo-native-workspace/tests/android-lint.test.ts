import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeContents } from '@expo/config-plugins/build/utils/generateCode';
import { collect } from '../src/engine';
import { WorkspaceSchema } from '../src/schema';
import type { AndroidGradleBlockOp } from '../src/engine/android/types';

test('lint settings remain declarative, preserve app content and update idempotently', () => {
  const block = (enabled: boolean) =>
    collect(
      WorkspaceSchema.parse({
        android: {
          lint: { checkReleaseBuilds: enabled, abortOnError: enabled },
        },
      }),
      '/tmp',
      {},
    ).ops.find((op) => op.kind === 'androidGradleBlock') as AndroidGradleBlockOp;
  const apply = (src: string, enabled: boolean) => {
    const op = block(enabled);
    return mergeContents({
      src,
      newSrc: op.contents,
      tag: op.tag,
      anchor: new RegExp(op.anchor),
      offset: op.offset,
      comment: op.comment,
    }).contents;
  };
  const source = 'android {\n  namespace "app.test"\n}\n';
  const once = apply(source, false);
  assert.equal(apply(once, false), once);
  assert.match(once, /checkReleaseBuilds false/);
  const updated = apply(once, true);
  assert.match(updated, /abortOnError true/);
  assert.doesNotMatch(updated, /abortOnError false/);
  assert.match(updated, /namespace "app.test"/);
  assert.equal((updated.match(/lint \{/g) ?? []).length, 1);
});
