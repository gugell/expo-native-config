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
  [
    'native-workarounds',
    'android',
    [
      "include ':workspace-native-lib'",
      "implementation project(':workspace-native-lib')",
      "abiFilters 'arm64-v8a'",
      'reactNativeArchitectures=arm64-v8a',
      'expoAutolinking.exclude',
      'dev.exponativeconfig.SAMPLE_KEY',
      'tools:node="remove"',
      'android:windowSoftInputMode="adjustResize"',
      'workspace_sample_value',
      "classpath 'com.google.gms:google-services:4.4.2'",
      "force 'com.google.android.material:material:1.12.0'",
    ],
  ],
  [
    'native-workarounds-ios',
    'ios',
    [
      'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES',
      'ExtractAppIntentsMetadata',
      "use_expo_modules!(exclude: ['@expo-native-config/absent-module'])",
      '$WorkspaceSampleStaticFramework = true',
      'LD_EXPORT_SYMBOLS = NO',
      'Workspace Upload Symbols',
    ],
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
      /\.(pbxproj|xcscheme|plist|xml|gradle|properties|kt|java|swift)$/.test(entry.name) ||
      entry.name === 'Podfile'
    ) {
      return [entry.name, readFileSync(path, 'utf8')];
    }
    return [];
  });
}
for (const [name, platform, markers] of examples) {
  // One app can appear twice, once per platform; the directory drops the suffix.
  const cwd = join(root, 'apps', name.replace(/-ios$/, ''));
  run(['exec', 'expo-native-config', 'validate'], cwd);
  run(['exec', 'expo-native-config', 'plan'], cwd);
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
