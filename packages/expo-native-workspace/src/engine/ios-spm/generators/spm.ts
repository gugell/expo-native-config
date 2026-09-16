import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  PBXBuildFile,
  PBXNativeTarget,
  XCLocalSwiftPackageReference,
  XCRemoteSwiftPackageReference,
  XCSwiftPackageProductDependency,
  XcodeProject,
} from '@bacons/xcode';
import type { Generator, MergeBlockOp, Op } from '../../core';
import { withMeta } from '../../core';
import { pbxOp } from '../../ios-xcode';

import type { SpmLocalPackage, SpmRemotePackage, SwiftPackageRequirement } from '../types';
import { normalizeLocalPackages, normalizeRemotePackages, normalizeTargetRef } from '../validate';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── shared helpers ──────────────────────────────────────────────────────────

function findTarget(project: XcodeProject, name?: string): PBXNativeTarget {
  if (name) {
    const match = project.rootObject.props.targets.find(
      (t) => PBXNativeTarget.is(t) && (t.props as any).name === name,
    );
    if (!match) {
      throw new Error(`[expo-native-workspace] swiftPackages: target "${name}" not found.`);
    }
    return match as PBXNativeTarget;
  }
  const app = project.rootObject.getMainAppTarget('ios');
  if (!app) {
    throw new Error('[expo-native-workspace] swiftPackages: no main app target found.');
  }
  return app;
}

function addPackageReference(project: XcodeProject, ref: { uuid: string }): void {
  const root = project.rootObject.props as any;
  root.packageReferences = root.packageReferences ?? [];
  root.packageReferences.push(ref);
}

function linkProductsToTarget(
  project: XcodeProject,
  pkgRef: any,
  products: string[],
  targetName: string | undefined,
): void {
  const target = findTarget(project, targetName);
  const targetProps = target.props as any;
  targetProps.packageProductDependencies = targetProps.packageProductDependencies ?? [];

  for (const productName of products) {
    const existing = targetProps.packageProductDependencies.find(
      (dependency: any) =>
        dependency.props.productName === productName &&
        dependency.props.package?.uuid === pkgRef.uuid,
    );
    if (existing) continue;
    const dependency = XCSwiftPackageProductDependency.create(project, {
      package: pkgRef,
      productName,
    } as any);
    targetProps.packageProductDependencies.push(dependency);

    const buildFile = PBXBuildFile.create(project, { productRef: dependency } as any);
    (target.getFrameworksBuildPhase().props.files as any).push(buildFile);
  }
}

function linkProducts(
  project: XcodeProject,
  pkgRef: any,
  products: string[],
  targets: readonly string[] | undefined,
): void {
  if (!targets || targets.length === 0) {
    linkProductsToTarget(project, pkgRef, products, undefined);
    return;
  }
  for (const targetName of targets) {
    linkProductsToTarget(project, pkgRef, products, targetName);
  }
}

// ─── Podfile post_install code generation for pod-target SPM linkage ────────

const POD_TARGET_ANCHOR = /post_install do \|installer\|/;

const rubyString = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const rubyArray = (values: readonly string[]): string => `[${values.map(rubyString).join(', ')}]`;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rubyRequirement(req: SwiftPackageRequirement): string {
  // Xcodeproj uses a Hash with snake_case keys for requirement (e.g.
  // {"kind"=>"upToNextMajorVersion", "minimumVersion"=>"1.0.0"} matches the
  // serialized pbxproj layout).
  const entries = Object.entries(req).map(
    ([k, v]) => `${rubyString(k)} => ${rubyString(String(v))}`,
  );
  return `{ ${entries.join(', ')} }`;
}

interface PodTargetSpmDescriptor {
  /** Stable tag suffix (last URL/path segment, slugified). */
  slug: string;
  /** Local relative path OR remote URL. */
  identifier: string;
  kind: 'local' | 'remote';
  /** Required for `kind === 'remote'`. */
  requirement?: SwiftPackageRequirement;
  products: readonly string[];
  podTargets: readonly string[];
}

