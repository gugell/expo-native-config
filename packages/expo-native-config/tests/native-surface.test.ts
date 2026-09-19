import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { mergeContents, removeContents } from '@expo/config-plugins/build/utils/generateCode';
import { gradleExtrasGenerator } from '../src/engine/android/generators/gradleExtras';
import { manifestExtrasGenerator } from '../src/engine/android/generators/manifestExtras';
import { androidResourcesGenerator } from '../src/engine/android/generators/resources';
import { ensureComponent, ensureMetaData } from '../src/engine/android/androidExecutor';
import type {
  AndroidComponentSpec,
  AndroidGradleBlockOp,
  AndroidManifestMetaDataOp,
} from '../src/engine/android/types';
import { podfileExtrasGenerator } from '../src/engine/ios-pods/generators/podfileExtras';
import { podsGenerator } from '../src/engine/ios-pods/generators/pods';
import { mainTargetGenerator } from '../src/engine/ios-xcode/generators/mainTarget';
import { fileExecutor } from '../src/engine/core/fileExecutor';
import type { CopyFileOp, RemoveBlockOp, ReplaceInFileOp } from '../src/engine/core';
import { WorkspaceSchema } from '../src/schema';
import {
  Abi,
  AndroidApplication,
  AndroidComponent,
  AndroidDependency,
  AndroidFeature,
  AndroidHardware,
  AndroidModule,
  AndroidPermission,
  BuildConfigField,
  MavenRepository,
  Package,
  Pod,
  PodBuildSettings,
  ReplaceRule,
  RunScript,
  Scheme,
  SwiftPackageRequirement,
  Target,
  XcodeBuildSettings,
} from '../src/factories';

const ctx = (manifest: Record<string, unknown>) => ({
  manifest: { manifestVersion: 1 as const, ...manifest },
  config: {},
  projectRoot: '/tmp',
  configPath: '/tmp/workspace.config.ts',
});

type PlannedOp = Record<string, PlannedValue> & {
  kind: string;
  meta: Record<string, PlannedValue>;
};
type PlannedValue =
  string | number | boolean | undefined | null | Record<string, unknown> | unknown[];

function ops(
  generator: { generate: (c: ReturnType<typeof ctx>) => { ops: unknown[] } },
  manifest: Record<string, unknown>,
): PlannedOp[] {
  return generator.generate(ctx(manifest)).ops as PlannedOp[];
}

test('removing a pod declaration clears its Podfile block instead of leaving it behind', () => {
  const withPods = ops(podsGenerator, { localPods: [{ pod: 'A', path: '../a' }] });
  const merge = withPods.find((op) => op.meta.id === 'pod:local') as AndroidGradleBlockOp & {
    tag: string;
    newSrc: string;
    anchor: RegExp;
    offset: number;
    comment: string;
  };
  assert.equal(merge.kind, 'mergeBlock');

  const podfile = 'use_expo_modules!\npost_install do |installer|\nend\n';
  const merged = mergeContents({
    src: podfile,
    newSrc: merge.newSrc,
    tag: merge.tag,
    anchor: merge.anchor,
    offset: merge.offset,
    comment: merge.comment,
  }).contents;
  assert.match(merged, /pod 'A'/);

  const cleared = ops(podsGenerator, {}).find((op) => op.meta.id === 'pod:local') as RemoveBlockOp;
  assert.equal(cleared.kind, 'removeBlock');
  const restored = removeContents({ src: merged, tag: cleared.tag }).contents;
  assert.equal(restored, podfile);
});

test('autolinking exclusion rewrites only a bare use_expo_modules! and is applied once', () => {
  const [op] = ops(podfileExtrasGenerator, {
    iosAutolinkingExclude: ['@clevertap/clevertap-expo-plugin'],
  }).filter((candidate) => candidate.meta.id === 'ios.autolinkingExclude') as ReplaceInFileOp[];

  const apply = (src: string): string =>
    src.includes(op.skipIfContains!) ? src : src.replace(new RegExp(op.find), op.replacement);

  const once = apply('use_expo_modules!\n');
  assert.match(once, /use_expo_modules!\(exclude: \['@clevertap\/clevertap-expo-plugin'\]\)/);
  assert.equal(apply(once), once, 'second prebuild must not rewrite the line again');
  assert.equal(
    apply("use_expo_modules!(exclude: ['other'])\n"),
    "use_expo_modules!(exclude: ['other'])\n",
    'an existing argument list is left alone',
  );
});

test('escape-hatch operations are reported as such so doctor can warn', () => {
  const planned = ops(podfileExtrasGenerator, {
    podfile: { postInstall: ["puts 'hi'"], replace: [{ find: 'a', replacement: 'b' }] },
  });
  const risks = planned.filter((op) => op.meta.risk === 'escape-hatch').map((op) => op.meta.id);
  assert.deepEqual(risks.sort(), [
    'ios.podfile.lines',
    'ios.podfile.postInstall',
    'ios.podfile.replace.0',
  ]);
});

