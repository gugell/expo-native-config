import { withMeta } from '../../core';
import type { Generator, Op } from '../../core';

import type { PodfilePropertiesOp } from '../types';

/**
 * `Podfile.properties.json` is the one channel Expo documents as safe for
 * Podfile configuration: the versioned template reads it, so no Ruby is
 * rewritten and `expo config --type introspect` can show the result. Prefer it
 * over `ios.podfile` whenever the value you need has a property.
 */
export const podfilePropertiesGenerator: Generator = {
  name: 'podfileProperties',
  generate({ manifest }) {
    const properties = manifest.podfileProperties as Record<string, string> | undefined;
    if (!properties || Object.keys(properties).length === 0) {
      return { ops: [] };
    }
    const ops: Op[] = [
      withMeta(
        {
          kind: 'iosPodfileProperties',
          properties,
          label: 'ios:podfileProperties',
        } satisfies PodfilePropertiesOp,
        {
          id: 'ios.podfileProperties',
          platform: 'ios',
          semanticKind: 'ios.podfileProperties.set',
          source: 'ios.podfileProperties',
          status: 'update',
          files: ['ios/Podfile.properties.json'],
          desired: properties,
        },
      ),
    ];
    return { ops };
  },
};
