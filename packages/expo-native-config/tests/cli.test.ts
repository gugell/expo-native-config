import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const cli = path.resolve('dist/cli.js');
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
function fixture(config: unknown) {
  const root = mkdtempSync(path.join(tmpdir(), 'enw-test-'));
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', private: true }),
  );
  writeFileSync(
    path.join(root, 'app.json'),
    JSON.stringify({
      expo: { name: 'Fixture', slug: 'fixture', ios: { bundleIdentifier: 'dev.fixture.app' } },
    }),
  );
  writeFileSync(path.join(root, 'workspace.config.json'), JSON.stringify(config));
  return root;
}
test('help and version need no project and reject unknown flags', () => {
  assert.equal(
    execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }).trim(),
    JSON.parse(readFileSync('package.json', 'utf8')).version,
  );
  assert.match(run('plan', '--help').stdout, /Preview/);
  assert.notEqual(run('plan', '--bogus').status, 0);
});
test('unknown schema keys fail as structured JSON', () => {
  const root = fixture({ schemaVersion: 1, ios: { pakages: [] } });
  for (const cmd of ['plan', 'validate', 'doctor']) {
    const r = run(cmd, '--project', root, '--json');
    assert.equal(r.status, 1, r.stderr);
    const result = JSON.parse(r.stdout);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.length);
  }
});
test('plan and validate reject the same App Group mismatch', () => {
  const root = fixture({
    schemaVersion: 1,
    ios: {
      targets: [
        {
          name: 'Share',
          type: 'share',
          entitlements: { 'com.apple.security.application-groups': ['group.missing'] },
        },
      ],
    },
  });
  mkdirSync(path.join(root, 'targets/Share'), { recursive: true });
  writeFileSync(path.join(root, 'targets/Share/Share.swift'), 'import Foundation');
  for (const cmd of ['plan', 'validate']) {
    const r = run(cmd, '--project', root, '--json');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /App Group/);
  }
});
test('minimal init is repeat safe and produces a valid config', () => {
  const root = fixture({ schemaVersion: 1 });
  const first = run('init', '--project', root, '--yes');
  assert.equal(first.status, 1, 'existing JSON config must not be shadowed');
  const empty = mkdtempSync(path.join(tmpdir(), 'enw-init-'));
  writeFileSync(
    path.join(empty, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', private: true }),
  );
  const r = run('init', '--project', empty, '--yes');
  assert.equal(r.status, 0, r.stderr);
  const before = readFileSync(path.join(empty, 'workspace.config.ts'), 'utf8');
  assert.equal(run('init', '--project', empty, '--yes').status, 1);
  assert.equal(readFileSync(path.join(empty, 'workspace.config.ts'), 'utf8'), before);
  assert.equal(run('validate', '--project', empty, '--json').status, 0);
});
test('plan succeeds for valid Android intent and never writes native directories', () => {
  const root = fixture({
    schemaVersion: 1,
    android: { permissions: ['android.permission.CAMERA'] },
  });
  const r = run('plan', '--project', root, '--json');
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.valid, true);
  assert.equal(existsSync(path.join(root, 'ios')), false);
  assert.equal(existsSync(path.join(root, 'android')), false);
  assert.ok(result.operations.some((op: { id: string }) => op.id.includes('CAMERA')));
});
test('config load errors stay machine readable', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'enw-missing-'));
  const r = run('plan', '--project', root, '--json');
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).valid, false);
});

test('init rejects unsupported config destination option', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'enw-init-option-'));
  assert.equal(run('init', '--project', root, '--config', 'custom.ts', '--yes').status, 1);
});
test('package target validation uses Expo native project naming', () => {
  const root = fixture({
    ios: {
      packages: [
        {
          url: 'https://github.com/apple/swift-collections',
          requirement: { kind: 'exactVersion', version: '1.1.4' },
          products: ['Collections'],
          target: 'MyApp',
        },
      ],
    },
  });
  writeFileSync(
    path.join(root, 'app.json'),
    JSON.stringify({
      expo: { name: 'My App', slug: 'my-app', ios: { bundleIdentifier: 'dev.fixture.app' } },
    }),
  );
  const result = run('validate', '--project', root, '--json');
  assert.equal(result.status, 0, result.stdout);
});

test('target source symlinks cannot escape the app root', () => {
  const outside = mkdtempSync(path.join(tmpdir(), 'enw-outside-'));
  const root = fixture({ ios: { targets: [{ name: 'Share', type: 'share' }] } });
  mkdirSync(path.join(root, 'targets'));
  symlinkSync(outside, path.join(root, 'targets', 'Share'), 'junction');
  const result = run('validate', '--project', root, '--json');
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /inside the project/);
});

test('Expo plugin rejects the same invalid intent before registering native mods', () => {
  const root = fixture({ schemaVersion: 1, ios: { pakages: [] } });
  const plugin = require('../app.plugin.cjs') as (config: unknown) => unknown;
  assert.throws(
    () => plugin({ name: 'Fixture', slug: 'fixture', _internal: { projectRoot: root } }),
    /pakages/,
  );
});
test('dynamic Expo config errors are surfaced, never replaced by app.json', () => {
  const root = fixture({ schemaVersion: 1 });
  writeFileSync(
    path.join(root, 'app.config.js'),
    "throw new Error('fixture dynamic config failure');",
  );
  const result = run('plan', '--project', root, '--json');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /fixture dynamic config failure/);
});
