import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AndroidConfig } from '@expo/config-plugins';
import { WorkspaceSchema } from '../src/schema';
import { collect } from '../src/engine';
import { mergeQueries } from '../src/engine/android/queries';
import { mergeFileBlock } from '../src/engine/core/fileExecutor';
import type { MergeBlockOp } from '../src/engine/core';

test('queries consolidate fragments, dedupe matching declarations and preserve providers', () => {
  const intent = {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    data: [{ $: { 'android:scheme': 'geo' } }],
  };
  const provider = { $: { 'android:authorities': 'com.example.provider' } };
  const fragments = [
    { intent: [intent], provider: [provider] },
    { package: { $: { 'android:name': 'com.waze' } }, intent: [intent] },
  ];
  const desired = {
    intents: [
      { action: 'android.intent.action.VIEW', scheme: 'geo' },
      { action: 'android.intent.action.VIEW', scheme: 'https' },
    ],
    packages: ['com.waze', 'com.google.android.apps.maps'],
  };
  const merged = mergeQueries(fragments, desired);
  assert.equal((merged.intent as unknown[]).length, 2);
  assert.equal((merged.package as unknown[]).length, 2);
  assert.deepEqual(merged.provider, [provider]);
  assert.deepEqual(mergeQueries(merged, desired), merged);
});

test('typed Podfile settings are collected, safely quoted and idempotent', () => {
  const config = WorkspaceSchema.parse({
    ios: {
      minimumPodDeploymentTarget: '16.4',
      podfileGlobals: { RNFirebaseAsStaticFramework: true, Custom: "a'b\\c" },
    },
    android: { queries: { packages: ['com.waze'] } },
  });
  const plan = collect(config, '/tmp', {});
  assert.ok(plan.ops.some((op) => op.kind === 'androidQueries'));
  const ops = plan.ops.filter((op): op is MergeBlockOp => op.kind === 'mergeBlock');
  assert.equal(ops.length, 2);
  let contents = "require 'json'\npost_install do |installer|\nend\n";
  for (const op of ops) contents = mergeFileBlock(contents, op);
  const once = contents;
  for (const op of ops) contents = mergeFileBlock(contents, op);
  assert.equal(contents, once);
  assert.ok(
    contents.indexOf('$RNFirebaseAsStaticFramework = true') < contents.indexOf("require 'json'"),
  );
  assert.equal(
    WorkspaceSchema.safeParse({ ios: { podfileGlobals: { 'bad;system': true } } }).success,
    false,
  );
  assert.equal(
    WorkspaceSchema.safeParse({ ios: { minimumPodDeploymentTarget: 'not-version' } }).success,
    false,
  );
});

test('pod floor Ruby raises absent/lower versions, preserves higher and inherited settings', (t) => {
  const rubyEnv = { ...process.env };
  delete rubyEnv.GEM_HOME;
  delete rubyEnv.GEM_PATH;
  delete rubyEnv.RUBYOPT;
  const probe = spawnSync('ruby', ['--version'], { env: rubyEnv });
  if (probe.error) {
    t.skip('Ruby is unavailable');
    return;
  }
  const plan = collect({ ios: { minimumPodDeploymentTarget: '16.4' } }, '/tmp', {});
  const op = plan.ops.find(
    (item) => item.meta?.id === 'pod:minimumDeploymentTarget',
  ) as MergeBlockOp;
  const source = `require 'json'\nrequire 'rubygems'\nvalues = [nil, '12.0', '16.4', '17.0', '$(inherited)']\nconfigs = values.map { |value| Struct.new(:build_settings).new({'IPHONEOS_DEPLOYMENT_TARGET' => value}) }\ninstaller = Struct.new(:pods_project).new(Struct.new(:targets).new([Struct.new(:build_configurations).new(configs)]))\n${op.newSrc}\nputs JSON.generate(configs.map { |config| config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] })`;
  const result = spawnSync('ruby', ['-e', source], { encoding: 'utf8', env: rubyEnv });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['16.4', '16.4', '16.4', '17.0', '$(inherited)']);
});

