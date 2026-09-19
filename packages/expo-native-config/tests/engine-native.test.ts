import assert from 'node:assert/strict';
import test from 'node:test';
import { XcodeProject, PBXNativeTarget, XCRemoteSwiftPackageReference } from '@bacons/xcode';
import { applyTargetsPbx, type TargetPlan } from '../src/engine/ios-targets/generateTarget';
import { spmGenerator } from '../src/engine/ios-spm/generators/spm';
import type { PbxOp } from '../src/engine/ios-xcode/pbxOp';

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
