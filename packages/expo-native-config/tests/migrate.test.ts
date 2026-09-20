import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cli = path.resolve('dist/cli.js');
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

interface Finding {
  source: string;
  status: string;
  field?: string;
  message: string;
}

/** An app that reached for config plugins and native edits the hard way. */
function legacyApp(overrides: { dynamic?: boolean } = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'enw-migrate-'));
  const write = (file: string, contents: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
  };
  write('package.json', JSON.stringify({ name: 'legacy', version: '1.0.0', private: true }));
  const expo = {
    name: 'Legacy',
    slug: 'legacy',
    ios: { bundleIdentifier: 'com.example.legacy' },
    plugins: [
      'expo-router',
      ['expo-build-properties', { ios: { deploymentTarget: '16.0' } }],
      './plugins/withPodTweak',
    ],
  };
  if (overrides.dynamic) {
    write('app.config.js', `module.exports = ${JSON.stringify({ expo })};`);
  } else {
    write('app.json', JSON.stringify({ expo }));
  }
  write(
    'plugins/withPodTweak.js',
    "const { withPodfile } = require('@expo/config-plugins');\nmodule.exports = (c) => withPodfile(c, (x) => x);\n",
  );
  write(
    'ios/Podfile',
    "target 'Legacy' do\n  use_expo_modules!\n  pod 'VendorSDK', '~> 4.2'\n  post_install do |installer|\n  end\nend\n",
  );
  write(
    'android/gradle.properties',
    'org.gradle.jvmargs=-Xmx2048m\nnewArchEnabled=true\nvendor.sdk.mode=production\n',
  );
  write(
    'android/app/build.gradle',
    "dependencies {\n    implementation 'com.facebook.react:react-android'\n    implementation 'com.squareup.okhttp3:okhttp:4.12.0'\n    implementation project(':native-lib')\n}\n",
  );
  write(
    'android/app/src/main/AndroidManifest.xml',
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n' +
      '  <uses-feature android:name="android.hardware.camera" android:required="false"/>\n' +
      '  <application>\n' +
      '    <meta-data android:name="expo.modules.updates.ENABLED" android:value="false"/>\n' +
      '    <meta-data android:name="com.vendor.API_KEY" android:value="abc123"/>\n' +
      '  </application>\n' +
      '</manifest>\n',
  );
  return root;
}

function migrateJson(root: string, ...args: string[]) {
  const result = run('migrate', '--project', root, '--json', ...args);
  assert.equal(result.status ?? 0, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as {
    config: { ios?: Record<string, unknown>; android?: Record<string, unknown> };
    source: string;
    findings: Finding[];
    written: string[];
  };
}

test('migrate extracts app-owned native state and leaves owned values alone', () => {
  const root = legacyApp();
  const { config, findings } = migrateJson(root, '--dry-run');

  assert.deepEqual(config.ios?.pods, [{ pod: 'VendorSDK', version: '~> 4.2' }]);
  assert.deepEqual(config.android?.gradleProperties, { 'vendor.sdk.mode': 'production' });
  assert.deepEqual(config.android?.dependencies, [
    { module: 'com.squareup.okhttp3:okhttp:4.12.0' },
    { project: 'native-lib' },
  ]);
  assert.deepEqual(config.android?.features, [
    { name: 'android.hardware.camera', required: false },
  ]);
  assert.deepEqual(config.android?.metaData, { 'com.vendor.API_KEY': 'abc123' });

  const owned = findings.filter((f) => f.status === 'owned-elsewhere').map((f) => f.source);
  // Template and Expo-owned values must not be re-declared: two writers for one
  // value is the failure this package exists to avoid.
  assert.ok(owned.some((s) => s.includes('org.gradle.jvmargs')));
  assert.ok(owned.some((s) => s.includes('newArchEnabled')));
  assert.ok(
    owned.some((s) => s.includes('plugins[0]')),
    'published plugins stay registered',
  );
  assert.equal(
    config.android?.metaData && 'expo.modules.updates.ENABLED' in config.android.metaData,
    false,
  );
  assert.equal(
    JSON.stringify(config).includes('com.facebook.react:react-android'),
    false,
    'React Native template dependencies are not extracted',
  );
});

test('migrate reports a local plugin as manual work, naming the field that replaces it', () => {
  const { findings } = migrateJson(legacyApp(), '--dry-run');
  const plugin = findings.find((f) => f.source.includes('withPodTweak'));
  assert.ok(plugin, 'the local plugin is reported');
  assert.equal(plugin.status, 'manual');
  assert.match(plugin.field ?? '', /ios\.pods/);
  // The command must never claim to have translated plugin JavaScript.
  assert.match(plugin.message, /will not translate it for you/);
});

test('a dynamic Expo config is read without executing its plugins', () => {
  const { findings } = migrateJson(legacyApp({ dynamic: true }), '--dry-run');
  assert.ok(
    findings.some((f) => f.source.includes('withPodTweak')),
    'local plugins are still found through a dynamic config',
  );
});

test('--dry-run writes nothing; a second migrate refuses to shadow the config', () => {
  const root = legacyApp();
  const dry = migrateJson(root, '--dry-run');
  assert.deepEqual(dry.written, []);
  assert.equal(existsSync(path.join(root, 'workspace.config.ts')), false);

  const written = migrateJson(root);
  assert.deepEqual(written.written, ['workspace.config.ts']);
  const emitted = readFileSync(path.join(root, 'workspace.config.ts'), 'utf8');
  assert.match(emitted, /defineWorkspace\(/);
  assert.equal(emitted, dry.source, 'the dry run previewed exactly what was written');

  const second = run('migrate', '--project', root, '--json');
  assert.equal(second.status, 1);
  assert.match(second.stdout, /Refusing to shadow existing workspace.config.ts/);
});

test('the emitted manifest validates and plans', () => {
  const root = legacyApp();
  const { config } = migrateJson(root, '--dry-run');
  // The TypeScript form needs the package installed in the fixture; the JSON
  // form exercises the same schema and planner.
  writeFileSync(path.join(root, 'workspace.config.json'), JSON.stringify(config));
  assert.equal(run('validate', '--project', root).status ?? 0, 0);
  const plan = run('plan', '--project', root, '--json');
  assert.equal(plan.status ?? 0, 0);
  const parsed = JSON.parse(plan.stdout) as { operations: Array<{ id: string }> };
  const ids = parsed.operations.map((op) => op.id);
  assert.ok(ids.includes('android.dependencies'));
  assert.ok(ids.some((id) => id.startsWith('pod:')));
});

test('migrate on a project with no native directories still reads the Expo config', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'enw-migrate-bare-'));
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'bare', version: '1.0.0' }),
  );
  writeFileSync(
    path.join(root, 'app.json'),
    JSON.stringify({ expo: { name: 'Bare', slug: 'bare', plugins: ['expo-router'] } }),
  );
  const { config, findings } = migrateJson(root, '--dry-run');
  assert.deepEqual(config, { schemaVersion: 1 });
  assert.ok(findings.some((f) => f.message.includes('No ios/ or android/ directory')));
});
