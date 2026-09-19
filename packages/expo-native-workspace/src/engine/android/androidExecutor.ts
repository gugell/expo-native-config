import {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
  withProjectBuildGradle,
  withSettingsGradle,
  withStringsXml,
  withAndroidColors,
  withAndroidStyles,
} from '@expo/config-plugins';
import { mergeContents, removeContents } from '@expo/config-plugins/build/utils/generateCode';
import type { Executor, Op } from '../core';
import { resolveSecret } from '../core';

import type {
  AndroidComponentSpec,
  AndroidGradleBlockOp,
  AndroidGradlePropertyOp,
  AndroidGradleRemoveBlockOp,
  AndroidGradleReplaceOp,
  AndroidManifestAppAttributeOp,
  AndroidManifestComponentOp,
  AndroidManifestMetaDataOp,
  AndroidManifestPermissionOp,
  AndroidManifestSupportsScreensOp,
  AndroidManifestUsesFeatureOp,
  AndroidColorOp,
  AndroidOp,
  AndroidStringOp,
  AndroidStyleOp,
  GradleFile,
} from './types';
import { isAndroidOp } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function applyGradleProperties(modResults: any[], ops: AndroidGradlePropertyOp[]): void {
  for (const op of ops) {
    const value = op.secret ? resolveSecret(op.secret, op.label) : op.value;
    const existing = modResults.find((item) => item.type === 'property' && item.key === op.key);
    if (existing) {
      existing.value = value;
    } else {
      modResults.push({ type: 'property', key: op.key, value });
    }
  }
}

/** Appends a tagged block at the end of the file, replacing any previous copy. */
function appendTaggedBlock(contents: string, op: AndroidGradleBlockOp): string {
  const block = mergeContents({
    tag: op.tag,
    src: '',
    newSrc: op.contents,
    anchor: /^$/,
    offset: 0,
    comment: op.comment,
  }).contents;
  const cleaned = removeContents({ src: contents, tag: op.tag }).contents;
  if (cleaned.includes(block.trim())) {
    return cleaned;
  }
  return `${cleaned.trimEnd()}\n\n${block.trim()}\n`;
}

function applyGradleText(
  contents: string,
  blocks: AndroidGradleBlockOp[],
  replaces: AndroidGradleReplaceOp[],
  removals: AndroidGradleRemoveBlockOp[],
  label: string,
): string {
  let next = contents;
  for (const op of removals) {
    next = removeContents({ src: next, tag: op.tag }).contents;
  }
  for (const op of blocks) {
    if (op.append) {
      next = appendTaggedBlock(next, op);
      continue;
    }
    const result = mergeContents({
      tag: op.tag,
      src: next,
      newSrc: op.contents,
      anchor: new RegExp(op.anchor),
      offset: op.offset,
      comment: op.comment,
    });
    next = result.contents;
  }
  for (const op of replaces) {
    if (op.skipIfContains && next.includes(op.skipIfContains)) {
      continue;
    }
    const pattern = new RegExp(op.find, op.all ? 'g' : '');
    if (!pattern.test(next)) {
      if (op.required) {
        throw new Error(
          `[expo-native-workspace] ${op.label}: pattern /${op.find}/ did not match anything in ${label}.`,
        );
      }
      continue;
    }
    next = next.replace(new RegExp(op.find, op.all ? 'g' : ''), op.replacement);
  }
  return next;
}

const GRADLE_FILE_NAMES: Record<GradleFile, string> = {
  app: 'android/app/build.gradle',
  project: 'android/build.gradle',
  settings: 'android/settings.gradle',
};

function gradleMod(
  file: GradleFile,
  blocks: AndroidGradleBlockOp[],
  replaces: AndroidGradleReplaceOp[],
  removals: AndroidGradleRemoveBlockOp[],
) {
  return (config: any) => {
    const wrap =
      file === 'app'
        ? withAppBuildGradle
        : file === 'settings'
          ? withSettingsGradle
          : withProjectBuildGradle;
    return wrap(config, (cfg: any) => {
      cfg.modResults.contents = applyGradleText(
        cfg.modResults.contents,
        blocks,
        replaces,
        removals,
        GRADLE_FILE_NAMES[file],
      );
      return cfg;
    });
  };
}

