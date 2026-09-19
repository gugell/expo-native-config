import { propertiesSigningOps } from '../signing';
import { ERR, resolveSecret, withMeta } from '../../core';
import type { Generator, OpMeta } from '../../core';

import { renderAndroidDependencies } from '../dependencies';
import { normalizeAndroidFeatures } from '../features';
import type { AndroidOp, AndroidSlice, AndroidGradlePropertyOp } from '../types';

const SIGNING_KEYS = {
  storeFile: 'EXPO_WORKSPACE_RELEASE_STORE_FILE',
  storePassword: 'EXPO_WORKSPACE_RELEASE_STORE_PASSWORD',
  keyAlias: 'EXPO_WORKSPACE_RELEASE_KEY_ALIAS',
  keyPassword: 'EXPO_WORKSPACE_RELEASE_KEY_PASSWORD',
} as const;

function tag(
  op: AndroidOp,
  meta: Omit<OpMeta, 'platform' | 'status'> & { status?: OpMeta['status'] },
): AndroidOp {
  return withMeta(op, { platform: 'android', status: meta.status ?? 'add', ...meta });
}

function gradleProperty(key: string, value: string | number | boolean): AndroidGradlePropertyOp {
  return {
    kind: 'androidGradleProperty',
    key,
    value: String(value),
    label: `android:gradleProperty:${key}`,
  };
}