function renderPodTargetSpmRuby(spec: PodTargetSpmDescriptor): string {
  const klass =
    spec.kind === 'local'
      ? 'Xcodeproj::Project::Object::XCLocalSwiftPackageReference'
      : 'Xcodeproj::Project::Object::XCRemoteSwiftPackageReference';
  const prop = spec.kind === 'local' ? 'relative_path' : 'repositoryURL';
  const idLit = rubyString(spec.identifier);

  // The reference's identifying property differs (local: relative_path,
  // remote: repositoryURL). We always set it AND a `name` for clarity in the
  // generated pbxproj. For remote we also set the version requirement.
  const requirementLine =
    spec.kind === 'remote' && spec.requirement
      ? `      ref.requirement = ${rubyRequirement(spec.requirement)}\n`
      : '';

  return [
    `  # SPM → pod target(s): ${spec.identifier}`,
    `  begin`,
    `    spm_pkg_ref = installer.pods_project.root_object.package_references.find do |ref|`,
    `      ref.respond_to?(:${prop}) && ref.${prop} == ${idLit}`,
    `    end`,
    `    spm_pkg_ref ||= begin`,
    `      ref = installer.pods_project.new(${klass})`,
    `      ref.${prop} = ${idLit}`,
    requirementLine.trimEnd(),
    `      installer.pods_project.root_object.package_references << ref`,
    `      ref`,
    `    end`,
    `    ${rubyArray(spec.podTargets)}.each do |target_name|`,
    `      target = installer.pods_project.targets.find { |t| t.name == target_name }`,
    `      next unless target`,
    `      ${rubyArray(spec.products)}.each do |product_name|`,
    `        next if target.package_product_dependencies.any? { |d| d.product_name == product_name }`,
    `        dep = installer.pods_project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)`,
    `        dep.package = spm_pkg_ref`,
    `        dep.product_name = product_name`,
    `        target.package_product_dependencies << dep`,
    `        bf = installer.pods_project.new(Xcodeproj::Project::Object::PBXBuildFile)`,
    `        bf.product_ref = dep`,
    `        target.frameworks_build_phase.files << bf`,
    `      end`,
    `    end`,
    `  end`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function podTargetSpmOp(spec: PodTargetSpmDescriptor): MergeBlockOp {
  return withMeta(
    {
      kind: 'mergeBlock',
      base: 'ios',
      path: 'Podfile',
      tag: `expo-native-workspace-spm-pod-target-${spec.slug}`,
      newSrc: renderPodTargetSpmRuby(spec),
      anchor: POD_TARGET_ANCHOR,
      offset: 1,
      comment: '#',
      label: `swiftPackages:podTarget:${spec.slug}`,
    },
    {
      id: `swiftPackage:podTarget:${spec.slug}`,
      platform: 'ios',
      semanticKind: 'ios.swiftPackage.link',
      source: 'ios.packages',
      status: 'add',
      files: ['ios/Podfile'],
      desired: spec,
    },
  );
}

function lastPathSegment(input: string): string {
  const trimmed = input.replace(/\/+$/, '');
  const segs = trimmed.split('/');
  return segs[segs.length - 1] || trimmed;
}

// ─── generator ───────────────────────────────────────────────────────────────

interface PackageWork<TRef> {
  pkg: TRef;
  targets: readonly string[] | undefined;
  podTargets: readonly string[] | undefined;
  /** True when neither `target` nor `podTarget` was set — default to main app. */
  defaultedToMain: boolean;
}

function resolveWork<T extends SpmRemotePackage | SpmLocalPackage>(
  pkg: T,
  label: string,
): PackageWork<T> {
  const targets = normalizeTargetRef(pkg.target, label);
  const podTargets = normalizeTargetRef(pkg.podTarget, `${label}.podTarget`);
  const defaultedToMain = targets === undefined && podTargets === undefined;
  return { pkg, targets, podTargets, defaultedToMain };
}

export const spmGenerator: Generator = {
  name: 'swiftPackages',
  generate({ manifest }) {
    const slice = (
      manifest as { swiftPackages?: { remote?: SpmRemotePackage[]; local?: SpmLocalPackage[] } }
    ).swiftPackages;
    if (!slice) {
      return { ops: [] };
    }
    const remote = normalizeRemotePackages(slice.remote).map((pkg, i) =>
      resolveWork(pkg, `swiftPackages.remote[${i}]`),
    );
    const local = normalizeLocalPackages(slice.local).map((pkg, i) =>
      resolveWork(pkg, `swiftPackages.local[${i}]`),
    );
    if (remote.length === 0 && local.length === 0) {
      return { ops: [] };
    }

    const ops: Op[] = [];

    // 1) Main project pbxproj work — only emit if any package has main-project
    //    targets (including the legacy "default to main app" path).
    const anyMainProjectWork =
      remote.some((w) => w.targets || w.defaultedToMain) ||
      local.some((w) => w.targets || w.defaultedToMain);

    if (anyMainProjectWork) {
      ops.push(
        pbxOp(
          'swiftPackages',
          ({ project }) => {
            for (const { pkg, targets, defaultedToMain } of remote) {
              if (!targets && !defaultedToMain) continue;
              const existing = (project.rootObject.props.packageReferences ?? []).find(
                (reference: any) => reference.props.repositoryURL === pkg.url,
              );
              const ref =
                existing ??
                XCRemoteSwiftPackageReference.create(project, {
                  repositoryURL: pkg.url,
                  requirement: pkg.requirement,
                } as any);
              if (!existing) addPackageReference(project, ref);
              (ref.props as any).requirement = pkg.requirement;
              linkProducts(project, ref, pkg.products, targets);
            }
            for (const { pkg, targets, defaultedToMain } of local) {
              if (!targets && !defaultedToMain) continue;
              const existing = (project.rootObject.props.packageReferences ?? []).find(
                (reference: any) => reference.props.relativePath === pkg.path,
              );
              const ref =
                existing ??
                XCLocalSwiftPackageReference.create(project, {
                  relativePath: pkg.path,
                } as any);
              if (!existing) addPackageReference(project, ref);
              linkProducts(project, ref, pkg.products, targets);
            }
          },
          {
            id: 'swiftPackage:project',
            platform: 'ios',
            semanticKind: 'ios.swiftPackage.add',
            source: 'ios.packages',
            status: 'add',
            files: ['ios/*.xcodeproj/project.pbxproj'],
            desired: {
              remote: remote.map((w) => w.pkg.url),
              local: local.map((w) => w.pkg.path),
            },
            phase: 'finalized',
          },
        ),
      );
    }

    // 2) Pod-target SPM linkage via Podfile post_install. One tagged block
    //    per package, keyed by a deterministic slug — keeps re-prebuild
    //    idempotent and makes the Podfile self-documenting.
    for (const { pkg, podTargets } of remote) {
      if (!podTargets) continue;
      ops.push(
        podTargetSpmOp({
          slug: `${slugify(lastPathSegment(pkg.url))}-${createHash('sha256').update(pkg.url).digest('hex').slice(0, 10)}`,
          identifier: pkg.url,
          kind: 'remote',
          requirement: pkg.requirement,
          products: pkg.products,
          podTargets,
        }),
      );
    }
    for (const { pkg, podTargets } of local) {
      if (!podTargets) continue;
      ops.push(
        podTargetSpmOp({
          slug: `${slugify(lastPathSegment(pkg.path))}-${createHash('sha256').update(pkg.path).digest('hex').slice(0, 10)}`,
          identifier: path.posix.isAbsolute(pkg.path) ? pkg.path : path.posix.join('..', pkg.path),
          kind: 'local',
          products: pkg.products,
          podTargets,
        }),
      );
    }

    return { ops };
  },
};
