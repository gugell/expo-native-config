import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin') {
  console.error('native:check requires macOS and Xcode with an iOS Simulator SDK.');
  process.exit(1);
}
const output = mkdtempSync(join(tmpdir(), 'expo-native-workspace-native-'));
console.log(`Native build logs and products: ${output}`);
for (const [app, project, target] of [
  ['share-extension', 'ShareExtension', 'WorkspaceShare'],
  ['widget', 'HomeScreenWidget', 'WorkspaceWidget'],
]) {
  const projectPath = join(root, 'apps', app, 'ios', `${project}.xcodeproj`);
  if (!existsSync(projectPath)) {
    throw new Error(`Missing ${projectPath}. Run pnpm examples:check --prebuild first.`);
  }
  const logPath = join(output, `${target}.log`);
  const log = openSync(logPath, 'w');
  let result;
  try {
    result = spawnSync(
      'xcodebuild',
      [
        '-project',
        projectPath,
        '-target',
        target,
        '-configuration',
        'Debug',
        '-sdk',
        'iphonesimulator',
        'CODE_SIGNING_ALLOWED=NO',
        `SYMROOT=${join(output, target, 'products')}`,
        `OBJROOT=${join(output, target, 'intermediates')}`,
        `CLANG_MODULE_CACHE_PATH=${join(output, 'module-cache')}`,
        'build',
      ],
      { cwd: root, stdio: ['ignore', log, log], timeout: 600_000 },
    );
  } finally {
    closeSync(log);
  }
  if (result.error || result.status !== 0) {
    console.error(readFileSync(logPath, 'utf8').split('\n').slice(-80).join('\n'));
    throw new Error(`${target} build failed; full log: ${logPath}`, { cause: result.error });
  }
  console.log(`Built ${target} for iOS Simulator without signing. Log: ${logPath}`);
}
console.log(
  'Extension targets compiled. Host apps, installation, and interactive behavior were not checked.',
);