export const androidGenerator: Generator = {
  name: 'android',
  generate({ manifest, projectRoot }) {
    const slice = (manifest as { android?: AndroidSlice }).android;
    if (!slice || typeof slice !== 'object') {
      return { ops: [] };
    }

    const ops: AndroidOp[] = [];
    const warnings: string[] = [];

    const sdkFields: Array<[keyof AndroidSlice, string]> = [
      ['minSdkVersion', 'android.minSdkVersion'],
      ['compileSdkVersion', 'android.compileSdkVersion'],
      ['targetSdkVersion', 'android.targetSdkVersion'],
      ['buildToolsVersion', 'android.buildToolsVersion'],
      ['ndkVersion', 'android.ndkVersion'],
      ['kotlinVersion', 'android.kotlinVersion'],
    ];
    for (const [key, gradleKey] of sdkFields) {
      const value = slice[key];
      if (value === undefined) continue;
      ops.push(
        tag(gradleProperty(gradleKey, value as string | number), {
          id: `android.sdk.${key}`,
          semanticKind: 'android.sdk.set',
          source: `android.${key}`,
          status: 'update',
          files: ['android/gradle.properties'],
          desired: value,
        }),
      );
    }

    if (slice.gradleProperties) {
      for (const [key, value] of Object.entries(slice.gradleProperties)) {
        ops.push(
          tag(gradleProperty(key, value), {
            id: `android.gradleProperty.${key}`,
            semanticKind: 'android.gradle.property.set',
            source: `android.gradleProperties.${key}`,
            status: 'update',
            files: ['android/gradle.properties'],
            desired: value,
          }),
        );
      }
    }

    for (const permission of slice.permissions ?? []) {
      if (typeof permission !== 'string' || !permission.trim()) {
        throw new Error(`${ERR} android.permissions entries must be non-empty strings.`);
      }
      const name = permission.trim();
      ops.push(
        tag(
          {
            kind: 'androidManifestPermission',
            permission: name,
            label: `android:permission:${name}`,
          },
          {
            id: `android.permission.${name}`,
            semanticKind: 'android.permission.add',
            source: 'android.permissions',
            files: ['android/app/src/main/AndroidManifest.xml'],
            desired: name,
          },
        ),
      );
    }

    if (slice.applicationAttributes) {
      for (const [name, value] of Object.entries(slice.applicationAttributes)) {
        ops.push(
          tag(
            {
              kind: 'androidManifestAppAttribute',
              name,
              value: String(value),
              label: `android:appAttribute:${name}`,
            },
            {
              id: `android.appAttribute.${name}`,
              semanticKind: 'android.manifest.attribute.set',
              source: `android.applicationAttributes.${name}`,
              status: 'update',
              files: ['android/app/src/main/AndroidManifest.xml'],
              desired: value,
            },
          ),
        );
      }
    }

    for (const feature of normalizeAndroidFeatures(slice.features)) {
      ops.push(
        tag(
          {
            kind: 'androidManifestUsesFeature',
            name: feature.name,
            required: feature.required,
            glEsVersion: feature.glEsVersion,
            label: `android:feature:${feature.name}`,
          },
          {
            id: `android.feature.${feature.name}`,
            semanticKind: 'android.manifest.feature.add',
            source: 'android.features',
            files: ['android/app/src/main/AndroidManifest.xml'],
            desired: feature,
          },
        ),
      );
    }

    const { lines, desired } = renderAndroidDependencies(slice.dependencies);
    if (lines.length) {
      ops.push(
        tag(
          {
            kind: 'androidGradleBlock',
            file: 'app',
            tag: 'expo-workspace-android-dependencies',
            anchor: 'dependencies\\s*\\{',
            offset: 1,
            comment: '//',
            contents: lines.join('\n'),
            label: 'android:dependencies',
          },
          {
            id: 'android.dependencies',
            semanticKind: 'android.dependency.add',
            source: 'android.dependencies',
            files: ['android/app/build.gradle'],
            desired,
          },
        ),
      );
    }

    if (slice.signing && 'propertiesFile' in slice.signing) {
      ops.push(...propertiesSigningOps(slice.signing, projectRoot));
    } else if (slice.signing) {
      const s = slice.signing;
      if (!s.storeFile?.trim() || !s.keyAlias?.trim()) {
        throw new Error(`${ERR} android.signing requires "storeFile" and "keyAlias".`);
      }
      tryResolveSecret(s.storePassword, 'android.signing.storePassword', warnings);
      tryResolveSecret(s.keyPassword, 'android.signing.keyPassword', warnings);

      ops.push(
        tag(gradleProperty(SIGNING_KEYS.storeFile, s.storeFile), {
          id: 'android.signing.storeFile',
          semanticKind: 'android.signing.set',
          source: 'android.signing',
          status: 'update',
          files: ['android/gradle.properties'],
          desired: s.storeFile,
        }),
      );
      ops.push(
        tag(
          { ...gradleProperty(SIGNING_KEYS.storePassword, ''), secret: s.storePassword },
          {
            id: 'android.signing.storePassword',
            semanticKind: 'android.signing.set',
            source: 'android.signing.storePassword',
            status: 'update',
            files: ['android/gradle.properties'],
            desired: s.storePassword,
            risk: 'high',
          },
        ),
      );
      ops.push(
        tag(gradleProperty(SIGNING_KEYS.keyAlias, s.keyAlias), {
          id: 'android.signing.keyAlias',
          semanticKind: 'android.signing.set',
          source: 'android.signing',
          status: 'update',
          files: ['android/gradle.properties'],
          desired: s.keyAlias,
        }),
      );
      ops.push(
        tag(
          { ...gradleProperty(SIGNING_KEYS.keyPassword, ''), secret: s.keyPassword },
          {
            id: 'android.signing.keyPassword',
            semanticKind: 'android.signing.set',
            source: 'android.signing.keyPassword',
            status: 'update',
            files: ['android/gradle.properties'],
            desired: s.keyPassword,
            risk: 'high',
          },
        ),
      );

      const releaseBlock = [
        '        release {',
        `            storeFile file(${SIGNING_KEYS.storeFile})`,
        `            storePassword ${SIGNING_KEYS.storePassword}`,
        `            keyAlias ${SIGNING_KEYS.keyAlias}`,
        `            keyPassword ${SIGNING_KEYS.keyPassword}`,
        '        }',
      ].join('\n');

      ops.push(
        tag(
          {
            kind: 'androidGradleBlock',
            file: 'app',
            tag: 'expo-workspace-android-signing',
            anchor: 'signingConfigs\\s*\\{',
            offset: 1,
            comment: '//',
            contents: releaseBlock,
            label: 'android:signingConfig',
          },
          {
            id: 'android.signing.config',
            semanticKind: 'android.signing.set',
            source: 'android.signing',
            status: 'update',
            files: ['android/app/build.gradle'],
            risk: 'high',
          },
        ),
      );
      ops.push(
        tag(
          {
            kind: 'androidGradleReplace',
            file: 'app',
            find: '(buildTypes\\s*\\{[\\s\\S]*?release\\s*\\{[^}]*?signingConfig\\s+)signingConfigs\\.debug',
            replacement: '$1signingConfigs.release',
            all: false,
            label: 'android:signingConfig:release',
          },
          {
            id: 'android.signing.release',
            semanticKind: 'android.signing.set',
            source: 'android.signing',
            status: 'update',
            files: ['android/app/build.gradle'],
          },
        ),
      );
    }

    return { ops, warnings };
  },
};

function tryResolveSecret(value: unknown, label: string, warnings: string[]): string {
  try {
    return resolveSecret(value, label);
  } catch (error) {
    warnings.push((error as Error).message.replace(/^\[expo-native-config\]\s*/, ''));
    return '';
  }
}
