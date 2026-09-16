import { rubyLiteral, withMeta } from '../../core';
import type { Generator, MergeBlockOp, Op } from '../../core';

export const podSettingsGenerator: Generator = {
  name: 'podSettings',
  generate({ manifest }) {
    const ops: Op[] = [];
    const minimum = manifest.minimumPodDeploymentTarget as string | undefined;
    if (minimum) {
      const literal = rubyLiteral(minimum);
      ops.push(
        withMeta(
          {
            kind: 'mergeBlock',
            path: 'Podfile',
            tag: 'expo-native-workspace-pod-minimum',
            anchor: /post_install do \|installer\|/,
            offset: 1,
            comment: '#',
            label: 'pods:minimumDeploymentTarget',
            newSrc: [
              `    minimum_ios = Gem::Version.new(${literal})`,
              '    installer.pods_project.targets.each do |pod_target|',
              '      pod_target.build_configurations.each do |build_config|',
              "        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
              '        if current.nil? || (Gem::Version.correct?(current.to_s) && Gem::Version.new(current.to_s) < minimum_ios)',
              `          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = ${literal}`,
              '        end',
              '      end',
              '    end',
            ].join('\n'),
          } satisfies MergeBlockOp,
          {
            id: 'pod:minimumDeploymentTarget',
            platform: 'ios',
            semanticKind: 'ios.pod.deploymentTarget.minimum',
            source: 'ios.minimumPodDeploymentTarget',
            status: 'update',
            files: ['ios/Podfile'],
            desired: minimum,
          },
        ),
      );
    }
    const globals = manifest.podfileGlobals as
      Record<string, string | number | boolean> | undefined;
    if (globals && Object.keys(globals).length) {
      const newSrc = Object.entries(globals)
        .map(
          ([name, value]) =>
            `$${name} = ${typeof value === 'string' ? rubyLiteral(value) : String(value)}`,
        )
        .join('\n');
      ops.push(
        withMeta(
          {
            kind: 'mergeBlock',
            path: 'Podfile',
            tag: 'expo-native-workspace-pod-globals',
            anchor: /^/,
            offset: 0,
            comment: '#',
            label: 'pods:globals',
            newSrc,
          } satisfies MergeBlockOp,
          {
            id: 'pod:globals',
            platform: 'ios',
            semanticKind: 'ios.pod.globals.set',
            source: 'ios.podfileGlobals',
            status: 'update',
            files: ['ios/Podfile'],
            desired: globals,
          },
        ),
      );
    }
    return { ops };
  },
};
