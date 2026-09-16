import plist from '@expo/plist';
import type { WorkspaceAppConfig } from '../core';

import type { TargetSpec } from './types';
import { appGroupsByDefault } from './registry';

const APP_GROUPS_KEY = 'com.apple.security.application-groups';

/**
 * Resolves a target's entitlements, mirroring @bacons/apple-targets' default
 * app-group sync: when the type uses app groups by default and none are declared,
 * inherit the main app's groups.
 */
export function resolveEntitlements(
  config: WorkspaceAppConfig,
  target: TargetSpec,
): Record<string, unknown> | undefined {
  const declared = target.entitlements ? { ...target.entitlements } : undefined;
  if (declared && APP_GROUPS_KEY in declared) {
    return declared;
  }
  if (appGroupsByDefault(target.type)) {
    const appGroups = config.ios?.entitlements?.[APP_GROUPS_KEY];
    if (Array.isArray(appGroups) && appGroups.length > 0) {
      return { ...(declared ?? {}), [APP_GROUPS_KEY]: appGroups };
    }
  }
  return declared;
}

export function buildEntitlements(entitlements: Record<string, unknown>): string {
  return plist.build(entitlements as never);
}