export function ensureMetaData(application: any, op: AndroidManifestMetaDataOp): void {
  const list: Array<{ $: Record<string, string> }> = Array.isArray(application['meta-data'])
    ? application['meta-data']
    : application['meta-data']
      ? [application['meta-data']]
      : [];
  const attrs = { 'android:name': op.name, 'android:value': op.value };
  const existing = list.find((entry) => entry.$?.['android:name'] === op.name);
  if (existing) {
    existing.$ = { ...existing.$, ...attrs };
  } else {
    list.push({ $: attrs });
  }
  application['meta-data'] = list;
}

export function ensureComponent(application: any, spec: AndroidComponentSpec): void {
  const key = spec.kind;
  const list: Array<{ $: Record<string, string> }> = Array.isArray(application[key])
    ? application[key]
    : application[key]
      ? [application[key]]
      : [];
  const attrs: Record<string, string> = {
    'android:name': spec.name,
    ...(spec.attributes ?? {}),
    ...(spec.remove ? { 'tools:node': 'remove' } : {}),
  };
  const existing = list.find((entry) => entry.$?.['android:name'] === spec.name);
  if (existing) {
    existing.$ = { ...existing.$, ...attrs };
    if (!spec.remove) {
      delete existing.$['tools:node'];
    }
  } else {
    list.push({ $: attrs });
  }
  application[key] = list;
}

export function ensureSupportsScreens(manifest: any, flags: Record<string, boolean>): void {
  const root = manifest.manifest as Record<string, unknown>;
  const existing = (root['supports-screens'] as { $?: Record<string, string> } | undefined) ?? {};
  const attrs: Record<string, string> = { ...(existing.$ ?? {}) };
  for (const [name, value] of Object.entries(flags)) {
    attrs[`android:${name}`] = String(value);
  }
  root['supports-screens'] = { $: attrs };
}

function applyManifest(
  manifest: any,
  permissions: AndroidManifestPermissionOp[],
  attributes: AndroidManifestAppAttributeOp[],
  features: AndroidManifestUsesFeatureOp[],
  metaData: AndroidManifestMetaDataOp[],
  components: AndroidManifestComponentOp[],
  supportsScreens: AndroidManifestSupportsScreensOp[],
): void {
  for (const op of permissions) {
    AndroidConfig.Permissions.ensurePermission(manifest, op.permission);
  }
  if (attributes.length > 0) {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.$ = application.$ ?? {};
    for (const op of attributes) {
      (application.$ as Record<string, string>)[op.name] = op.value;
    }
  }
  for (const op of features) {
    ensureUsesFeature(manifest, op);
  }
  if (metaData.length > 0 || components.length > 0) {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    for (const op of metaData) {
      ensureMetaData(application, op);
    }
    if (components.some((op) => op.component.remove)) {
      // `tools:node="remove"` is inert without the tools namespace on <manifest>.
      AndroidConfig.Manifest.ensureToolsAvailable(manifest);
    }
    for (const op of components) {
      ensureComponent(application, op.component);
    }
  }
  for (const op of supportsScreens) {
    ensureSupportsScreens(manifest, op.flags);
  }
}

export function ensureUsesFeature(manifest: any, op: AndroidManifestUsesFeatureOp): void {
  const root = manifest.manifest as Record<string, unknown>;
  const existing = root['uses-feature'];
  const list: Array<{ $: Record<string, string> }> = Array.isArray(existing)
    ? existing
    : existing
      ? [existing as { $: Record<string, string> }]
      : [];
  const attrs: Record<string, string> = { 'android:name': op.name };
  if (op.required === false) {
    attrs['android:required'] = 'false';
  }
  if (op.glEsVersion) {
    attrs['android:glEsVersion'] = op.glEsVersion;
  }
  const matching = list.find((entry) => entry.$?.['android:name'] === op.name);
  if (matching) {
    matching.$ = { ...matching.$, ...attrs };
    if (op.required !== false) delete matching.$['android:required'];
    if (!op.glEsVersion) delete matching.$['android:glEsVersion'];
  } else list.push({ $: attrs });
  root['uses-feature'] = list;
}

