import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cli = path.resolve('dist/cli.js');
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

const WIDGET_SWIFT = `import WidgetKit
import SwiftUI

@main
struct SampleWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "sample", provider: Provider()) { _ in Text("hi") }
  }
}
`;

function write(root: string, file: string, contents: string): void {
  const dest = path.join(root, file);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, contents);
}

/**
 * A pnpm-shaped workspace: an app under apps/, a package under packages/, and
 * the app's node_modules entry a symlink to that package — which is what the
 * package manager actually produces and what resolution has to survive.
 */
function workspace(options: { linkPackage?: boolean } = {}): {
  root: string;
  app: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), 'enc-targets-'));
  write(root, 'pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
  write(root, 'package.json', JSON.stringify({ name: 'mono', private: true }));

  const app = path.join(root, 'apps/mobile');
  write(root, 'apps/mobile/package.json', JSON.stringify({ name: 'mobile', version: '1.0.0' }));
  write(
    root,
    'apps/mobile/app.json',
    JSON.stringify({
      expo: { name: 'Mobile', slug: 'mobile', ios: { bundleIdentifier: 'com.example.mobile' } },
    }),
  );
  write(root, 'apps/mobile/workspace.config.json', JSON.stringify({ schemaVersion: 1 }));

  write(
    root,
    'packages/shared-widget/package.json',
    JSON.stringify({ name: '@mono/shared-widget', version: '1.0.0', main: 'index.js' }),
  );
  write(root, 'packages/shared-widget/index.js', 'module.exports = {};');
  write(root, 'packages/shared-widget/SharedWidget.swift', WIDGET_SWIFT);
  write(
    root,
    'packages/shared-widget/target.config.js',
    "module.exports = { type: 'widget', deploymentTarget: '18.0', frameworks: ['WidgetKit'] };\n",
  );

  if (options.linkPackage !== false) {
    mkdirSync(path.join(app, 'node_modules/@mono'), { recursive: true });
    symlinkSync(
      path.join(root, 'packages/shared-widget'),
      path.join(app, 'node_modules/@mono/shared-widget'),
      'dir',
    );
  }
  return { root, app };
}

function planOf(app: string) {
  const result = run('plan', '--project', app, '--json');
  assert.equal(result.status ?? 0, 0, result.stdout || result.stderr);
  return JSON.parse(result.stdout) as {
    valid: boolean;
    operations: Array<{ id: string; desired?: unknown }>;
  };
}

test('a directory carrying target.config.js becomes a target with no entry in the config', () => {
  const { app } = workspace();
  write(app, 'targets/LocalWidget/LocalWidget.swift', WIDGET_SWIFT);
  write(
    app,
    'targets/LocalWidget/target.config.js',
    "module.exports = { type: 'widget', bundleIdentifier: '.localwidget', deploymentTarget: '18.0' };\n",
  );
  // workspace.config.json declares no targets at all.
  const plan = planOf(app);
  assert.ok(plan.valid);
  assert.ok(
    plan.operations.some((op) => op.id === 'target:LocalWidget:infoPlist'),
    'the discovered target is planned',
  );
});

test('a target.config.json is read the same way, and the name defaults to the directory', () => {
  const { app } = workspace();
  write(app, 'targets/JsonWidget/JsonWidget.swift', WIDGET_SWIFT);
  write(
    app,
    'targets/JsonWidget/target.config.json',
    JSON.stringify({ type: 'widget', bundleIdentifier: '.jsonwidget' }),
  );
  assert.ok(planOf(app).operations.some((op) => op.id === 'target:JsonWidget:infoPlist'));
});

test("@bacons/apple-targets' expo-target.config.js is accepted", () => {
  const { app } = workspace();
  write(app, 'targets/BaconWidget/BaconWidget.swift', WIDGET_SWIFT);
  write(
    app,
    'targets/BaconWidget/expo-target.config.js',
    "module.exports = { type: 'widget', bundleIdentifier: '.bacon' };\n",
  );
  assert.ok(planOf(app).operations.some((op) => op.id === 'target:BaconWidget:infoPlist'));
});

test('a directory without a config file is not a target', () => {
  const { app } = workspace();
  write(app, 'targets/NotATarget/README.md', 'just some files\n');
  const plan = planOf(app);
  assert.equal(
    plan.operations.some((op) => op.id.startsWith('target:NotATarget')),
    false,
  );
});

