import { build } from 'esbuild';
import { rmSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
rmSync('dist', { recursive: true, force: true });
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--emitDeclarationOnly'], {
  stdio: 'inherit',
});
await build({
  entryPoints: ['src/index.ts', 'src/plugin.ts', 'src/cli.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
});
chmodSync('dist/cli.js', 0o755);
