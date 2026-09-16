import type { WorkspaceAppConfig } from '../core';

import type { TargetSpec } from './types';

export function sanitizeBundleIdentifier(value: string): string {
  return value.replace(/(^[^a-zA-Z.-]|[^a-zA-Z0-9-.])/g, '-');
}

export function getMainBundleId(config: WorkspaceAppConfig): string {
  const id = config.ios?.bundleIdentifier;
  if (!id) {
    throw new Error(
      '[expo-native-workspace] ios.bundleIdentifier is required to derive target bundle identifiers.',
    );
  }
  return id;
}

/** Resolves a target's full bundle identifier (mirrors @bacons/apple-targets). */
export function resolveTargetBundleId(config: WorkspaceAppConfig, target: TargetSpec): string {
  const mainBundleId = getMainBundleId(config);
  if (target.bundleIdentifier?.startsWith('.')) {
    return mainBundleId + target.bundleIdentifier;
  }
  if (target.bundleIdentifier) {
    return target.bundleIdentifier;
  }
  if (target.type === 'clip') {
    return `${mainBundleId}.clip`;
  }
  return `${mainBundleId}.${sanitizeBundleIdentifier(target.type)}`;
}
