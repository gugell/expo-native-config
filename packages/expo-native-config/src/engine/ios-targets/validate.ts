import { ERR } from '../core';

import type { TargetSpec, TargetType } from './types';

const TARGET_TYPES = new Set<TargetType>(['share', 'widget', 'clip']);
const INVALID_PATH_SEGMENT = /[\\/:*?"<>|]/;

function isAbsolute(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:/.test(value);
}

export const DEFAULT_TARGETS_ROOT = './targets';

export function cleanTargetsRoot(targetsRoot: string | undefined): string {
  const root = (targetsRoot ?? DEFAULT_TARGETS_ROOT).trim() || DEFAULT_TARGETS_ROOT;
  return root.replace(/^\.\//, '').replace(/\/+$/, '');
}

export function normalizeTargets(targets: TargetSpec[] | undefined): TargetSpec[] {
  if (!Array.isArray(targets) || targets.length === 0) {
    return [];
  }
  const seen = new Set<string>();

  return targets.map((target, index) => {
    if (!target?.name?.trim()) {
      throw new Error(`${ERR} targets[${index}] requires a non-empty "name".`);
    }
    const name = target.name.trim();
    if (INVALID_PATH_SEGMENT.test(name)) {
      throw new Error(`${ERR} targets[${index}].name contains invalid path characters: "${name}"`);
    }
    if (seen.has(name)) {
      throw new Error(`${ERR} Duplicate target name "${name}" in targets configuration.`);
    }
    seen.add(name);

    if (!target.type || !TARGET_TYPES.has(target.type)) {
      throw new Error(
        `${ERR} targets[${index}].type must be one of ${[...TARGET_TYPES].join(', ')} (received "${target.type}").`,
      );
    }
    if (target.bundleIdentifier !== undefined && !target.bundleIdentifier.trim()) {
      throw new Error(`${ERR} targets[${index}].bundleIdentifier cannot be empty when provided.`);
    }
    if (target.source !== undefined) {
      const source = target.source.trim();
      if (!source) {
        throw new Error(`${ERR} targets[${index}].source cannot be empty when provided.`);
      }
      if (isAbsolute(source)) {
        throw new Error(
          `${ERR} targets[${index}].source must be relative to the app root: "${source}"`,
        );
      }
    }
    if (target.entitlements !== undefined && typeof target.entitlements !== 'object') {
      throw new Error(`${ERR} targets[${index}].entitlements must be an object.`);
    }
    if (target.buildSettings !== undefined) {
      if (typeof target.buildSettings !== 'object') {
        throw new Error(`${ERR} targets[${index}].buildSettings must be an object.`);
      }
      for (const [key, value] of Object.entries(target.buildSettings)) {
        if (typeof value !== 'string') {
          throw new Error(`${ERR} targets[${index}].buildSettings["${key}"] must be a string.`);
        }
      }
    }
    if (target.pods !== undefined) {
      if (!Array.isArray(target.pods)) {
        throw new Error(`${ERR} targets[${index}].pods must be an array.`);
      }
      target.pods.forEach((entry, podIdx) => {
        const label = `targets[${index}].pods[${podIdx}]`;
        if (!entry || typeof entry !== 'object') {
          throw new Error(`${ERR} ${label} must be an object.`);
        }
        if (!entry.pod || typeof entry.pod !== 'string' || !entry.pod.trim()) {
          throw new Error(`${ERR} ${label} requires a non-empty "pod" name.`);
        }
        if (entry.path !== undefined && (typeof entry.path !== 'string' || !entry.path.trim())) {
          throw new Error(`${ERR} ${label}.path must be a non-empty string when provided.`);
        }
        if (entry.configurations !== undefined && !Array.isArray(entry.configurations)) {
          throw new Error(`${ERR} ${label}.configurations must be an array of strings.`);
        }
      });
    }
    return { ...target, name };
  });
}