function applyResourceOps(
  config: any,
  strings: AndroidStringOp[],
  colors: AndroidColorOp[],
  styles: AndroidStyleOp[],
): any {
  let next = config;
  if (strings.length > 0) {
    next = withStringsXml(next, (cfg: any) => {
      for (const op of strings) {
        cfg.modResults = AndroidConfig.Strings.setStringItem(
          [{ $: { name: op.name, translatable: 'false' }, _: op.value }],
          cfg.modResults,
        );
      }
      return cfg;
    });
  }
  if (colors.length > 0) {
    next = withAndroidColors(next, (cfg: any) => {
      for (const op of colors) {
        cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
          name: op.name,
          value: op.value,
        });
      }
      return cfg;
    });
  }
  if (styles.length > 0) {
    next = withAndroidStyles(next, (cfg: any) => {
      for (const op of styles) {
        const parent = {
          name: op.style.name,
          ...(op.style.parent ? { parent: op.style.parent } : {}),
        };
        for (const [name, value] of Object.entries(op.style.items)) {
          cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
            add: true,
            value,
            name,
            parent,
            ...(op.style.targetApi ? { targetApi: op.style.targetApi } : {}),
          });
        }
      }
      return cfg;
    });
  }
  return next;
}

/** Applies android gradle/manifest/resource ops via Expo's typed android mods. */
export const androidExecutor: Executor = (config, ops: Op[]) => {
  const androidOps = ops.filter(isAndroidOp) as AndroidOp[];
  if (androidOps.length === 0) {
    return config;
  }

  const properties = androidOps.filter(
    (o): o is AndroidGradlePropertyOp => o.kind === 'androidGradleProperty',
  );
  const blocks = androidOps.filter(
    (o): o is AndroidGradleBlockOp => o.kind === 'androidGradleBlock',
  );
  const replaces = androidOps.filter(
    (o): o is AndroidGradleReplaceOp => o.kind === 'androidGradleReplace',
  );
  const removals = androidOps.filter(
    (o): o is AndroidGradleRemoveBlockOp => o.kind === 'androidGradleRemoveBlock',
  );
  const metaData = androidOps.filter(
    (o): o is AndroidManifestMetaDataOp => o.kind === 'androidManifestMetaData',
  );
  const components = androidOps.filter(
    (o): o is AndroidManifestComponentOp => o.kind === 'androidManifestComponent',
  );
  const supportsScreens = androidOps.filter(
    (o): o is AndroidManifestSupportsScreensOp => o.kind === 'androidManifestSupportsScreens',
  );
  const strings = androidOps.filter((o): o is AndroidStringOp => o.kind === 'androidString');
  const colors = androidOps.filter((o): o is AndroidColorOp => o.kind === 'androidColor');
  const styles = androidOps.filter((o): o is AndroidStyleOp => o.kind === 'androidStyle');
  const permissions = androidOps.filter(
    (o): o is AndroidManifestPermissionOp => o.kind === 'androidManifestPermission',
  );
  const attributes = androidOps.filter(
    (o): o is AndroidManifestAppAttributeOp => o.kind === 'androidManifestAppAttribute',
  );
  const features = androidOps.filter(
    (o): o is AndroidManifestUsesFeatureOp => o.kind === 'androidManifestUsesFeature',
  );

  if (properties.length > 0) {
    config = withGradleProperties(config as any, (cfg: any) => {
      applyGradleProperties(cfg.modResults, properties);
      return cfg;
    }) as typeof config;
  }

  for (const file of ['app', 'project', 'settings'] as GradleFile[]) {
    const fileBlocks = blocks.filter((o) => o.file === file);
    const fileReplaces = replaces.filter((o) => o.file === file);
    const fileRemovals = removals.filter((o) => o.file === file);
    if (fileBlocks.length > 0 || fileReplaces.length > 0 || fileRemovals.length > 0) {
      config = gradleMod(file, fileBlocks, fileReplaces, fileRemovals)(config) as typeof config;
    }
  }

  if (
    permissions.length > 0 ||
    attributes.length > 0 ||
    features.length > 0 ||
    metaData.length > 0 ||
    components.length > 0 ||
    supportsScreens.length > 0
  ) {
    config = withAndroidManifest(config as any, (cfg: any) => {
      applyManifest(
        cfg.modResults,
        permissions,
        attributes,
        features,
        metaData,
        components,
        supportsScreens,
      );
      return cfg;
    }) as typeof config;
  }

  config = applyResourceOps(config as any, strings, colors, styles) as typeof config;

  return config;
};
