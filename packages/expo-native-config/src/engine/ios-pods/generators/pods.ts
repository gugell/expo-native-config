import { nameMatcherToRuby, rubyLiteral, withMeta } from '../../core';
import type { Generator, MergeBlockOp, Op, RemoveBlockOp } from '../../core';

import {
  normalizeLocalPods,
  normalizePodBuildSettingsRules,
  normalizeRemotePods,
  normalizeRemovePodBuildPhases,
} from '../validate';
import type {
  LocalPodDeclaration,
  PodBuildSettingsRule,
  PodRemoveBuildPhaseRule,
  RemotePodDeclaration,
} from './../types';

const LOCAL_PODS_TAG = 'expo-native-config-local-pods';
const REMOTE_PODS_TAG = 'expo-native-config-remote-pods';
const POD_BUILD_SETTINGS_TAG = 'expo-native-config-pod-build-settings';
const POD_REMOVE_BUILD_PHASES_TAG = 'expo-native-config-pod-remove-build-phases';

const USE_EXPO_MODULES = /use_expo_modules!/;
const POST_INSTALL = /post_install do \|installer\|/;

function localPodLines(pods: LocalPodDeclaration[]): string {
  return pods
    .map(({ pod, path }) => `  pod ${rubyLiteral(pod)}, :path => ${rubyLiteral(path)}`)
    .join('\n');
}

function remotePodLine(p: RemotePodDeclaration): string {
  const parts = [`pod ${rubyLiteral(p.pod)}`];
  if (p.version) {
    parts.push(rubyLiteral(p.version));
  }
  if (p.git) {
    parts.push(`:git => ${rubyLiteral(p.git)}`);
  }
  if (p.branch) {
    parts.push(`:branch => ${rubyLiteral(p.branch)}`);
  }
  if (p.tag) {
    parts.push(`:tag => ${rubyLiteral(p.tag)}`);
  }
  if (p.commit) {
    parts.push(`:commit => ${rubyLiteral(p.commit)}`);
  }
  if (p.configurations?.length) {
    parts.push(`:configurations => [${p.configurations.map((c) => rubyLiteral(c)).join(', ')}]`);
  }
  if (p.modularHeaders != null) {
    parts.push(`:modular_headers => ${p.modularHeaders}`);
  }
  return `  ${parts.join(', ')}`;
}

function podBuildSettingsLines(rules: PodBuildSettingsRule[]): string {
  const targetCondition = rules.map((rule) => `(${nameMatcherToRuby(rule.target)})`).join(' || ');
  const lines: string[] = [
    '  installer.pods_project.targets.each do |target|',
    `    next unless ${targetCondition}`,
    '    target.build_configurations.each do |config|',
  ];
  for (const rule of rules) {
    let condition = `(${nameMatcherToRuby(rule.target)})`;
    if (rule.configurations?.length) {
      const names = rule.configurations.map((value) => rubyLiteral(value)).join(', ');
      condition += ` && [${names}].include?(config.name)`;
    }
    lines.push(`      if ${condition}`);
    for (const [key, value] of Object.entries(rule.settings)) {
      lines.push(`        config.build_settings[${rubyLiteral(key)}] = ${rubyLiteral(value)}`);
    }
    lines.push('      end');
  }
  lines.push('    end');
  lines.push('  end');
  return lines.join('\n');
}

function podRemoveBuildPhasesLines(rules: PodRemoveBuildPhaseRule[]): string {
  return rules
    .map((rule) =>
      [
        '  installer.pods_project.targets.each do |target|',
        `    next unless ${nameMatcherToRuby(rule.target)}`,
        '    target.build_phases.delete_if do |phase|',
        `      phase.respond_to?(:name) && phase.name == ${rubyLiteral(rule.phase)}`,
        '    end',
        '  end',
      ].join('\n'),
    )
    .join('\n');
}

/** Drops a previously merged block so deleting a declaration takes effect without a clean prebuild. */
function removeBlock(tag: string, label: string): RemoveBlockOp {
  return { kind: 'removeBlock', path: 'Podfile', tag, label };
}

function mergeBlock(tag: string, newSrc: string, anchor: RegExp, label: string): MergeBlockOp {
  return {
    kind: 'mergeBlock',
    path: 'Podfile',
    tag,
    newSrc,
    anchor,
    offset: 1,
    comment: '#',
    label,
  };
}

