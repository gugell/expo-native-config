#!/usr/bin/env node
import path from 'node:path';
import { Command, CommanderError } from 'commander';
const { version } = require('../package.json') as { version: string };
interface Options {
  project: string;
  config?: string;
  json?: boolean;
  verbose?: boolean;
  ci?: boolean;
  id?: string;
  template?: string;
  yes?: boolean;
}
const commands = 'init plan validate doctor explain completion';
/** Oldest SDK this package supports, and the newest it has been verified against. */
const MINIMUM_EXPO_SDK = 50;
const LATEST_VERIFIED_EXPO_SDK = 57;
function base(command: Command): Command {
  if (command.name() !== 'init')
    command.option('--config <file>', 'Explicit workspace config path');
  return command
    .option('--project <directory>', 'Expo app root', process.cwd())
    .option('--json', 'Machine-readable output')
    .option('--verbose', 'Include operation sources');
}
async function inspect(command: string, options: Options): Promise<void> {
  const { createSession } = await import('./session');
  const { toPlanOperation, redactDeep } = await import('./engine');
  const session = createSession(path.resolve(options.project), options.config);
  const operations = redactDeep(session.plan.ops.map(toPlanOperation));
  const diagnostics = [...session.diagnostics];
  if (command === 'doctor') {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 14))
      diagnostics.push({
        severity: 'error',
        code: 'node.version',
        message: 'Node 22.14 or newer is required.',
      });
    try {
      const { createRequire } = await import('node:module');
      const req = createRequire(path.join(path.resolve(options.project), 'package.json'));
      const expo = req('expo/package.json') as { version: string };
      const major = Number(expo.version.split('.')[0]);
      // Below the minimum is a real error. Above the tested range is a warning:
      // a new SDK usually works, and blocking doctor would make the tool
      // unusable for anyone on the latest release before it is re-verified.
      if (major < MINIMUM_EXPO_SDK)
        diagnostics.push({
          severity: 'error',
          code: 'expo.version',
          message: `Expo ${expo.version} is older than the supported SDK ${MINIMUM_EXPO_SDK}.`,
        });
      else if (major > LATEST_VERIFIED_EXPO_SDK)
        diagnostics.push({
          severity: 'warning',
          code: 'expo.version',
          message: `Expo ${expo.version} is newer than SDK ${LATEST_VERIFIED_EXPO_SDK}, the latest this package was verified against. Inspect the generated native projects after prebuild.`,
        });
    } catch {
      diagnostics.push({
        severity: 'warning',
        code: 'expo.missing',
        message: 'Expo is not installed in this project. Install Expo SDK 56 before prebuild.',
      });
    }
  }
  if (command === 'doctor' || command === 'plan') {
    // Regex rewrites of generated Ruby/Groovy are the documented last resort:
    // they break silently when the Expo template changes between SDKs.
    const escapeHatches = operations.filter(
      (op) => op.risk === 'escape-hatch' && op.phase !== 'cleanup',
    );
    for (const op of escapeHatches)
      diagnostics.push({
        severity: 'warning',
        code: 'plan.escape-hatch',
        message: `${op.id} edits generated native source directly (${op.source}). Re-verify it after an Expo SDK upgrade.`,
      });
  }
  const valid = !diagnostics.some((d) => d.severity === 'error');
  if (command === 'explain' && options.id && !operations.some((op) => op.id === options.id)) {
    const { ConfigError } = await import('./session');
    throw new ConfigError([
      {
        severity: 'error',
        code: 'operation.missing',
        message: `No operation with id ${options.id}`,
      },
    ]);
  }
  const selected =
    command === 'explain' && options.id
      ? operations.filter((op) => op.id === options.id)
      : operations;
  const payload = {
    valid,
    configPath: session.configPath,
    diagnostics,
    ...(['plan', 'explain'].includes(command)
      ? {
          summary: {
            operations: selected.length,
            warnings: diagnostics.filter((d) => d.severity === 'warning').length,
          },
          operations: selected,
        }
      : {}),
  };
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(
      `${valid ? '✓' : '✗'} ${command === 'plan' ? 'Native intent plan' : command} — ${session.configPath}`,
    );
    for (const d of diagnostics) console.log(`${d.severity}: ${d.message}`);
    if (['plan', 'explain'].includes(command)) {
      // Cleanup ops remove blocks a previous config left behind; they are noise
      // unless you are auditing the whole plan.
      const shown = options.verbose ? selected : selected.filter((op) => op.phase !== 'cleanup');
      const hidden = selected.length - shown.length;
      for (const op of shown) {
        console.log(`  ${op.id}  ${op.label}`);
        if (options.verbose || command === 'explain')
          console.log(`    ${op.kind} · ${op.source}\n    ${JSON.stringify(op.desired ?? null)}`);
      }
      console.log(
        `${shown.length} declared operations${
          hidden > 0 ? ` (+${hidden} cleanup, use --verbose)` : ''
        }. Preview only; native state is not compared.`,
      );
    }
  }
  process.exitCode = valid ? 0 : 1;
}
const program = new Command()
  .name('expo-native-config')
  .description('Typed native configuration for Expo')
  .version(version)
  .showHelpAfterError();
