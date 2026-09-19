import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureUsesFeature } from '../src/engine/android/androidExecutor';
import { androidGenerator } from '../src/engine/android/generators/android';
import type { AndroidGradleReplaceOp } from '../src/engine/android/types';
import { toPlanOperation } from '../src/engine/core/ops';

test('Android feature updates replace previous settings without duplicating entries', () => {
  const manifest = {
    manifest: {
      'uses-feature': [
        {
          $: {
            'android:name': 'android.hardware.camera',
            'android:required': 'false',
            'android:glEsVersion': '0x00020000',
          },
        },
      ],
    },
  };
  const op = {
    kind: 'androidManifestUsesFeature' as const,
    label: 'camera',
    name: 'android.hardware.camera',
    required: true,
  };
  ensureUsesFeature(manifest, op);
  ensureUsesFeature(manifest, op);
  assert.deepEqual(manifest.manifest['uses-feature'], [{ $: { 'android:name': op.name } }]);
});

test('signing plans never materialize environment secrets and switch only release signing', () => {
  process.env.ENGINE_TEST_SIGNING_PASSWORD = 'never-print-this-password';
  try {
    const result = androidGenerator.generate({
      manifest: {
        manifestVersion: 1,
        android: {
          signing: {
            storeFile: 'release.keystore',
            keyAlias: 'release',
            storePassword: { env: 'ENGINE_TEST_SIGNING_PASSWORD' },
            keyPassword: { env: 'ENGINE_TEST_SIGNING_PASSWORD' },
          },
        },
      },
      config: {},
      projectRoot: '/tmp',
      configPath: '/tmp/workspace.config.ts',
    });
    assert.ok(!JSON.stringify(result).includes('never-print-this-password'));
    assert.ok(
      !JSON.stringify(result.ops.map(toPlanOperation)).includes('never-print-this-password'),
    );
    const replacement = result.ops.find(
      (op) => op.kind === 'androidGradleReplace',
    ) as AndroidGradleReplaceOp;
    const source = `signingConfigs { release { storeFile file('release.keystore') } }
buildTypes {
  debug { signingConfig signingConfigs.debug }
  release { signingConfig signingConfigs.debug }
}`;
    const next = source.replace(new RegExp(replacement.find), replacement.replacement);
    assert.ok(next.includes('debug { signingConfig signingConfigs.debug }'));
    assert.ok(next.includes('release { signingConfig signingConfigs.release }'));
  } finally {
    delete process.env.ENGINE_TEST_SIGNING_PASSWORD;
  }
});