export const podsGenerator: Generator = {
  name: 'pods',
  generate({ manifest }) {
    const localPods = normalizeLocalPods(manifest.localPods as LocalPodDeclaration[] | undefined);
    const remotePods = normalizeRemotePods(
      manifest.remotePods as RemotePodDeclaration[] | undefined,
    );
    const podBuildSettings = normalizePodBuildSettingsRules(
      manifest.podBuildSettings as PodBuildSettingsRule[] | undefined,
    );
    const removePodBuildPhases = normalizeRemovePodBuildPhases(
      manifest.removePodBuildPhases as PodRemoveBuildPhaseRule[] | undefined,
    );

    const ops: Op[] = [];
    if (localPods.length > 0) {
      ops.push(
        withMeta(
          mergeBlock(LOCAL_PODS_TAG, localPodLines(localPods), USE_EXPO_MODULES, 'localPods'),
          {
            id: 'pod:local',
            platform: 'ios',
            semanticKind: 'ios.pod.add',
            source: 'ios.pods',
            status: 'add',
            files: ['ios/Podfile'],
            desired: localPods,
          },
        ),
      );
    } else {
      ops.push(
        withMeta(removeBlock(LOCAL_PODS_TAG, 'localPods'), {
          id: 'pod:local',
          platform: 'ios',
          semanticKind: 'ios.pod.add',
          source: 'ios.pods',
          status: 'remove',
          files: ['ios/Podfile'],
          phase: 'cleanup',
        }),
      );
    }
    if (remotePods.length > 0) {
      ops.push(
        withMeta(
          mergeBlock(
            REMOTE_PODS_TAG,
            remotePods.map(remotePodLine).join('\n'),
            USE_EXPO_MODULES,
            'remotePods',
          ),
          {
            id: 'pod:remote',
            platform: 'ios',
            semanticKind: 'ios.pod.add',
            source: 'ios.pods',
            status: 'add',
            files: ['ios/Podfile'],
            desired: remotePods,
          },
        ),
      );
    } else {
      ops.push(
        withMeta(removeBlock(REMOTE_PODS_TAG, 'remotePods'), {
          id: 'pod:remote',
          platform: 'ios',
          semanticKind: 'ios.pod.add',
          source: 'ios.pods',
          status: 'remove',
          files: ['ios/Podfile'],
          phase: 'cleanup',
        }),
      );
    }
    if (podBuildSettings.length > 0) {
      ops.push(
        withMeta(
          mergeBlock(
            POD_BUILD_SETTINGS_TAG,
            podBuildSettingsLines(podBuildSettings),
            POST_INSTALL,
            'podBuildSettings',
          ),
          {
            id: 'pod:buildSettings',
            platform: 'ios',
            semanticKind: 'ios.pod.buildSetting.set',
            source: 'ios.podBuildSettings',
            status: 'update',
            files: ['ios/Podfile'],
            desired: podBuildSettings,
          },
        ),
      );
    } else {
      ops.push(
        withMeta(removeBlock(POD_BUILD_SETTINGS_TAG, 'podBuildSettings'), {
          id: 'pod:buildSettings',
          platform: 'ios',
          semanticKind: 'ios.pod.buildSetting.set',
          source: 'ios.podBuildSettings',
          status: 'remove',
          files: ['ios/Podfile'],
          phase: 'cleanup',
        }),
      );
    }
    if (removePodBuildPhases.length > 0) {
      ops.push(
        withMeta(
          mergeBlock(
            POD_REMOVE_BUILD_PHASES_TAG,
            podRemoveBuildPhasesLines(removePodBuildPhases),
            POST_INSTALL,
            'removePodBuildPhases',
          ),
          {
            id: 'pod:removeBuildPhases',
            platform: 'ios',
            semanticKind: 'ios.pod.buildPhase.remove',
            source: 'ios.removePodBuildPhases',
            status: 'remove',
            files: ['ios/Podfile'],
            desired: removePodBuildPhases,
          },
        ),
      );
    } else {
      ops.push(
        withMeta(removeBlock(POD_REMOVE_BUILD_PHASES_TAG, 'removePodBuildPhases'), {
          id: 'pod:removeBuildPhases',
          platform: 'ios',
          semanticKind: 'ios.pod.buildPhase.remove',
          source: 'ios.removePodBuildPhases',
          status: 'remove',
          files: ['ios/Podfile'],
          phase: 'cleanup',
        }),
      );
    }
    return { ops };
  },
};