test('Gradle anchors match a single line, because mergeContents matches line by line', () => {
  const planned = ops(gradleExtrasGenerator, {
    android: {
      buildscriptDependencies: ['com.google.gms:google-services:4.4.2'],
      abiFilters: ['arm64-v8a'],
    },
  });
  const blocks = planned.filter(
    (op) => op.kind === 'androidGradleBlock' && !op.append,
  ) as AndroidGradleBlockOp[];
  assert.ok(blocks.length > 0);
  for (const block of blocks) {
    assert.doesNotMatch(block.anchor, /\\n|\[\\s\\S\]/, `${block.tag} uses a multi-line anchor`);
  }

  const rootGradle = ['buildscript {', '    dependencies {', '    }', '}', ''].join('\n');
  const classpath = blocks.find((block) => block.tag.endsWith('buildscript'))!;
  const merged = mergeContents({
    src: rootGradle,
    newSrc: classpath.contents,
    tag: classpath.tag,
    anchor: new RegExp(classpath.anchor),
    offset: classpath.offset,
    comment: classpath.comment,
  }).contents;
  assert.match(merged, /classpath 'com\.google\.gms:google-services:4\.4\.2'/);
});

test('ABI filters reach React Native architectures as well as the AGP ndk block', () => {
  const planned = ops(gradleExtrasGenerator, { android: { abiFilters: ['arm64-v8a', 'x86_64'] } });
  const defaultConfig = planned.find((op) => op.meta.id === 'android.defaultConfig');
  assert.match(defaultConfig!.contents, /abiFilters 'arm64-v8a', 'x86_64'/);
  const architectures = planned.find((op) => op.meta.id === 'android.abiFilters.architectures');
  assert.equal(architectures!.value, 'arm64-v8a,x86_64');
});

test('a removed Gradle declaration emits a block removal for its file', () => {
  const planned = ops(gradleExtrasGenerator, { android: {} });
  const removals = planned.filter((op) => op.kind === 'androidGradleRemoveBlock');
  assert.deepEqual(removals.map((op) => op.file).sort(), [
    'app',
    'app',
    'project',
    'project',
    'project',
    'settings',
  ]);
});

test('a component with remove emits tools:node and merges without duplicating', () => {
  const planned = ops(manifestExtrasGenerator, {
    android: {
      components: [
        {
          kind: 'receiver',
          name: 'androidx.profileinstaller.ProfileInstallReceiver',
          remove: true,
        },
      ],
      metaData: { 'com.example.KEY': 'value' },
    },
  });
  assert.equal(planned.length, 2);

  const application: Record<string, Array<{ $: Record<string, string> }>> = {};
  const component = planned.find((op) => op.kind === 'androidManifestComponent')!
    .component as AndroidComponentSpec;
  ensureComponent(application, component);
  ensureComponent(application, component);
  assert.deepEqual(application.receiver, [
    {
      $: {
        'android:name': 'androidx.profileinstaller.ProfileInstallReceiver',
        'tools:node': 'remove',
      },
    },
  ]);

  const metaData = planned.find(
    (op) => op.kind === 'androidManifestMetaData',
  )! as unknown as AndroidManifestMetaDataOp;
  ensureMetaData(application, metaData);
  ensureMetaData(application, { ...metaData, value: 'second' });
  assert.deepEqual(application['meta-data'], [
    { $: { 'android:name': 'com.example.KEY', 'android:value': 'second' } },
  ]);
});

test('typed Android resources use introspectable mods rather than raw file writes', () => {
  const planned = ops(androidResourcesGenerator, {
    android: { strings: { expo_custom_value: 'x' }, colors: { splash: '#fff' } },
  });
  assert.deepEqual(planned.map((op) => op.kind).sort(), ['androidColor', 'androidString']);
});

test('iOS resources are copied beside the project and then referenced once', () => {
  const planned = ops(mainTargetGenerator, { iosResources: ['assets/notification.wav'] });
  const copy = planned.find((op) => op.kind === 'copyFile') as CopyFileOp;
  assert.equal(copy.from, 'assets/notification.wav');
  assert.equal(copy.path, 'notification.wav');
  assert.equal(copy.base, 'ios');
  assert.ok(planned.some((op) => op.kind === 'pbx'));

  assert.throws(
    () => ops(mainTargetGenerator, { iosResources: ['a/sound.wav', 'b/sound.wav'] }),
    /two entries named sound\.wav/,
  );
});

