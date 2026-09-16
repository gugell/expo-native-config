import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeFileBlock } from '../src/engine/core/fileExecutor';
import type { MergeBlockOp } from '../src/engine/core/types';

test('missing optional anchors append a tracked block that remains idempotent and updates', () => {
  const op: MergeBlockOp = {
    kind: 'mergeBlock',
    label: 'environment',
    path: '.xcode.env',
    tag: 'native-environment',
    newSrc: 'export CUSTOM=value',
    anchor: /export NODE_BINARY=/,
    offset: 1,
    comment: '#',
    appendIfNoAnchor: true,
  };
  const once = mergeFileBlock('# Custom environment\n', op);
  assert.equal(mergeFileBlock(once, op), once);
  const updated = mergeFileBlock(once, { ...op, newSrc: 'export CUSTOM=updated' });
  assert.equal(updated.match(/export CUSTOM=/g)?.length, 1);
  assert.ok(updated.includes('export CUSTOM=updated'));
});
