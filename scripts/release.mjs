import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const cli = resolve(dirname(require.resolve('release-it/package.json')), 'bin/release-it.js');
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const dryRun = args.includes('--dry-run');
// Dry runs are deliberately offline: no registry, GitHub, or upstream checks.
// release-it still computes the next version and changelog from local history.
const offline = dryRun
  ? [
      '--ci',
      '--no-npm.publish',
      '--npm.skipChecks',
      '--no-github.release',
      '--no-git.push',
      '--no-git.requireUpstream',
      '--no-git.requireBranch',
      '--no-git.requireCleanWorkingDir',
    ]
  : [];
const result = spawnSync(
  process.execPath,
  [cli, '--config', resolve(root, '.release-it.json'), ...args, ...offline],
  {
    cwd: resolve(root, 'packages/expo-native-workspace'),
    stdio: 'inherit',
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
