import { withMeta } from '../../core';
import type { BaseOp, Generator, Op, OpMeta } from '../../core';

import type {
  AndroidColorOp,
  AndroidSlice,
  AndroidStringOp,
  AndroidStyleOp,
  AndroidStyleSpec,
} from '../types';

/**
 * Typed Android resource values. These use Expo's own `withStringsXml` /
 * `withColorsXml` / `withStylesXml` mods, which means `expo config --type
 * introspect` can show the result without a prebuild — unlike a raw file write.
 * `strings.xml` is also the documented channel for values native code needs
 * before the JS engine starts.
 */
export const androidResourcesGenerator: Generator = {
  name: 'androidResources',
  generate({ manifest }) {
    const slice = (manifest as { android?: AndroidSlice }).android;
    if (!slice || typeof slice !== 'object') {
      return { ops: [] };
    }
    const ops: Op[] = [];
    const tag = <T extends BaseOp>(op: T, meta: OpMeta): number => ops.push(withMeta(op, meta));

    for (const [name, value] of Object.entries(slice.strings ?? {})) {
      tag(
        {
          kind: 'androidString',
          name,
          value: String(value),
          label: `android:string:${name}`,
        } satisfies AndroidStringOp,
        {
          id: `android.string.${name}`,
          platform: 'android',
          semanticKind: 'android.resource.string.set',
          source: `android.strings.${name}`,
          status: 'update',
          files: ['android/app/src/main/res/values/strings.xml'],
          desired: value,
        },
      );
    }

    for (const [name, value] of Object.entries(slice.colors ?? {})) {
      tag(
        {
          kind: 'androidColor',
          name,
          value,
          label: `android:color:${name}`,
        } satisfies AndroidColorOp,
        {
          id: `android.color.${name}`,
          platform: 'android',
          semanticKind: 'android.resource.color.set',
          source: `android.colors.${name}`,
          status: 'update',
          files: ['android/app/src/main/res/values/colors.xml'],
          desired: value,
        },
      );
    }

    for (const style of (slice.styles ?? []) as AndroidStyleSpec[]) {
      tag(
        {
          kind: 'androidStyle',
          style,
          label: `android:style:${style.name}`,
        } satisfies AndroidStyleOp,
        {
          id: `android.style.${style.name}`,
          platform: 'android',
          semanticKind: 'android.resource.style.set',
          source: 'android.styles',
          status: 'update',
          files: ['android/app/src/main/res/values/styles.xml'],
          desired: style,
        },
      );
    }

    return { ops };
  },
};
