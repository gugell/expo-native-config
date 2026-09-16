import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkspaceSchema } from '../src/schema';
test('strict nested schema rejects unsupported fields and malformed package declarations', () => {
  for (const config of [
    { ios: { packages: [{ products: ['X'] }] } },
    { ios: { xcode: { buildSettings: { FOO: 'bar' } } } },
    { ios: { pods: [{ pod: 'X', target: 'Widget' }] } },
    { android: { dependencies: [{ module: "group:artifact:1'bad" }] } },
  ])
    assert.equal(WorkspaceSchema.safeParse(config).success, false);
});
test('signing only accepts env references', () => {
  assert.equal(
    WorkspaceSchema.safeParse({
      android: {
        signing: {
          storeFile: 'release.keystore',
          keyAlias: 'release',
          storePassword: 'secret',
          keyPassword: 'secret',
        },
      },
    }).success,
    false,
  );
  assert.equal(
    WorkspaceSchema.safeParse({
      android: {
        signing: {
          storeFile: 'release.keystore',
          keyAlias: 'release',
          storePassword: { env: 'STORE_PASSWORD' },
          keyPassword: { env: 'KEY_PASSWORD' },
        },
      },
    }).success,
    true,
  );
});
test('schema preserves typed structured Android dependencies', () => {
  const config = WorkspaceSchema.parse({
    android: { dependencies: [{ module: 'androidx.collection:collection-ktx:1.4.5' }] },
  });
  assert.equal(
    config.android?.dependencies?.[0].module,
    'androidx.collection:collection-ktx:1.4.5',
  );
});
