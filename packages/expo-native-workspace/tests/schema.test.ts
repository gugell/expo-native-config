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

test('pod settings and build-phase rules require scoped matchers and valid configurations', () => {
  assert.ok(
    WorkspaceSchema.safeParse({
      ios: {
        podBuildSettings: [
          {
            target: { startsWith: 'NativeMedia' },
            settings: { SWIFT_VERSION: '5.9' },
            configurations: ['Debug'],
          },
        ],
        removePodBuildPhases: [{ target: 'NativeMedia', phase: 'ExtractAppIntentsMetadata' }],
      },
    }).success,
  );
  for (const rule of [
    { target: {}, settings: { KEY: 'value' } },
    { target: 'NativeMedia', settings: {} },
    { target: 'NativeMedia', settings: { KEY: 'value' }, configurations: ['Profile'] },
  ])
    assert.equal(WorkspaceSchema.safeParse({ ios: { podBuildSettings: [rule] } }).success, false);
});

test('scheme names support spaces while rejecting path traversal and unsafe filenames', () => {
  const scheme = (name: string) =>
    WorkspaceSchema.safeParse({ ios: { schemes: [{ name, configuration: 'Debug' }] } });
  assert.ok(scheme('Example App Debug').success);
  for (const name of ['../Other', '/tmp/Other', 'Other\\Name', '..', 'Bad\nName', 'Bad:Name']) {
    assert.equal(scheme(name).success, false);
  }
});
