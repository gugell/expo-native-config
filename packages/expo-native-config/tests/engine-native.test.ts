import assert from 'node:assert/strict';
import test from 'node:test';
import plist from '@expo/plist';
import {
  XcodeProject,
  PBXCopyFilesBuildPhase,
  PBXFileReference,
  PBXNativeTarget,
  XCRemoteSwiftPackageReference,
} from '@bacons/xcode';
import { applyTargetsPbx, type TargetPlan } from '../src/engine/ios-targets/generateTarget';
import { spmGenerator } from '../src/engine/ios-spm/generators/spm';
import type { PbxOp } from '../src/engine/ios-xcode/pbxOp';
import {
  buildTargetPodsBlock,
  targetsGenerator,
} from '../src/engine/ios-targets/generators/targets';
import type { WriteFileOp } from '../src/engine/core/types';

function project() {
  return new XcodeProject('/tmp/App.xcodeproj/project.pbxproj', {
    rootObject: 'ROOT',
    objects: {
      ROOT: {
        isa: 'PBXProject',
        mainGroup: 'GROUP',
        targets: ['APP'],
        buildConfigurationList: 'CONFIGS',
        attributes: {},
      },
      GROUP: { isa: 'PBXGroup', children: [], sourceTree: '<group>' },
      CONFIGS: {
        isa: 'XCConfigurationList',
        buildConfigurations: ['DEBUG', 'RELEASE'],
        defaultConfigurationName: 'Release',
      },
      DEBUG: { isa: 'XCBuildConfiguration', name: 'Debug', buildSettings: { SDKROOT: 'iphoneos' } },
      RELEASE: {
        isa: 'XCBuildConfiguration',
        name: 'Release',
        buildSettings: { SDKROOT: 'iphoneos' },
      },
      APP: {
        isa: 'PBXNativeTarget',
        name: 'App',
        productType: 'com.apple.product-type.application',
        buildConfigurationList: 'CONFIGS',
        buildPhases: [],
        dependencies: [],
      },
    },
  } as unknown as ConstructorParameters<typeof XcodeProject>[1]);
}
const target: TargetPlan = {
  type: 'share',
  name: 'ShareExtension',
  productName: 'ShareExtension',
  productType: 'com.apple.product-type.app-extension',
  explicitFileType: 'wrapper.app-extension',
  isExtension: true,
  bundleId: 'com.example.app.share',
  deploymentTarget: '18.0',
  cwd: '../custom/share-source',
  currentProjectVersion: 1,
  needsEmbeddedSwift: true,
  frameworks: ['UIKit'],
  hasAppGroups: false,
  membershipExceptions: ['Info.plist'],
};

test('target application is idempotent and respects custom source directories', () => {
  const native = project();
  applyTargetsPbx(native, [target], { marketingVersion: '1.0' });
  const initial = JSON.stringify(native.toJSON());
  applyTargetsPbx(native, [target], { marketingVersion: '1.0' });
  assert.equal(JSON.stringify(native.toJSON()), initial);
  const extension = native.rootObject.props.targets.find(
    (item) => item.props.name === target.name,
  ) as PBXNativeTarget;
  assert.equal(extension.props.fileSystemSynchronizedGroups![0].props.path, target.cwd);
  assert.equal(extension.props.fileSystemSynchronizedGroups![0].props.sourceTree, 'SOURCE_ROOT');
});

test('SPM references and linked products are idempotent and versions update', () => {
  const native = project();
  const manifest = {
    manifestVersion: 1 as const,
    swiftPackages: {
      remote: [
        {
          url: 'https://github.com/example/package',
          requirement: { kind: 'exactVersion', version: '1.0.0' },
          products: ['Example'],
        },
      ],
    },
  };
  const ctx = { manifest, config: {}, projectRoot: '/tmp', configPath: '/tmp/workspace.config.ts' };
  const op = spmGenerator.generate(ctx).ops[0] as PbxOp;
  op.apply({ project: native, projectRoot: '/tmp', platformProjectRoot: '/tmp/ios' });
  const initial = JSON.stringify(native.toJSON());
  op.apply({ project: native, projectRoot: '/tmp', platformProjectRoot: '/tmp/ios' });
  assert.equal(JSON.stringify(native.toJSON()), initial);
  manifest.swiftPackages.remote[0].requirement.version = '2.0.0';
  (spmGenerator.generate(ctx).ops[0] as PbxOp).apply({
    project: native,
    projectRoot: '/tmp',
    platformProjectRoot: '/tmp/ios',
  });
  assert.equal(
    (
      (native.rootObject.props.packageReferences![0] as XCRemoteSwiftPackageReference).props
        .requirement as { version: string }
    ).version,
    '2.0.0',
  );
});

