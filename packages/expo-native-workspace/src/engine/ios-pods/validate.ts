import { ERR, assertBuildConfiguration, assertNameMatcher } from '../core';

import type {
  LocalPodDeclaration,
  PodBuildSettingsRule,
  PodRemoveBuildPhaseRule,
  RemotePodDeclaration,
} from './types';

export function normalizeLocalPods(pods: LocalPodDeclaration[] | undefined): LocalPodDeclaration[] {
  if (!Array.isArray(pods) || pods.length === 0) {
    return [];
  }
  return pods.map((entry, index) => {
    if (!entry?.pod?.trim() || !entry?.path?.trim()) {
      throw new Error(`${ERR} localPods[${index}] requires "pod" and "path" (relative to ios/).`);
    }
    const podPath = entry.path.trim();
    if (podPath.startsWith('/') || /^[A-Za-z]:/.test(podPath)) {
      throw new Error(
        `${ERR} localPods[${index}].path must be relative to ios/, not absolute: "${podPath}"`,
      );
    }
    return { pod: entry.pod.trim(), path: podPath };
  });
}

export function normalizeRemotePods(
  pods: RemotePodDeclaration[] | undefined,
): RemotePodDeclaration[] {
  if (!Array.isArray(pods) || pods.length === 0) {
    return [];
  }
  return pods.map((entry, index) => {
    if (!entry?.pod?.trim()) {
      throw new Error(`${ERR} remotePods[${index}] requires "pod".`);
    }
    if (entry.configurations && !Array.isArray(entry.configurations)) {
      throw new Error(`${ERR} remotePods[${index}].configurations must be an array.`);
    }
    return { ...entry, pod: entry.pod.trim() };
  });
}

export function normalizePodBuildSettingsRules(
  rules: PodBuildSettingsRule[] | undefined,
): PodBuildSettingsRule[] {
  if (!Array.isArray(rules) || rules.length === 0) {
    return [];
  }
  return rules.map((rule, index) => {
    assertNameMatcher(rule?.target, `podBuildSettings[${index}].target`);
    const settings = rule?.settings ?? {};
    const entries = Object.entries(settings);
    if (entries.length === 0) {
      throw new Error(`${ERR} podBuildSettings[${index}] requires non-empty "settings".`);
    }
    for (const [key, value] of entries) {
      if (!key.trim()) {
        throw new Error(`${ERR} podBuildSettings[${index}] has an empty build setting key.`);
      }
      if (typeof value !== 'string') {
        throw new Error(
          `${ERR} podBuildSettings[${index}].settings["${key}"] must be a string value.`,
        );
      }
    }
    const configurations = rule.configurations?.map((configuration, configIndex) => {
      assertBuildConfiguration(
        configuration,
        `podBuildSettings[${index}].configurations[${configIndex}]`,
      );
      return configuration;
    });
    return { ...rule, target: rule.target, settings, configurations };
  });
}

export function normalizeRemovePodBuildPhases(
  rules: PodRemoveBuildPhaseRule[] | undefined,
): PodRemoveBuildPhaseRule[] {
  if (!Array.isArray(rules) || rules.length === 0) {
    return [];
  }
  return rules.map((rule, index) => {
    assertNameMatcher(rule?.target, `removePodBuildPhases[${index}].target`);
    if (!rule.phase?.trim()) {
      throw new Error(`${ERR} removePodBuildPhases[${index}] requires a non-empty "phase".`);
    }
    return { target: rule.target, phase: rule.phase.trim() };
  });
}
