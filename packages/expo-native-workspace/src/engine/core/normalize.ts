import { isRecord } from './guards';
import { ERR } from './validation';
import type { RawManifest } from './types';

type Dict = Record<string, unknown>;

function asArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

/**
 * Flatten nested `workspace.config.ts` (`ios` / `android` / `patches`) and the
 * legacy flat `workspace.manifest.js` into the canonical generator-facing
 * RawManifest. Nested fields win when both are present.
 */
export function normalizeWorkspaceConfig(raw: unknown): RawManifest {
  if (!isRecord(raw)) {
    throw new Error(`${ERR} Workspace config must export an object (received ${typeof raw}).`);
  }

  const nestedIos = isRecord(raw.ios) ? raw.ios : undefined;
  const version = raw.schemaVersion ?? raw.manifestVersion ?? 1;
  if (version !== 1) {
    throw new Error(
      `${ERR} Unsupported schemaVersion/manifestVersion: ${String(version)}. Expected 1.`,
    );
  }

  const targets = pick(nestedIos?.targets, raw.targets);
  const targetsRoot = pick(nestedIos?.targetsRoot, raw.targetsRoot);
  const schemes = pick(nestedIos?.schemes, raw.schemes);
  const replaceExpoScheme = pick(nestedIos?.replaceExpoScheme, raw.replaceExpoScheme);
  const fixExtensionEmbedCycle = pick(
    nestedIos?.fixExtensionEmbedCycle,
    raw.fixExtensionEmbedCycle,
  );

  const nestedXcode = isRecord(nestedIos?.xcode) ? nestedIos.xcode : undefined;
  const xcodeEnv = pick(nestedXcode?.env, pick(nestedIos?.xcodeEnv, raw.xcodeEnv));

  const { localPods, remotePods } = splitPods(nestedIos, raw);
  const podBuildSettings = pick(nestedIos?.podBuildSettings, raw.podBuildSettings);
  const removePodBuildPhases = pick(nestedIos?.removePodBuildPhases, raw.removePodBuildPhases);

  const swiftPackages = mergeSwiftPackages(nestedIos, raw);
  const android = pick(raw.android, undefined);
  const patches = pick(raw.patches, undefined);
  const deploymentTarget =
    typeof nestedIos?.deploymentTarget === 'string' ? nestedIos.deploymentTarget : undefined;

  const targetsWithDefault = applyDefaultDeploymentTarget(targets, deploymentTarget);

  const manifest: RawManifest = {
    manifestVersion: 1,
    schemaVersion: 1,
  };

  assign(manifest, 'targets', targetsWithDefault);
  assign(manifest, 'targetsRoot', targetsRoot);
  assign(manifest, 'schemes', schemes);
  assign(manifest, 'replaceExpoScheme', replaceExpoScheme);
  assign(manifest, 'fixExtensionEmbedCycle', fixExtensionEmbedCycle);
  assign(manifest, 'xcodeEnv', xcodeEnv);
  assign(manifest, 'localPods', localPods);
  assign(manifest, 'remotePods', remotePods);
  assign(manifest, 'podBuildSettings', podBuildSettings);
  assign(manifest, 'removePodBuildPhases', removePodBuildPhases);
  assign(manifest, 'swiftPackages', swiftPackages);
  assign(manifest, 'android', android);
  assign(manifest, 'patches', patches);
  assign(manifest, 'iosDeploymentTarget', deploymentTarget);

  return manifest;
}

function pick<T>(nested: T | undefined, flat: T | undefined): T | undefined {
  return nested !== undefined ? nested : flat;
}

function assign(target: RawManifest, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function splitPods(
  nestedIos: Dict | undefined,
  raw: Dict,
): { localPods: unknown; remotePods: unknown } {
  const nestedPods = asArray<Dict>(nestedIos?.pods);
  if (nestedPods) {
    const localPods = nestedPods.filter((pod) => typeof pod.path === 'string' && pod.path);
    const remotePods = nestedPods.filter((pod) => !pod.path);
    return {
      localPods: localPods.length ? localPods : pick(nestedIos?.localPods, raw.localPods),
      remotePods: remotePods.length ? remotePods : pick(nestedIos?.remotePods, raw.remotePods),
    };
  }
  return {
    localPods: pick(nestedIos?.localPods, raw.localPods),
    remotePods: pick(nestedIos?.remotePods, raw.remotePods),
  };
}

function mergeSwiftPackages(nestedIos: Dict | undefined, raw: Dict): unknown {
  const packages = asArray<Dict>(nestedIos?.packages);
  const nestedSlice = isRecord(nestedIos?.swiftPackages) ? nestedIos.swiftPackages : undefined;
  const flatSlice = isRecord(raw.swiftPackages) ? raw.swiftPackages : undefined;
  const base = nestedSlice ?? flatSlice ?? {};

  if (!packages) {
    return Object.keys(base).length ? base : undefined;
  }

  const remote = [
    ...(asArray<Dict>(base.remote) ?? []),
    ...packages.filter((pkg) => typeof pkg.url === 'string' && pkg.url),
  ];
  const local = [
    ...(asArray<Dict>(base.local) ?? []),
    ...packages.filter((pkg) => typeof pkg.path === 'string' && pkg.path && !pkg.url),
  ];
  return {
    ...(remote.length ? { remote } : {}),
    ...(local.length ? { local } : {}),
  };
}

function applyDefaultDeploymentTarget(targets: unknown, deploymentTarget?: string): unknown {
  if (!deploymentTarget || !Array.isArray(targets)) {
    return targets;
  }
  return targets.map((target) => {
    if (!isRecord(target) || typeof target.deploymentTarget === 'string') {
      return target;
    }
    return { ...target, deploymentTarget };
  });
}