test('share defaults advertise text and URLs with a concrete activation rule', async () => {
  const { getTargetInfoPlist } = await import('../src/engine/ios-targets/infoPlist');
  const extension = getTargetInfoPlist('share').NSExtension as {
    NSExtensionAttributes: { NSExtensionActivationRule: unknown };
  };
  assert.deepEqual(extension.NSExtensionAttributes.NSExtensionActivationRule, {
    NSExtensionActivationSupportsText: true,
    NSExtensionActivationSupportsWebURLWithMaxCount: 1,
  });
});

test('local Swift package pod linkage resolves relative to ios/Pods', () => {
  const result = spmGenerator.generate({
    manifest: {
      manifestVersion: 1,
      swiftPackages: {
        local: [{ path: '../packages/Shared', products: ['Shared'], podTarget: 'Consumer' }],
      },
    },
    config: {},
    projectRoot: '/tmp/app',
    configPath: '/tmp/app/workspace.config.ts',
  });
  const op = result.ops[0] as import('../src/engine/core/types').MergeBlockOp;
  assert.ok(op.newSrc.includes("ref.relative_path = '../../packages/Shared'"));
});

test('extension pod blocks repeat Expo framework linkage, which top-level targets do not inherit', () => {
  const block = buildTargetPodsBlock('Notifications', [
    { pod: 'OneSignalXCFramework', version: '5.8.0' },
  ]);
  // Without these, `ios.useFrameworks: static` leaves the extension's pods unlinked.
  assert.equal(
    block,
    [
      "target 'Notifications' do",
      "  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']",
      "  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']",
      "  pod 'OneSignalXCFramework', '5.8.0'",
      'end',
    ].join('\n'),
  );
});

/** Plans targets through the generator, as prebuild does, and applies the pbx op to `native`. */
function generateTargets(native: XcodeProject, targets: unknown[], config: object = {}) {
  const result = targetsGenerator.generate({
    manifest: { manifestVersion: 1, targets } as never,
    config: { ios: { bundleIdentifier: 'com.example.app' }, ...config } as never,
    projectRoot: '/tmp/app',
    configPath: '/tmp/app/workspace.config.ts',
  });
  const pbx = result.ops.find((op) => op.kind === 'pbx') as PbxOp;
  pbx.apply({ project: native, projectRoot: '/tmp/app', platformProjectRoot: '/tmp/app/ios' });
  return result.ops;
}

function copyPhases(native: XcodeProject): PBXCopyFilesBuildPhase[] {
  const app = native.rootObject.getMainAppTarget('ios')!;
  return app.props.buildPhases.filter((phase) =>
    PBXCopyFilesBuildPhase.is(phase),
  ) as PBXCopyFilesBuildPhase[];
}

