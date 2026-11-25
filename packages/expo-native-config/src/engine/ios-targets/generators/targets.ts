import fs from 'fs';
import path from 'path';
import type {
  AppendOnceOp,
  Generator,
  MergeBlockOp,
  Op,
  WorkspaceAppConfig,
  WriteFileOp,
} from '../../core';
import { rubyLiteral, withMeta } from '../../core';
import { pbxOp } from '../../ios-xcode';

import { resolveTargetBundleId } from '../bundleId';
import { addEASAppExtension } from '../easCredentials';
import { buildEntitlements, resolveEntitlements } from '../entitlements';
import { CONFIG_NAMES } from '../discover';
import { applyTargetsPbx } from '../generateTarget';
import type { TargetPlan } from '../generateTarget';
import { buildInfoPlist } from '../infoPlist';
import { TARGETS_LOADER_MARKER, buildTargetsPodfileLoader } from '../podsLoader';
import {
  defaultDeploymentTargetForType,
  getFrameworksForType,
  needsEmbeddedSwift,
  productTypeForType,
} from '../registry';
import type { TargetPod, TargetSpec } from '../types';
import { cleanTargetsRoot, normalizeTargets } from '../validate';

const DEFAULT_DEPLOYMENT_TARGET = '18.0';
const APP_GROUPS_KEY = 'com.apple.security.application-groups';

/** Renders a single `pod …` line (2-space-indented) for a target's pods block. */
function targetPodLine(pod: TargetPod): string {
  const parts = [`pod ${rubyLiteral(pod.pod)}`];
  if (pod.path) {
    parts.push(`:path => ${rubyLiteral(pod.path)}`);
  } else if (pod.version) {
    parts.push(rubyLiteral(pod.version));
  }
  if (pod.git) parts.push(`:git => ${rubyLiteral(pod.git)}`);
  if (pod.branch) parts.push(`:branch => ${rubyLiteral(pod.branch)}`);
  if (pod.tag) parts.push(`:tag => ${rubyLiteral(pod.tag)}`);
  if (pod.commit) parts.push(`:commit => ${rubyLiteral(pod.commit)}`);
  if (pod.configurations?.length) {
    const cfgs = pod.configurations.map((c) => rubyLiteral(c)).join(', ');
    parts.push(`:configurations => [${cfgs}]`);
  }
  if (pod.modularHeaders != null) parts.push(`:modular_headers => ${pod.modularHeaders}`);
  return `  ${parts.join(', ')}`;
}

// A top-level extension target does not inherit the app target's linkage, so it
// repeats Expo's template lines: static frameworks from expo-build-properties
// would otherwise fail to link the extension's pods.
const EXPO_FRAMEWORK_LINKAGE = [
  "  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']",
  "  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']",
];

export function buildTargetPodsBlock(name: string, pods: TargetPod[]): string {
  const lines = [...EXPO_FRAMEWORK_LINKAGE, ...pods.map(targetPodLine)];
  return `target ${rubyLiteral(name)} do\n${lines.join('\n')}\nend`;
}