test('query serialization yields one root and preserves distinct constrained intents', async () => {
  const desired = { intents: [{ action: 'android.intent.action.VIEW', scheme: 'https' }] };
  const constrained = {
    data: [{ $: { 'android:host': 'example.org', 'android:scheme': 'https' } }],
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
  };
  const reordered = {
    action: constrained.action,
    data: [{ $: { 'android:scheme': 'https', 'android:host': 'example.org' } }],
  };
  const merged = mergeQueries(
    [
      { intent: [constrained] },
      { intent: [reordered], provider: { $: { 'android:authorities': 'example.provider' } } },
    ],
    desired,
  );
  assert.equal((merged.intent as unknown[]).length, 2);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-queries-'));
  try {
    const target = path.join(dir, 'AndroidManifest.xml');
    await AndroidConfig.Manifest.writeAndroidManifestAsync(target, {
      manifest: {
        $: {
          'xmlns:android': 'http://schemas.android.com/apk/res/android',
          package: 'com.example.app',
        },
        queries: merged,
      },
    } as unknown as Parameters<typeof AndroidConfig.Manifest.writeAndroidManifestAsync>[1]);
    const xml = await fs.readFile(target, 'utf8');
    assert.equal(xml.match(/<queries>/g)?.length, 1);
    assert.equal(xml.match(/<intent>/g)?.length, 2);
    assert.ok(xml.includes('android:authorities="example.provider"'));
    const parsed = await AndroidConfig.Manifest.readAndroidManifestAsync(target);
    assert.deepEqual(mergeQueries(parsed.manifest.queries, desired), merged);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('android.queries schemes expand to VIEW intents and merge with explicit intents', () => {
  const config = WorkspaceSchema.parse({
    android: {
      queries: {
        schemes: ['geo', 'waze', 'moovit'],
        intents: [{ action: 'android.intent.action.DIAL', scheme: 'tel' }],
        packages: ['com.waze'],
      },
    },
  });
  const plan = collect(config, '/tmp', {});
  const op = plan.ops.find((item) => item.kind === 'androidQueries');
  assert.ok(op);
  const merged = mergeQueries({}, (op as { queries: Parameters<typeof mergeQueries>[1] }).queries);
  const intents = merged.intent as Array<{ action: [{ $: Record<string, string> }] }>;
  assert.equal(intents.length, 4);
  const views = intents.filter(
    (intent) => intent.action[0].$['android:name'] === 'android.intent.action.VIEW',
  );
  assert.equal(views.length, 3);
  // The shorthand does not displace an explicitly declared non-VIEW intent.
  assert.ok(
    intents.some((intent) => intent.action[0].$['android:name'] === 'android.intent.action.DIAL'),
  );
  // A schemes-only config still plans; the emptiness check reads the expansion.
  const shorthandOnly = collect(
    WorkspaceSchema.parse({ android: { queries: { schemes: ['geo'] } } }),
    '/tmp',
    {},
  );
  assert.ok(shorthandOnly.ops.some((item) => item.kind === 'androidQueries'));
  assert.equal(
    WorkspaceSchema.safeParse({ android: { queries: { schemes: ['not a scheme'] } } }).success,
    false,
  );
});

test('deployment targets inherit the app value from expo-build-properties', () => {
  const config = WorkspaceSchema.parse({
    ios: { minimumPodDeploymentTarget: 'inherit', deploymentTarget: 'inherit' },
  });
  const appConfig = {
    plugins: [
      'expo-router',
      ['expo-build-properties', { ios: { deploymentTarget: '16.4', useFrameworks: 'static' } }],
    ],
  };
  const plan = collect(config, '/tmp', appConfig);
  const podfile = plan.ops.filter(
    (op): op is MergeBlockOp => op.kind === 'mergeBlock' && op.path === 'Podfile',
  );
  assert.ok(podfile.some((op) => op.newSrc.includes("Gem::Version.new('16.4')")));

  // Plugins visible and the one that owns the value absent: a real mistake.
  assert.throws(
    () => collect(config, '/tmp', { plugins: ['expo-router'] }),
    /does not set expo-build-properties ios.deploymentTarget/,
  );
  // No plugins array at all means the CLI could not read them (getConfig with
  // skipPlugins deletes it), which is not the same claim. Warn, do not guess,
  // and leave the value for the prebuild that can see it.
  const blind = collect(config, '/tmp', {});
  assert.ok(blind.warnings.some((warning) => warning.includes('resolved during prebuild')));
  assert.equal(
    blind.ops.some((op) => op.kind === 'mergeBlock' && op.newSrc.includes('minimum_ios')),
    false,
  );
  // An explicit version still wins and needs no plugin present.
  const explicit = collect(
    WorkspaceSchema.parse({ ios: { minimumPodDeploymentTarget: '15.1' } }),
    '/tmp',
    {},
  );
  assert.ok(
    explicit.ops.some(
      (op) => op.kind === 'mergeBlock' && op.newSrc.includes("Gem::Version.new('15.1')"),
    ),
  );
});
