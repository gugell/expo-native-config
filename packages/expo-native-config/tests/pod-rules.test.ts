import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test, type TestContext } from 'node:test';
import { podsGenerator } from '../src/engine/ios-pods/generators/pods';
import { nameMatcherToRuby, rubyLiteral } from '../src/engine/core/validation';
import type { MergeBlockOp } from '../src/engine/core';

function ruby(t: TestContext, source: string): unknown {
  const env = { ...process.env };
  delete env.GEM_HOME;
  delete env.GEM_PATH;
  delete env.RUBYOPT;
  const result = spawnSync('ruby', ['-rjson', '-e', source], { env, encoding: 'utf8' });
  if (result.error && 'code' in result.error && result.error.code === 'ENOENT') {
    t.skip('Ruby is unavailable');
    return undefined;
  }
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('configuration-scoped pod rules do not skip later rules on the same configuration', (t) => {
  const result = podsGenerator.generate({
    manifest: {
      manifestVersion: 1,
      podBuildSettings: [
        {
          target: 'FixturePod',
          configurations: ['Debug'],
          settings: { MODE: 'debug', DEBUG_ONLY: 'YES' },
        },
        {
          target: 'FixturePod',
          configurations: ['Release'],
          settings: { MODE: 'release', RELEASE_ONLY: 'YES' },
        },
        { target: { startsWith: 'Fixture' }, settings: { SHARED: 'YES' } },
      ],
    },
    projectRoot: '/tmp',
    configPath: '/tmp/workspace.config.ts',
    config: {},
  });
  const operation = result.ops.find((op) => op.meta?.id === 'pod:buildSettings') as MergeBlockOp;
  const value = ruby(
    t,
    `
    BuildConfig = Struct.new(:name, :build_settings)
    Target = Struct.new(:name, :build_configurations)
    targets = ['FixturePod', 'UnrelatedPod'].map { |name| Target.new(name, ['Debug','Release'].map { |config| BuildConfig.new(config, {'ORIGINAL' => 'kept'}) }) }
    installer = Struct.new(:pods_project).new(Struct.new(:targets).new(targets))
    ${operation.newSrc}
    ${operation.newSrc}
    puts JSON.generate(targets.map { |target| target.build_configurations.map(&:build_settings) })
  `,
  );
  if (value === undefined) return;
  assert.deepEqual(value, [
    [
      { ORIGINAL: 'kept', MODE: 'debug', DEBUG_ONLY: 'YES', SHARED: 'YES' },
      { ORIGINAL: 'kept', MODE: 'release', RELEASE_ONLY: 'YES', SHARED: 'YES' },
    ],
    [{ ORIGINAL: 'kept' }, { ORIGINAL: 'kept' }],
  ]);
});

test('Ruby target regexes support slashes and cannot interpolate Ruby expressions', (t) => {
  const slashPredicate = nameMatcherToRuby({ regex: '^Vendor/Feature$' });
  const unsafePattern = '#{raise "regex interpolation executed"}';
  const safePredicate = nameMatcherToRuby({ regex: unsafePattern });
  const value = ruby(
    t,
    `
    target = Struct.new(:name).new('Vendor/Feature')
    slash_matched = !!(${slashPredicate})
    target.name = ${rubyLiteral(unsafePattern)}
    literal_matched = !!(${safePredicate})
    puts JSON.generate([slash_matched, literal_matched])
  `,
  );
  if (value === undefined) return;
  assert.deepEqual(value, [true, true]);
});

test('phase-removal rules preserve other phases and unrelated targets', (t) => {
  const result = podsGenerator.generate({
    manifest: {
      manifestVersion: 1,
      removePodBuildPhases: [{ target: { regex: '^Vendor/Feature$' }, phase: 'Remove Me' }],
    },
    projectRoot: '/tmp',
    configPath: '/tmp/workspace.config.ts',
    config: {},
  });
  const operation = result.ops.find(
    (op) => op.meta?.id === 'pod:removeBuildPhases',
  ) as MergeBlockOp;
  const value = ruby(
    t,
    `
    Phase = Struct.new(:name)
    Target = Struct.new(:name, :build_phases)
    targets = ['Vendor/Feature', 'UnrelatedPod'].map { |name| Target.new(name, ['Keep Me','Remove Me'].map { |phase| Phase.new(phase) }) }
    installer = Struct.new(:pods_project).new(Struct.new(:targets).new(targets))
    ${operation.newSrc}
    ${operation.newSrc}
    puts JSON.generate(targets.map { |target| target.build_phases.map(&:name) })
  `,
  );
  if (value === undefined) return;
  assert.deepEqual(value, [['Keep Me'], ['Keep Me', 'Remove Me']]);
});
