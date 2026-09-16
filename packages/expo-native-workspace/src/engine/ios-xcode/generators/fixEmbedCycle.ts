import type { Generator } from '../../core';

import { pbxOp } from '../pbxOp';

const EMBED_PHASE_NAME = 'Embed Foundation Extensions';
const APP_PRODUCT_TYPE = 'com.apple.product-type.application';

function isa(model: { props?: { isa?: unknown } }): string {
  return String(model?.props?.isa ?? '');
}

function cleanName(value: unknown): string {
  return String(value ?? '').replace(/"/g, '');
}

/**
 * Places "Embed Foundation Extensions" immediately after Resources on app targets,
 * avoiding Xcode 15+ build cycles when extensions and RN script phases coexist.
 * Enabled by default; set `fixExtensionEmbedCycle: false` to disable.
 */
export const fixEmbedCycleGenerator: Generator = {
  name: 'fixEmbedCycle',
  generate({ manifest }) {
    if (manifest.fixExtensionEmbedCycle === false) {
      return { ops: [] };
    }

    return {
      ops: [
        pbxOp(
          'fixEmbedCycle',
          ({ project }) => {
            for (const target of project.rootObject.props.targets) {
              const productType = cleanName(
                (target.props as { productType?: unknown }).productType,
              );
              if (productType !== APP_PRODUCT_TYPE) {
                continue;
              }
              const buildPhases = (target.props as { buildPhases?: unknown[] }).buildPhases;
              if (!Array.isArray(buildPhases) || buildPhases.length === 0) {
                continue;
              }
              const embedIndex = buildPhases.findIndex(
                (phase) =>
                  isa(phase as { props?: { isa?: unknown } }) === 'PBXCopyFilesBuildPhase' &&
                  cleanName((phase as { props?: { name?: unknown } }).props?.name) ===
                    EMBED_PHASE_NAME,
              );
              if (embedIndex < 0) {
                continue;
              }
              const [embedPhase] = buildPhases.splice(embedIndex, 1);
              const resourcesIndex = buildPhases.findIndex(
                (phase) => isa(phase as { props?: { isa?: unknown } }) === 'PBXResourcesBuildPhase',
              );
              if (resourcesIndex < 0) {
                buildPhases.splice(embedIndex, 0, embedPhase);
                continue;
              }
              buildPhases.splice(resourcesIndex + 1, 0, embedPhase);
            }
          },
          {
            id: 'xcode.embedCycle',
            platform: 'ios',
            semanticKind: 'ios.xcode.embedCycle.fix',
            source: 'ios.xcode',
            status: 'update',
            files: ['ios/*.xcodeproj/project.pbxproj'],
            phase: 'finalized',
            risk: 'low',
          },
        ),
      ],
    };
  },
};
