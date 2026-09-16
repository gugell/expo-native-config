import assert from 'node:assert/strict';
import spawn from 'cross-spawn';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prebuild = process.argv.includes('--prebuild');
const examples = [
  ['share-extension', 'ios', ['WorkspaceShare', 'com.apple.product-type.app-extension']],
  ['widget', 'ios', ['WorkspaceWidget', 'com.apple.product-type.app-extension']],
  ['native-dependencies', 'ios', ['WorkspaceMath', 'WorkspaceGreeting']],
  ['multi-scheme', 'ios', ['WorkspaceDevelopment', 'WorkspaceProduction']],
  [
    'android-gradle',
    'android',
    ['androidx.collection:collection-ktx:1.4.5', 'org.gradle.parallel=true'],
  ],
  [
    'android-manifest',
    'android',
    ['android.permission.CAMERA', 'android.hardware.camera', 'android:supportsRtl="true"'],
  ],
];
function run(args, cwd) {
  const result = spawn.sync('pnpm', args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `pnpm ${args.join(' ')} failed in ${cwd}`);
}
function nativeText(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['Pods', 'build', '.gradle', '.git'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return nativeText(path);
    if (
      /\.(pbxproj|xcscheme|plist|xml|gradle|properties)$/.test(entry.name) ||
      entry.name === 'Podfile'
    ) {
      return [entry.name, readFileSync(path, 'utf8')];
    }
    return [];
  });
}
for (const [name, platform, markers] of examples) {
  const cwd = join(root, 'apps', name);
  run(['exec', 'expo-native-workspace', 'validate'], cwd);
  run(['exec', 'expo-native-workspace', 'plan'], cwd);
  if (prebuild) {
    run(
      [
        'exec',
        'expo',
        'prebuild',
        '--clean',
        '--no-install',
        '--platform',
        platform,
        '--template',
        'expo-template-bare-minimum@56.0.35',
      ],
      cwd,
    );
    const output = nativeText(join(cwd, platform)).join('\n');
    for (const marker of markers)
      assert(output.includes(marker), `${name}: generated ${platform} project lacks ${marker}`);
  }
  console.log(`Verified ${name}${prebuild ? ` (${platform} prebuild)` : ''}`);
}
