import {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
  withProjectBuildGradle,
} from '@expo/config-plugins';
import { mergeContents } from '@expo/config-plugins/build/utils/generateCode';
import type { Executor, Op } from '../core';
import { resolveSecret } from '../core';

import type {
  AndroidGradleBlockOp,
  AndroidGradlePropertyOp,
  AndroidGradleReplaceOp,
  AndroidManifestAppAttributeOp,
  AndroidManifestPermissionOp,
  AndroidManifestUsesFeatureOp,
  AndroidOp,
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

function applyGradleText(
  contents: string,
  blocks: AndroidGradleBlockOp[],
  replaces: AndroidGradleReplaceOp[],
): string {
  let next = contents;
  for (const op of blocks) {
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
    next = next.replace(new RegExp(op.find, op.all ? 'g' : ''), op.replacement);
  }
  return next;
}

function gradleMod(
  file: GradleFile,
  blocks: AndroidGradleBlockOp[],
  replaces: AndroidGradleReplaceOp[],
) {
  return (config: any) => {
    const wrap = file === 'app' ? withAppBuildGradle : withProjectBuildGradle;
    return wrap(config, (cfg: any) => {
      cfg.modResults.contents = applyGradleText(cfg.modResults.contents, blocks, replaces);
      return cfg;
    });
  };
}

function applyManifest(
  manifest: any,
  permissions: AndroidManifestPermissionOp[],
  attributes: AndroidManifestAppAttributeOp[],
  features: AndroidManifestUsesFeatureOp[],
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

/** Applies android gradle/manifest ops via Expo's typed android mods. */
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

  for (const file of ['app', 'project'] as GradleFile[]) {
    const fileBlocks = blocks.filter((o) => o.file === file);
    const fileReplaces = replaces.filter((o) => o.file === file);
    if (fileBlocks.length > 0 || fileReplaces.length > 0) {
      config = gradleMod(file, fileBlocks, fileReplaces)(config) as typeof config;
    }
  }

  if (permissions.length > 0 || attributes.length > 0 || features.length > 0) {
    config = withAndroidManifest(config as any, (cfg: any) => {
      applyManifest(cfg.modResults, permissions, attributes, features);
      return cfg;
    }) as typeof config;
  }

  return config;
};
