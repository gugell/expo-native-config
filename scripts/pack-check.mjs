import assert from 'node:assert/strict';
import spawn from 'cross-spawn';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(root, 'packages/expo-native-workspace');
const release = process.argv.includes('--release');
const temporary = mkdtempSync(join(tmpdir(), 'expo-native-workspace-pack-'));
const destination = release ? join(root, 'artifacts/release') : join(temporary, 'tarballs');
mkdirSync(destination, { recursive: true });
function run(command, args, cwd) {
  const result = spawn.sync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`);
}
try {
  const version = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
  run('pnpm', ['pack', '--pack-destination', destination], packageRoot);
  let tarball = join(destination, `expo-native-workspace-${version}.tgz`);
  if (release) {
    const stable = join(destination, 'expo-native-workspace.tgz');
    rmSync(stable, { force: true });
    renameSync(tarball, stable);
    tarball = stable;
  }
  const consumer = join(temporary, 'consumer');
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'packed-consumer', private: true, version: '1.0.0' }),
  );
  // A new npm project proves that catalog/workspace references were rewritten by pnpm pack.
  run(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball],
    consumer,
  );
  const installed = join(consumer, 'node_modules/expo-native-workspace');
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  assert.equal(manifest.version, version);
  assert.equal(manifest.private, undefined);
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'devDependencies',
  ]) {
    for (const spec of Object.values(manifest[section] ?? {})) {
      assert.doesNotMatch(
        spec,
        /^(catalog|workspace|link|file):/,
        `Unresolved ${section} dependency`,
      );
    }
  }
  for (const unwanted of ['src', 'tests', '.env', 'node_modules']) {
    assert(!readdirSync(installed).includes(unwanted), `Unexpected published ${unwanted}`);
  }
  run(
    process.execPath,
    [
      '-e',
      `
    const assert = require('node:assert/strict');
    const api = require('expo-native-workspace');
    for (const helper of ['defineWorkspace', 'shareExtension', 'widgetExtension', 'appClip', 'swiftPackage', 'localSwiftPackage', 'scheme', 'androidLibrary', 'androidFeature']) {
      assert.equal(typeof api[helper], 'function', helper);
    }
    assert.equal(api.shareExtension({ name: 'SmokeShare' }).type, 'share');
    for (const namespace of ['Target', 'Pod', 'Package', 'Scheme', 'RunScript', 'AndroidDependency', 'AndroidComponent', 'MavenRepository', 'XcodeBuildSettings', 'Abi']) {
      assert.equal(typeof api[namespace], 'object', 'missing namespace ' + namespace);
    }
    assert.equal(api.Target.notificationService({ name: 'SmokeNotify' }).type, 'notification-service');
    assert.deepEqual(api.XcodeBuildSettings.of({ ldExportSymbols: false }), { LD_EXPORT_SYMBOLS: 'NO' });
    assert.equal(api.androidLibrary('example:library:1.0.0').configuration, 'implementation');
    assert.equal(api.WorkspaceSchema.safeParse(api.defineWorkspace({ schemaVersion: 1 })).success, true);
    assert.equal(typeof require('expo-native-workspace/plugin'), 'function');
    assert.equal(typeof require('./node_modules/expo-native-workspace/app.plugin.cjs'), 'function');
  `,
    ],
    consumer,
  );
  const bin = join(
    consumer,
    'node_modules/.bin',
    process.platform === 'win32' ? 'expo-native-workspace.cmd' : 'expo-native-workspace',
  );
  const versionResult = spawn.sync(bin, ['--version'], { cwd: consumer, encoding: 'utf8' });
  assert.equal(versionResult.status, 0, versionResult.stderr);
  assert.equal(versionResult.stdout.trim(), version);
  for (const args of [
    ['--help'],
    ['--version'],
    ['init', '--template', 'minimal', '--yes'],
    ['validate'],
    ['plan'],
  ]) {
    run(bin, args, consumer);
  }
  console.log(`Packed npm consumer verified: expo-native-workspace@${version}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
