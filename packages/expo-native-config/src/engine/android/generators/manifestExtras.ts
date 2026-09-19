import { withMeta } from '../../core';
import type { Generator, Op } from '../../core';

import type {
  AndroidComponentSpec,
  AndroidManifestComponentOp,
  AndroidManifestMetaDataOp,
  AndroidManifestSupportsScreensOp,
  AndroidSlice,
} from '../types';

/**
 * AndroidManifest entries beyond permissions, features and `<application>`
 * attributes: `<meta-data>` (where most SDK keys live), application components,
 * and `<supports-screens>`. A component with `remove: true` emits
 * `tools:node="remove"`, the supported way to drop a component a dependency
 * merges in.
 */
export const manifestExtrasGenerator: Generator = {
  name: 'androidManifestExtras',
  generate({ manifest }) {
    const slice = (manifest as { android?: AndroidSlice }).android;
    if (!slice || typeof slice !== 'object') {
      return { ops: [] };
    }
    const ops: Op[] = [];

    for (const [name, value] of Object.entries(slice.metaData ?? {})) {
      ops.push(
        withMeta(
          {
            kind: 'androidManifestMetaData',
            name,
            value: String(value),
            label: `android:metaData:${name}`,
          } satisfies AndroidManifestMetaDataOp,
          {
            id: `android.metaData.${name}`,
            platform: 'android',
            semanticKind: 'android.manifest.metaData.set',
            source: `android.metaData.${name}`,
            status: 'update',
            files: ['android/app/src/main/AndroidManifest.xml'],
            desired: value,
          },
        ),
      );
    }

    for (const component of (slice.components ?? []) as AndroidComponentSpec[]) {
      ops.push(
        withMeta(
          {
            kind: 'androidManifestComponent',
            component,
            label: `android:${component.kind}:${component.name}`,
          } satisfies AndroidManifestComponentOp,
          {
            id: `android.${component.kind}.${component.name}`,
            platform: 'android',
            semanticKind: component.remove
              ? 'android.manifest.component.remove'
              : 'android.manifest.component.add',
            source: 'android.components',
            status: component.remove ? 'remove' : 'add',
            files: ['android/app/src/main/AndroidManifest.xml'],
            desired: component,
          },
        ),
      );
    }

    if (slice.supportsScreens && Object.keys(slice.supportsScreens).length > 0) {
      ops.push(
        withMeta(
          {
            kind: 'androidManifestSupportsScreens',
            flags: slice.supportsScreens,
            label: 'android:supportsScreens',
          } satisfies AndroidManifestSupportsScreensOp,
          {
            id: 'android.supportsScreens',
            platform: 'android',
            semanticKind: 'android.manifest.supportsScreens.set',
            source: 'android.supportsScreens',
            status: 'update',
            files: ['android/app/src/main/AndroidManifest.xml'],
            desired: slice.supportsScreens,
          },
        ),
      );
    }

    return { ops };
  },
};