test('copyFile refuses to run when the declared source is missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-copy-'));
  const op: CopyFileOp = {
    kind: 'copyFile',
    base: 'ios',
    from: 'missing.wav',
    path: 'missing.wav',
    label: 'ios:resource:missing.wav',
  };
  const collected: Array<() => Promise<unknown>> = [];
  const config = fileExecutor({ mods: undefined } as never, [op]) as unknown as {
    mods: { ios: { dangerous: (c: unknown) => Promise<unknown> } };
  };
  const action = config.mods.ios.dangerous as unknown as (c: unknown) => Promise<unknown>;
  collected.push(() =>
    action({
      modRequest: { platformProjectRoot: path.join(dir, 'ios'), projectRoot: dir },
      modResults: {},
    }),
  );
  await assert.rejects(collected[0], /source file not found/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the public schema accepts the new surface and still rejects unknown fields', () => {
  const valid = WorkspaceSchema.safeParse({
    schemaVersion: 1,
    ios: {
      buildSettings: { LD_EXPORT_SYMBOLS: 'NO' },
      runScripts: [{ name: 'Upload dSYMs', script: 'echo hi' }],
      resources: ['assets/notification.wav'],
      podfileProperties: { 'expo.jsEngine': 'hermes' },
      targets: [{ name: 'Notify', type: 'notification-service' }],
    },
    android: {
      metaData: { KEY: 'value' },
      components: [{ kind: 'activity', name: '.Main', attributes: { 'android:exported': 'true' } }],
      mavenRepositories: [{ url: 'https://example.com/repo', includeGroups: ['com.example'] }],
      modules: [{ name: 'watermelondb-jsi', path: 'node_modules/x/native/android-jsi' }],
      strings: { expo_custom_value: 'x' },
    },
  });
  assert.equal(valid.success, true, JSON.stringify(valid.error?.issues));

  assert.equal(WorkspaceSchema.safeParse({ ios: { podfile: { nope: [] } } }).success, false);
  assert.equal(
    WorkspaceSchema.safeParse({ android: { components: [{ kind: 'fragment', name: 'x' }] } })
      .success,
    false,
  );
});

test('factories build the same values a literal config would, and stay schema-valid', () => {
  const config = {
    schemaVersion: 1 as const,
    ios: {
      targets: [
        Target.notificationService({ name: 'Notify', bundleIdentifier: '.notify' }),
        Target.share({ name: 'Share' }),
      ],
      pods: [Pod.git('UAEPass', 'https://example.com/uae.git', { tag: '1.2.3' })],
      packages: [
        Package.remote(
          'https://github.com/apple/swift-collections',
          SwiftPackageRequirement.exact('1.1.4'),
          ['Collections'],
        ),
      ],
      schemes: [Scheme.debug('Development', { archive: 'Release' })],
      runScripts: [RunScript.onInstall('Upload dSYMs', './upload.sh')],
      buildSettings: XcodeBuildSettings.of({ ldExportSymbols: false, swiftVersion: '5.9' }),
      podBuildSettings: [
        PodBuildSettings.forTarget('livekit-react-native', {
          CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES: 'YES',
        }),
      ],
      podfile: { replace: [ReplaceRule.literal('../node_modules/x', '/abs/x')] },
    },
    android: {
      abiFilters: [Abi.arm64],
      permissions: [AndroidPermission.camera],
      features: [AndroidFeature.optional(AndroidHardware.camera)],
      applicationAttributes: AndroidApplication.attributes({ largeHeap: true, allowBackup: false }),
      components: [
        AndroidComponent.remove('receiver', 'androidx.profileinstaller.ProfileInstallReceiver'),
      ],
      dependencies: [
        AndroidDependency.project('watermelondb-jsi'),
        AndroidDependency.bom('a:b:1.0'),
      ],
      modules: [AndroidModule.at('watermelondb-jsi', 'node_modules/x/native/android-jsi')],
      mavenRepositories: [
        MavenRepository.private('https://repo.example.com', 'REPO_USER', 'REPO_TOKEN'),
      ],
      buildConfigFields: [BuildConfigField.string('CHANNEL', 'preview')],
    },
  };

  const parsed = WorkspaceSchema.safeParse(config);
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));

  // Booleans become Xcode's YES/NO, and a String BuildConfig field arrives quoted.
  assert.deepEqual(config.ios.buildSettings, { LD_EXPORT_SYMBOLS: 'NO', SWIFT_VERSION: '5.9' });
  assert.deepEqual(config.android.applicationAttributes, {
    'android:largeHeap': 'true',
    'android:allowBackup': 'false',
  });
  assert.equal(config.android.buildConfigFields[0].value, '"preview"');

  // A factory value is just a literal: both authoring styles are interchangeable.
  assert.deepEqual(Target.share({ name: 'Share' }), { name: 'Share', type: 'share' });
  assert.deepEqual(AndroidDependency.library('a:b:1.0'), {
    module: 'a:b:1.0',
    configuration: 'implementation',
  });
  // An escaped literal rule matches the text, not a pattern.
  assert.match(
    'x/../node_modules/x',
    new RegExp(ReplaceRule.literal('../node_modules/x', '/abs').find),
  );
  assert.equal(ReplaceRule.literal('a.b', 'c').required, true);
});