function sanitizeProductName(name: string): string {
  return name
    .replace(/[\W_]+/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function isExtensionProductType(productType: string): boolean {
  return productType.includes('app-extension') || productType.includes('extensionkit-extension');
}

/** The product's file type, which Xcode uses to decide how the bundle is built and embedded. */
function explicitFileTypeFor(productType: string): string {
  if (productType.includes('extensionkit-extension')) return 'wrapper.extensionkit-extension';
  if (productType.includes('app-extension')) return 'wrapper.app-extension';
  return 'wrapper.application';
}

function findFile(dir: string, predicate: (name: string) => boolean): string | undefined {
  if (!fs.existsSync(dir)) {
    return undefined;
  }
  return fs.readdirSync(dir).find(predicate);
}

interface ResolvedTarget {
  spec: TargetSpec;
  sourceRel: string;
  plan: TargetPlan;
  entitlementsJson?: Record<string, unknown>;
  /** Where the generated Info.plist and entitlements are written: base + dir. */
  generated: { base: 'ios' | 'project'; dir: string; fromIos: string };
  entitlementsFileName?: string;
  /** False when a foreign target ships its own Info.plist, which is used as it is. */
  writesInfoPlist: boolean;
}

function resolveTargets(
  config: WorkspaceAppConfig,
  projectRoot: string,
  manifest: unknown,
): {
  targetsRootClean: string;
  resolved: ResolvedTarget[];
} {
  const slice = manifest as { targets?: TargetSpec[]; targetsRoot?: string };
  const targets = normalizeTargets(slice.targets);
  const targetsRootClean = cleanTargetsRoot(slice.targetsRoot);

  const resolved = targets.map((spec): ResolvedTarget => {
    const sourceRel = spec.source ?? `${targetsRootClean}/${spec.name}`;
    const sourceAbs = path.join(projectRoot, sourceRel);
    const cwd = `../${sourceRel}`;

    const productType = productTypeForType(spec.type);
    const isExtension = isExtensionProductType(productType);

    const entitlementsJson = resolveEntitlements(config, spec);
    // A target the app owns (under its targets root, or another folder of the app)
    // keeps its generated Info.plist and entitlements next to its source. One linked
    // from a package or a folder outside the app must not be written to: in a real
    // install it is node_modules, and a folder shared by two apps would get each
    // app's entitlements in turn. Those files go to ios/<product name>/ instead.
    const productName = sanitizeProductName(spec.name);
    const fromApp = path.relative(projectRoot, sourceAbs);
    const foreign =
      fromApp.startsWith('..') ||
      path.isAbsolute(fromApp) ||
      fromApp.split(path.sep).includes('node_modules');
    const generated = foreign
      ? { base: 'ios' as const, dir: productName, fromIos: productName }
      : { base: 'project' as const, dir: sourceRel, fromIos: cwd };
    const shipsInfoPlist = fs.existsSync(path.join(sourceAbs, 'Info.plist'));
    const infoPlistPath =
      foreign && shipsInfoPlist ? `${cwd}/Info.plist` : `${generated.fromIos}/Info.plist`;
    const entitlementsFileName = entitlementsJson
      ? foreign
        ? 'generated.entitlements'
        : (findFile(sourceAbs, (name) => name.endsWith('.entitlements')) ??
          'generated.entitlements')
      : undefined;
    const hasAppGroups = Array.isArray((entitlementsJson ?? {})[APP_GROUPS_KEY])
      ? ((entitlementsJson ?? {})[APP_GROUPS_KEY] as unknown[]).length > 0
      : false;

    // The synchronized group bundles every file it finds as a resource. The
    // target's own declaration, and the package.json that makes a package (or
    // a package subpath) resolvable, are not the extension's resources.
    const declarationFiles = fs.existsSync(sourceAbs)
      ? fs
          .readdirSync(sourceAbs)
          .filter((name) => CONFIG_NAMES.includes(name) || name === 'package.json')
      : [];
    const membershipExceptions = ['Info.plist', ...declarationFiles].sort();

    const plan: TargetPlan = {
      type: spec.type,
      name: spec.name,
      productName,
      productType,
      explicitFileType: explicitFileTypeFor(productType),
      isExtension,
      bundleId: resolveTargetBundleId(config, spec),
      deploymentTarget:
        spec.deploymentTarget ??
        defaultDeploymentTargetForType(spec.type) ??
        DEFAULT_DEPLOYMENT_TARGET,
      cwd,
      currentProjectVersion: config.ios?.buildNumber || 1,
      needsEmbeddedSwift: needsEmbeddedSwift(spec.type),
      frameworks: getFrameworksForType(spec.type, spec.frameworks ?? []),
      infoPlistPath,
      entitlementsPath: entitlementsFileName
        ? `${generated.fromIos}/${entitlementsFileName}`
        : undefined,
      hasAppGroups,
      membershipExceptions,
      buildSettings: spec.buildSettings,
    };

    return {
      spec,
      sourceRel,
      plan,
      entitlementsJson,
      generated,
      entitlementsFileName,
      writesInfoPlist: !(foreign && shipsInfoPlist),
    };
  });

  return { targetsRootClean, resolved };
}

export const targetsGenerator: Generator = {
  name: 'targets',

  contributeConfig(config, ctx) {
    const { resolved } = resolveTargets(config, ctx.projectRoot, ctx.manifest);
    for (const { plan, entitlementsJson } of resolved) {
      addEASAppExtension(config, {
        bundleIdentifier: plan.bundleId,
        targetName: plan.productName,
        entitlements: entitlementsJson,
      });
    }
    return config;
  },

  generate({ config, projectRoot, manifest }) {
    const { targetsRootClean, resolved } = resolveTargets(config, projectRoot, manifest);
    if (resolved.length === 0) {
      return { ops: [] };
    }

    const ops: Op[] = [];

    resolved.forEach(
      ({ spec, entitlementsJson, generated, entitlementsFileName, writesInfoPlist }, index) => {
        const source = `ios.targets[${index}]`;
        if (writesInfoPlist)
          ops.push(
            withMeta(
              {
                kind: 'writeFile',
                base: generated.base,
                path: `${generated.dir}/Info.plist`,
                contents: buildInfoPlist(spec.type),
                overwrite: 'ifAbsent',
                label: `target:${spec.name}:Info.plist`,
              } satisfies WriteFileOp,
              {
                id: `target:${spec.name}:infoPlist`,
                platform: 'ios',
                semanticKind: 'ios.target.infoPlist.write',
                source,
                status: 'add',
                files: [`${generated.base === 'ios' ? 'ios/' : ''}${generated.dir}/Info.plist`],
                desired: { type: spec.type },
              },
            ),
          );
        if (entitlementsJson && entitlementsFileName) {
          ops.push(
            withMeta(
              {
                kind: 'writeFile',
                base: generated.base,
                path: `${generated.dir}/${entitlementsFileName}`,
                contents: buildEntitlements(entitlementsJson),
                overwrite: 'always',
                label: `target:${spec.name}:entitlements`,
              } satisfies WriteFileOp,
              {
                id: `target:${spec.name}:entitlements`,
                platform: 'ios',
                semanticKind: 'ios.entitlement.set',
                source,
                status: 'add',
                files: [
                  `${generated.base === 'ios' ? 'ios/' : ''}${generated.dir}/${entitlementsFileName}`,
                ],
                desired: entitlementsJson,
              },
            ),
          );
        }
      },
    );

    // Stable top-level anchor keeps extension pods outside the main app target.
    ops.push(
      withMeta(
        {
          kind: 'appendOnce',
          base: 'ios',
          path: 'Podfile',
          marker: TARGETS_LOADER_MARKER,
          contents: buildTargetsPodfileLoader(targetsRootClean),
          label: 'targetsPodfileLoader',
        } satisfies AppendOnceOp,
        {
          id: 'target:podfileLoader',
          platform: 'ios',
          semanticKind: 'ios.pod.loader.add',
          source: 'ios.targets',
          status: 'add',
          files: ['ios/Podfile'],
        },
      ),
    );

    // Per-target pod blocks declared in the manifest → tagged, idempotent
    // `target '<name>' do … end` mergeBlocks. Anchored on the loader marker (we
    // emit it above), which is guaranteed to live at **top level** (after the
    // main target's `end`). Anchoring on `post_install` is unsafe — in the Expo
    // template `post_install` lives INSIDE the main target, which would nest our
    // block and cause CocoaPods to inherit the main app's full pod graph
    // (Expo modules, RN, Hermes, …) into the extension.
    resolved.forEach(({ spec }, index) => {
      if (!spec.pods?.length) return;
      ops.push(
        withMeta(
          {
            kind: 'mergeBlock',
            base: 'ios',
            path: 'Podfile',
            tag: `expo-native-config-target-pods-${spec.name}`,
            newSrc: buildTargetPodsBlock(spec.name, spec.pods),
            anchor: new RegExp(TARGETS_LOADER_MARKER),
            offset: 0,
            comment: '#',
            label: `target:${spec.name}:pods`,
          } satisfies MergeBlockOp,
          {
            id: `target:${spec.name}:pods`,
            platform: 'ios',
            semanticKind: 'ios.pod.add',
            source: `ios.targets[${index}].pods`,
            status: 'add',
            files: ['ios/Podfile'],
            desired: spec.pods,
          },
        ),
      );
    });

    // One pbx op creates all targets then syncs team id + marketing version.
    const plans = resolved.map((r) => r.plan);
    const teamId = config.ios?.appleTeamId;
    const marketingVersion = config.ios?.version || config.version || '1.0.0';
    ops.push(
      pbxOp(
        'targets',
        ({ project }) => {
          applyTargetsPbx(project, plans, { teamId, marketingVersion });
        },
        {
          id: 'target:all',
          platform: 'ios',
          semanticKind: 'ios.target.add',
          source: 'ios.targets',
          status: 'add',
          files: ['ios/*.xcodeproj/project.pbxproj'],
          desired: resolved.map(({ spec, plan }, index) => ({
            source: `ios.targets[${index}]`,
            name: spec.name,
            type: spec.type,
            bundleIdentifier: plan.bundleId,
            deploymentTarget: plan.deploymentTarget,
          })),
          phase: 'finalized',
        },
      ),
    );

    return { ops };
  },
};