test('a workspace package is linked as a target through its own target.config.js', () => {
  const { app } = workspace();
  write(
    app,
    'workspace.config.json',
    JSON.stringify({
      schemaVersion: 1,
      ios: {
        targets: [
          { package: '@mono/shared-widget', name: 'SharedWidget', bundleIdentifier: '.shared' },
        ],
      },
    }),
  );
  const plan = planOf(app);
  assert.ok(plan.valid);
  assert.ok(plan.operations.some((op) => op.id === 'target:SharedWidget:infoPlist'));
  // The resolved source is not part of the plan payload, but validate checks
  // the directory exists and is inside the workspace — so a plan that passes
  // is a source that resolved out of the app and into the package.
  assert.equal(run('validate', '--project', app).status ?? 0, 0);
});

test('the app overrides what the package declares', () => {
  const { app } = workspace();
  write(
    app,
    'workspace.config.json',
    JSON.stringify({
      schemaVersion: 1,
      ios: {
        targets: [
          {
            package: '@mono/shared-widget',
            name: 'SharedWidget',
            bundleIdentifier: '.shared',
            // The package says 18.0; the app linking it decides.
            deploymentTarget: '17.0',
          },
        ],
      },
    }),
  );
  const all = planOf(app).operations.find((op) => op.id === 'target:all');
  assert.match(JSON.stringify(all?.desired ?? {}), /17\.0/);
  assert.doesNotMatch(JSON.stringify(all?.desired ?? {}), /18\.0/);
});

test('an inline entry stays authoritative over a discovered directory of the same name', () => {
  const { app } = workspace();
  write(app, 'targets/Dup/Dup.swift', WIDGET_SWIFT);
  write(
    app,
    'targets/Dup/target.config.js',
    "module.exports = { type: 'widget', deploymentTarget: '18.0' };\n",
  );
  write(
    app,
    'workspace.config.json',
    JSON.stringify({
      schemaVersion: 1,
      ios: {
        targets: [
          {
            name: 'Dup',
            type: 'widget',
            source: 'targets/Dup',
            bundleIdentifier: '.dup',
            deploymentTarget: '16.4',
          },
        ],
      },
    }),
  );
  const plan = planOf(app);
  const ids = plan.operations.filter((op) => op.id.startsWith('target:Dup'));
  assert.equal(ids.length, 1, 'no duplicate target from declaring and discovering the same name');
  assert.match(JSON.stringify(plan.operations.find((op) => op.id === 'target:all')), /16\.4/);
});

test('a package that is not a dependency fails with an actionable message', () => {
  const { app } = workspace({ linkPackage: false });
  write(
    app,
    'workspace.config.json',
    JSON.stringify({
      schemaVersion: 1,
      ios: { targets: [{ package: '@mono/shared-widget', name: 'SharedWidget' }] },
    }),
  );
  const result = run('validate', '--project', app, '--json');
  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout) as { diagnostics: Array<{ code: string }> };
  assert.equal(parsed.diagnostics[0].code, 'target.package');
  assert.match(result.stdout, /Add it as a dependency/);
});

test('a target.config.js that exports nothing usable is rejected, naming the file', () => {
  const { root, app } = workspace();
  // Exports an empty object: no type, which an inline target could never omit.
  writeFileSync(path.join(root, 'packages/shared-widget/target.config.js'), 'module.exports = {};');
  write(
    app,
    'workspace.config.json',
    JSON.stringify({
      schemaVersion: 1,
      ios: { targets: [{ package: '@mono/shared-widget', name: 'SharedWidget' }] },
    }),
  );
  const result = run('validate', '--project', app, '--json');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /is not a valid target/);
  assert.match(result.stdout, /shared-widget/, 'the message names where it came from');
});

test('a typo in a discovered target.config.js is rejected like a typo inline', () => {
  const { app } = workspace();
  write(app, 'targets/Typo/Typo.swift', WIDGET_SWIFT);
  write(
    app,
    'targets/Typo/target.config.js',
    "module.exports = { type: 'widget', bundleIdentifer: '.typo' };\n",
  );
  const result = run('validate', '--project', app, '--json');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /is not a valid target/);
  assert.match(result.stdout, /targets\/Typo/);
});

test('a target source outside the workspace is still refused', () => {
  const { app } = workspace();
  write(
    app,
    'workspace.config.json',
    JSON.stringify({
      schemaVersion: 1,
      ios: {
        targets: [
          {
            name: 'Escape',
            type: 'widget',
            source: '../../../../../../tmp',
            bundleIdentifier: '.x',
          },
        ],
      },
    }),
  );
  const result = run('validate', '--project', app, '--json');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /must stay inside the workspace/);
});