test('a background-download target is an ExtensionKit extension embedded under Extensions/', () => {
  const native = project();
  const ops = generateTargets(native, [{ name: 'AssetDownloader', type: 'background-download' }]);

  const extension = native.rootObject.props.targets.find(
    (item) => item.props.name === 'AssetDownloader',
  ) as PBXNativeTarget;
  assert.equal(extension.props.productType, 'com.apple.product-type.extensionkit-extension');
  const product = extension.props.productReference as PBXFileReference;
  assert.equal(product.props.explicitFileType, 'wrapper.extensionkit-extension');
  assert.equal(product.props.path, 'AssetDownloader.appex');
  assert.equal(product.props.sourceTree, 'BUILT_PRODUCTS_DIR');

  // Embedded by the ExtensionKit phase (Extensions/), never PlugIns/ (13).
  const phases = copyPhases(native);
  const embed = phases.find((phase) => phase.props.name === 'Embed ExtensionKit Extensions');
  assert.ok(embed, 'the host app gets an "Embed ExtensionKit Extensions" phase');
  assert.equal(embed.props.dstSubfolderSpec, 16);
  assert.equal(embed.props.dstPath, '$(EXTENSIONS_FOLDER_PATH)');
  assert.ok(embed.props.files.some((file) => file.props.fileRef?.uuid === product.uuid));
  assert.equal(
    phases.some((phase) => phase.props.name === 'Embed Foundation Extensions'),
    false,
  );

  const settings = extension.props.buildConfigurationList.props.buildConfigurations.map(
    (config) => config.props.buildSettings as Record<string, unknown>,
  );
  for (const buildSettings of settings) {
    assert.equal(buildSettings.IPHONEOS_DEPLOYMENT_TARGET, '26.0');
    // Like every type without an explicit identifier: <app>.<type>.
    assert.equal(buildSettings.PRODUCT_BUNDLE_IDENTIFIER, 'com.example.app.background-download');
    assert.deepEqual(buildSettings.LD_RUNPATH_SEARCH_PATHS, [
      '$(inherited)',
      '@executable_path/Frameworks',
      '@executable_path/../../Frameworks',
    ]);
  }
  const linked = extension
    .getFrameworksBuildPhase()
    .props.files.map((file) => (file.props.fileRef as PBXFileReference).props.name);
  assert.deepEqual(linked, ['BackgroundAssets.framework', 'StoreKit.framework']);

  const infoPlist = ops.find(
    (op) => op.kind === 'writeFile' && op.path === 'targets/AssetDownloader/Info.plist',
  ) as WriteFileOp;
  assert.deepEqual(JSON.parse(JSON.stringify(plist.parse(infoPlist.contents))), {
    EXAppExtensionAttributes: {
      EXExtensionPointIdentifier: 'com.apple.background-asset-downloader-extension',
    },
  });
  assert.doesNotMatch(infoPlist.contents, /NSExtension/);
});

test('app extensions keep the Foundation phase beside an ExtensionKit one', () => {
  const native = project();
  generateTargets(native, [
    { name: 'Share', type: 'share' },
    { name: 'AssetDownloader', type: 'background-download', deploymentTarget: '26.1' },
  ]);
  const share = native.rootObject.props.targets.find((item) => item.props.name === 'Share')!;
  assert.equal(
    ((share as PBXNativeTarget).props.productReference as PBXFileReference).props.explicitFileType,
    'wrapper.app-extension',
  );
  const byName = new Map(copyPhases(native).map((phase) => [phase.props.name, phase]));
  assert.equal(byName.get('Embed Foundation Extensions')?.props.dstSubfolderSpec, 13);
  assert.equal(byName.get('Embed ExtensionKit Extensions')?.props.dstSubfolderSpec, 16);
  assert.equal(byName.get('Embed Foundation Extensions')?.props.files.length, 1);
  assert.equal(byName.get('Embed ExtensionKit Extensions')?.props.files.length, 1);

  const downloader = native.rootObject.props.targets.find(
    (item) => item.props.name === 'AssetDownloader',
  ) as PBXNativeTarget;
  // An explicit deployment target still wins over the type default.
  assert.equal(downloader.getDefaultBuildSetting('IPHONEOS_DEPLOYMENT_TARGET'), '26.1');

  // Applying again changes nothing: the phase is found, not duplicated.
  const initial = JSON.stringify(native.toJSON());
  generateTargets(native, [
    { name: 'Share', type: 'share' },
    { name: 'AssetDownloader', type: 'background-download', deploymentTarget: '26.1' },
  ]);
  assert.equal(JSON.stringify(native.toJSON()), initial);
});

test('a background-download target inherits the host app groups', () => {
  const native = project();
  const ops = generateTargets(native, [{ name: 'AssetDownloader', type: 'background-download' }], {
    ios: {
      bundleIdentifier: 'com.example.app',
      entitlements: { 'com.apple.security.application-groups': ['group.com.example.app'] },
    },
  });
  const entitlements = ops.find(
    (op) => op.kind === 'writeFile' && op.path.endsWith('generated.entitlements'),
  ) as WriteFileOp;
  assert.deepEqual(
    { ...plist.parse(entitlements.contents) },
    { 'com.apple.security.application-groups': ['group.com.example.app'] },
  );
});
