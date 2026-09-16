import { ERR } from '../core';

import type {
  SpmLocalPackage,
  SpmRemotePackage,
  SpmTargetRef,
  SwiftPackageRequirement,
} from './types';

const REQUIREMENT_KINDS = new Set([
  'upToNextMajorVersion',
  'upToNextMinorVersion',
  'versionRange',
  'exactVersion',
  'branch',
  'revision',
]);

function assertRequirement(req: SwiftPackageRequirement | undefined, label: string): void {
  if (
    !req ||
    typeof req !== 'object' ||
    !REQUIREMENT_KINDS.has((req as { kind?: string }).kind ?? '')
  ) {
    throw new Error(
      `${ERR} ${label}.requirement.kind must be one of ${[...REQUIREMENT_KINDS].join(', ')}.`,
    );
  }
}

function assertProducts(products: unknown, label: string): void {
  if (
    !Array.isArray(products) ||
    products.length === 0 ||
    products.some((p) => typeof p !== 'string' || !p.trim())
  ) {
    throw new Error(`${ERR} ${label}.products must be a non-empty array of product names.`);
  }
}

/**
 * Normalizes the optional `target` field on an SPM package entry to a
 * `readonly string[]` so the generator iterates one shape. `undefined` →
 * `undefined` (caller treats as "main app target"). Strings → single-element
 * array. Arrays must be non-empty and contain non-empty strings.
 */
export function normalizeTargetRef(
  target: SpmTargetRef | undefined,
  label: string,
): readonly string[] | undefined {
  if (target === undefined) {
    return undefined;
  }
  if (typeof target === 'string') {
    const trimmed = target.trim();
    if (!trimmed) {
      throw new Error(`${ERR} ${label}.target must be a non-empty string.`);
    }
    return [trimmed];
  }
  if (!Array.isArray(target) || target.length === 0) {
    throw new Error(`${ERR} ${label}.target must be a non-empty string or array of strings.`);
  }
  const normalized: string[] = [];
  for (let i = 0; i < target.length; i += 1) {
    const entry = target[i];
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`${ERR} ${label}.target[${i}] must be a non-empty string.`);
    }
    normalized.push(entry.trim());
  }
  return normalized;
}

export function normalizeRemotePackages(
  packages: SpmRemotePackage[] | undefined,
): SpmRemotePackage[] {
  if (!Array.isArray(packages) || packages.length === 0) {
    return [];
  }
  return packages.map((pkg, index) => {
    const label = `swiftPackages.remote[${index}]`;
    if (!pkg?.url?.trim()) {
      throw new Error(`${ERR} ${label} requires a "url".`);
    }
    assertRequirement(pkg.requirement, label);
    assertProducts(pkg.products, label);
    return {
      ...pkg,
      url: pkg.url.trim(),
      target: normalizeTargetRef(pkg.target, label),
      podTarget: normalizeTargetRef(pkg.podTarget, `${label}.podTarget`),
    };
  });
}

export function normalizeLocalPackages(packages: SpmLocalPackage[] | undefined): SpmLocalPackage[] {
  if (!Array.isArray(packages) || packages.length === 0) {
    return [];
  }
  return packages.map((pkg, index) => {
    const label = `swiftPackages.local[${index}]`;
    if (!pkg?.path?.trim()) {
      throw new Error(`${ERR} ${label} requires a "path".`);
    }
    assertProducts(pkg.products, label);
    return {
      ...pkg,
      path: pkg.path.trim(),
      target: normalizeTargetRef(pkg.target, label),
      podTarget: normalizeTargetRef(pkg.podTarget, `${label}.podTarget`),
    };
  });
}
