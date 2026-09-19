import type { WorkspaceAppConfig } from '../core';

export interface AppExtensionCredential {
  bundleIdentifier: string;
  targetName: string;
  entitlements?: Record<string, unknown>;
}

/**
 * Registers an app-extension target for EAS managed code signing, mirroring
 * @bacons/apple-targets `withEASTargets`: `extra.eas.build.experimental.ios.appExtensions[]`.
 */
export function addEASAppExtension(
  config: WorkspaceAppConfig,
  credential: AppExtensionCredential,
): WorkspaceAppConfig {
  const extra = (config.extra ??= {});
  const eas = ((extra as Record<string, unknown>).eas ??= {}) as Record<string, unknown>;
  const build = ((eas as Record<string, unknown>).build ??= {}) as Record<string, unknown>;
  const experimental = ((build as Record<string, unknown>).experimental ??= {}) as Record<
    string,
    unknown
  >;
  const ios = ((experimental as Record<string, unknown>).ios ??= {}) as Record<string, unknown>;
  const appExtensions = ((ios as Record<string, unknown>).appExtensions ??=
    []) as AppExtensionCredential[];

  const existingIndex = appExtensions.findIndex(
    (ext) => ext.bundleIdentifier === credential.bundleIdentifier,
  );
  if (existingIndex > -1) {
    appExtensions[existingIndex] = credential;
  } else {
    appExtensions.push(credential);
  }
  return config;
}