program.exitOverride();
for (const name of ['plan', 'validate', 'doctor', 'explain']) {
  const descriptions: Record<string, string> = {
    plan: 'Preview validated native intent without native writes',
    validate: 'Validate configuration and semantic constraints',
    doctor: 'Check configuration and installed environment',
    explain: 'Explain a planned operation',
  };
  const command = base(program.command(name).description(descriptions[name]));
  if (name === 'doctor')
    command.option('--ci', 'Noninteractive CI mode (same diagnostics and exit codes)');
  if (name === 'explain') command.requiredOption('--id <operation>', 'Operation ID from plan');
  command.action((options: Options) => inspect(name, options));
}
base(
  program
    .command('init')
    .description('Create a workspace config without overwriting existing files'),
)
  .option('--template <name>', 'minimal, share-extension, widget, android', 'minimal')
  .option('-y, --yes', 'Accept the selected template noninteractively')
  .action(async (options: Options) => {
    if (!options.yes && process.stdin.isTTY) {
      const { createInterface } = await import('node:readline/promises');
      const rl = createInterface({ input: process.stdin, output: process.stderr });
      try {
        const answer = await rl.question(
          `Create ${options.template} config in ${options.project}? [y/N] `,
        );
        if (!/^y(es)?$/i.test(answer)) return;
      } finally {
        rl.close();
      }
    } else if (!options.yes) {
      const { ConfigError } = await import('./session');
      throw new ConfigError([
        {
          severity: 'error',
          code: 'init.confirmation',
          message: 'Use --yes for noninteractive initialization.',
        },
      ]);
    }
    const { initialize } = await import('./init');
    const result = initialize(path.resolve(options.project), options.template);
    if (options.json) console.log(JSON.stringify({ valid: true, ...result }, null, 2));
    else console.log(`Created ${result.files.join(', ')}\n\n${result.next.join('\n')}`);
  });
program
  .command('completion [shell]')
  .description('Print shell completion (bash, zsh, fish)')
  .action((shell = 'bash') => {
    if (shell === 'bash') console.log(`complete -W "${commands}" expo-native-config`);
    else if (shell === 'zsh')
      console.log(`#compdef expo-native-config\n_arguments '1:command:(${commands})'`);
    else if (shell === 'fish') console.log(`complete -c expo-native-config -f -a '${commands}'`);
    else throw new Error('Supported shells: bash, zsh, fish');
  });
if (process.argv.includes('--json')) program.configureOutput({ writeErr: () => {} });
process.once('SIGINT', () => {
  process.exitCode = 130;
  process.exit(130);
});
void program.parseAsync().catch(async (error: unknown) => {
  if (error instanceof CommanderError && error.exitCode === 0) return;
  const { ConfigError } = await import('./session');
  const diagnostics =
    error instanceof ConfigError
      ? error.diagnostics
      : [
          {
            severity: 'error',
            code: error instanceof CommanderError ? 'cli.arguments' : 'tool.failure',
            message: error instanceof Error ? error.message : String(error),
          },
        ];
  if (process.argv.includes('--json'))
    console.log(JSON.stringify({ valid: false, diagnostics }, null, 2));
  else if (!(error instanceof CommanderError))
    console.error(diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'));
  process.exitCode = error instanceof ConfigError || error instanceof CommanderError ? 1 : 2;
});
