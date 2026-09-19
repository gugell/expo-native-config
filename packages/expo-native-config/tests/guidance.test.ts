import assert from 'node:assert/strict';
import test from 'node:test';
import { collectGuidance } from '../src/guidance';
import type { WorkspaceConfig } from '../src/schema';

const guidance = (config: WorkspaceConfig) => collectGuidance(config);
const codes = (config: WorkspaceConfig) => guidance(config).map((d) => d.code);

test('a replace rule aimed at a generated entry point is refused', () => {
  for (const config of [
    {
      schemaVersion: 1 as const,
      ios: {
        podfile: {
          replace: [{ find: 'AppDelegate.swift', replacement: 'x' }],
        },
      },
    },
    {
      schemaVersion: 1 as const,
      android: {
        gradle: { app: [{ find: 'MainApplication', replacement: 'x' }] },
      },
    },
  ]) {
    const [diagnostic] = guidance(config);
    assert.equal(diagnostic?.severity, 'error');
    assert.equal(diagnostic?.code, 'guidance.entry-point');
    // The message has to name the supported alternative, not just refuse.
    assert.match(diagnostic.message, /ExpoAppDelegateSubscriber|ReactActivityLifecycleListener/);
    assert.match(diagnostic.message, /create-expo-module/);
  }
});

test('settings another tool owns are flagged with the tool that owns them', () => {
  const diagnostics = guidance({
    schemaVersion: 1,
    ios: {
      buildSettings: { IPHONEOS_DEPLOYMENT_TARGET: '16.0', LD_EXPORT_SYMBOLS: 'NO' },
      podfile: { lines: ['use_frameworks! :linkage => :static'] },
    },
    android: {
      gradleProperties: {
        'android.enableProguardInReleaseBuilds': true,
        'org.gradle.parallel': true,
      },
    },
  });
  assert.deepEqual(diagnostics.map((d) => d.source).sort(), [
    'android.gradleProperties.android.enableProguardInReleaseBuilds',
    'ios.buildSettings.IPHONEOS_DEPLOYMENT_TARGET',
    'ios.podfile.lines[0]',
  ]);
  assert.match(
    diagnostics.find((d) => d.source === 'ios.podfile.lines[0]')!.message,
    /expo-build-properties owns ios\.useFrameworks/,
  );
  // Everything else is left alone: this is guidance, not a style guide.
  assert.equal(
    diagnostics.some((d) => d.source?.includes('LD_EXPORT_SYMBOLS')),
    false,
  );
  assert.equal(
    diagnostics.every((d) => d.severity === 'warning'),
    true,
  );
});

test('a typed resource written as a raw file points at the typed field', () => {
  const diagnostics = guidance({
    schemaVersion: 1,
    android: {
      resources: [
        { path: 'values/strings.xml', contents: '<resources/>' },
        { path: 'values-night/colors.xml', contents: '<resources/>' },
        { path: 'xml/network_security_config.xml', contents: '<x/>' },
      ],
    },
  });
  assert.deepEqual(codes({ schemaVersion: 1 }), []);
  assert.equal(diagnostics.length, 2, 'only the two with a typed equivalent');
  assert.match(diagnostics[0].message, /Use android\.strings instead/);
  assert.match(diagnostics[1].message, /Use android\.colors instead/);
});

test('a config that uses the supported fields produces no guidance at all', () => {
  assert.deepEqual(
    codes({
      schemaVersion: 1,
      ios: {
        buildSettings: { LD_EXPORT_SYMBOLS: 'NO' },
        podfileProperties: { 'expo.jsEngine': 'hermes' },
      },
      android: {
        strings: { expo_custom_value: 'x' },
        colors: { splash: '#fff' },
        resources: [{ path: 'xml/network_security_config.xml', contents: '<x/>' }],
        gradleProperties: { 'org.gradle.parallel': true },
      },
    }),
    [],
  );
});
