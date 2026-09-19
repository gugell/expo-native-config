import { rubyLiteral, withMeta } from '../../core';
import type { Generator, MergeBlockOp, Op, RemoveBlockOp, ReplaceInFileOp } from '../../core';

const POST_INSTALL_TAG = 'expo-native-config-podfile-post-install';
const LINES_TAG = 'expo-native-config-podfile-lines';
const AUTOLINKING_TAG = '# expo-native-config-autolinking-exclude';

const POST_INSTALL = /post_install do \|installer\|/;
const USE_EXPO_MODULES = /use_expo_modules!/;

interface ReplaceRule {
  find: string;
  replacement: string;
  all?: boolean;
  skipIfContains?: string;
  required?: boolean;
}
interface PodfileEscapeHatch {
  postInstall?: string[];
  lines?: string[];
  replace?: ReplaceRule[];
}

function block(tag: string, newSrc: string, anchor: RegExp, label: string): MergeBlockOp {
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

function clear(tag: string, label: string): RemoveBlockOp {
  return { kind: 'removeBlock', path: 'Podfile', tag, label };
}

/**
 * Podfile edits that no typed field covers: raw `post_install` lines, raw
 * top-level lines, and regular-expression replacements over the generated
 * Podfile (the standard way to repoint a vendor plugin's hardcoded
 * `node_modules` path in a monorepo). These are escape hatches — they are
 * reported as such by `plan` and are the first thing to suspect when a
 * prebuild breaks.
 */
export const podfileExtrasGenerator: Generator = {
  name: 'podfileExtras',
  generate({ manifest }) {
    const ops: Op[] = [];
    const podfile = (manifest.podfile as PodfileEscapeHatch | undefined) ?? {};
    const exclude = (manifest.iosAutolinkingExclude as string[] | undefined) ?? [];

    const postInstall = podfile.postInstall ?? [];
    ops.push(
      withMeta(
        postInstall.length
          ? block(
              POST_INSTALL_TAG,
              postInstall.map((line) => `    ${line}`).join('\n'),
              POST_INSTALL,
              'podfile:postInstall',
            )
          : clear(POST_INSTALL_TAG, 'podfile:postInstall'),
        {
          id: 'ios.podfile.postInstall',
          platform: 'ios',
          semanticKind: 'ios.podfile.postInstall.set',
          source: 'ios.podfile.postInstall',
          status: postInstall.length ? 'update' : 'remove',
          phase: postInstall.length ? undefined : 'cleanup',
          files: ['ios/Podfile'],
          risk: 'escape-hatch',
          desired: postInstall,
        },
      ),
    );

    const lines = podfile.lines ?? [];
    ops.push(
      withMeta(
        lines.length
          ? block(LINES_TAG, lines.join('\n'), /^/, 'podfile:lines')
          : clear(LINES_TAG, 'podfile:lines'),
        {
          id: 'ios.podfile.lines',
          platform: 'ios',
          semanticKind: 'ios.podfile.lines.set',
          source: 'ios.podfile.lines',
          status: lines.length ? 'update' : 'remove',
          phase: lines.length ? undefined : 'cleanup',
          files: ['ios/Podfile'],
          risk: 'escape-hatch',
          desired: lines,
        },
      ),
    );

    for (const [index, rule] of (podfile.replace ?? []).entries()) {
      ops.push(
        withMeta(
          {
            kind: 'replaceInFile',
            path: 'Podfile',
            find: rule.find,
            replacement: rule.replacement,
            all: rule.all,
            skipIfContains: rule.skipIfContains,
            required: rule.required,
            label: `podfile:replace:${index}`,
          } satisfies ReplaceInFileOp,
          {
            id: `ios.podfile.replace.${index}`,
            platform: 'ios',
            semanticKind: 'ios.podfile.replace',
            source: `ios.podfile.replace[${index}]`,
            status: 'update',
            files: ['ios/Podfile'],
            risk: 'escape-hatch',
            desired: rule,
          },
        ),
      );
    }

    if (exclude.length > 0) {
      const list = exclude.map((name) => rubyLiteral(name)).join(', ');
      ops.push(
        withMeta(
          {
            kind: 'replaceInFile',
            path: 'Podfile',
            // Only a bare `use_expo_modules!`; an existing argument list is left alone.
            find: String.raw`use_expo_modules!(?!\()`,
            replacement: `use_expo_modules!(exclude: [${list}]) ${AUTOLINKING_TAG}`,
            skipIfContains: AUTOLINKING_TAG,
            label: 'podfile:autolinkingExclude',
          } satisfies ReplaceInFileOp,
          {
            id: 'ios.autolinkingExclude',
            platform: 'ios',
            semanticKind: 'ios.autolinking.exclude',
            source: 'ios.autolinkingExclude',
            status: 'update',
            files: ['ios/Podfile'],
            desired: exclude,
          },
        ),
      );
    }

    return { ops };
  },
};

export { USE_EXPO_MODULES };
