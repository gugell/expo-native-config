import fs from 'fs';
import path from 'path';
import { PBXNativeTarget, createBuildableReference } from '@bacons/xcode';
import type { Generator } from '../../core';

import { pbxOp } from '../pbxOp';
import { normalizeSchemeDefinitions } from '../validate';
import type { SchemeDefinition } from '../types';

const UNIT_TEST_PRODUCT_TYPE = 'com.apple.product-type.bundle.unit-test';

function cleanName(value: unknown): string {
  return String(value ?? '').replace(/"/g, '');
}

/**
 * Generates shared `.xcscheme` files through @bacons/xcode's `XCScheme` model —
 * no string templating. Each scheme is built from the app target with sensible
 * defaults, then the per-action build configurations are overridden.
 */
export const schemesGenerator: Generator = {
  name: 'schemes',
  generate({ manifest }) {
    const schemes = normalizeSchemeDefinitions(manifest.schemes as SchemeDefinition[] | undefined);
    if (schemes.length === 0) {
      return { ops: [] };
    }
    const replaceExpoScheme = Boolean(manifest.replaceExpoScheme);

    return {
      ops: [
        pbxOp(
          'schemes',
          ({ project }) => {
            const app = project.rootObject.getMainAppTarget('ios');
            if (!app) {
              throw new Error(
                '[expo-native-config] Could not find the main iOS application target for schemes.',
              );
            }

            fs.mkdirSync(project.getSharedSchemesDir(), { recursive: true });

            if (replaceExpoScheme) {
              for (const existing of project.getSchemes()) {
                project.deleteScheme(existing.name, { shared: true });
              }
            }

            const testTarget = project.rootObject.props.targets.find(
              (target) =>
                PBXNativeTarget.is(target) &&
                cleanName((target.props as { productType?: unknown }).productType) ===
                  UNIT_TEST_PRODUCT_TYPE,
            ) as PBXNativeTarget | undefined;
            const container = `container:${path.basename(path.dirname(project.filePath))}`;

            for (const scheme of schemes) {
              const xcscheme = project.createSchemeForTarget(app, scheme.name);
              xcscheme.props.lastUpgradeVersion = '1130';
              xcscheme.props.launchAction!.buildConfiguration = scheme.configuration;
              xcscheme.props.profileAction!.buildConfiguration = scheme.archive ?? 'Release';
              xcscheme.props.analyzeAction!.buildConfiguration = scheme.analyze ?? 'Debug';
              xcscheme.props.archiveAction!.buildConfiguration = scheme.archive ?? 'Release';
              xcscheme.props.testAction!.buildConfiguration = 'Debug';

              if (scheme.includeUnitTestTarget && testTarget) {
                xcscheme.addTestTarget(createBuildableReference(testTarget, container));
              }

              project.saveScheme(xcscheme, { shared: true });
            }
          },
          {
            id: 'scheme:all',
            platform: 'ios',
            semanticKind: 'ios.scheme.add',
            source: 'ios.schemes',
            status: 'add',
            files: ['ios/*.xcodeproj/xcshareddata/xcschemes'],
            desired: schemes.map((s) => s.name),
            phase: 'finalized',
          },
        ),
      ],
    };
  },
};
