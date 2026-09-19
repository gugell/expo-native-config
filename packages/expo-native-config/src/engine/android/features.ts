import { ERR } from '../core';

export interface AndroidUsesFeature {
  name: string;
  required?: boolean;
  glEsVersion?: string;
}

export type AndroidFeature = string | AndroidUsesFeature;

export function androidFeature(name: string, required = true): AndroidUsesFeature {
  return { name, required };
}

export function normalizeAndroidFeatures(
  features: AndroidFeature[] | undefined,
): AndroidUsesFeature[] {
  if (!features?.length) return [];
  return features.map((feature, index) => {
    const label = `android.features[${index}]`;
    if (typeof feature === 'string') {
      if (!feature.trim()) {
        throw new Error(`${ERR} ${label} cannot be empty.`);
      }
      return { name: feature.trim(), required: true };
    }
    if (!feature?.name?.trim()) {
      throw new Error(`${ERR} ${label} requires a non-empty "name".`);
    }
    return {
      name: feature.name.trim(),
      ...(feature.required !== undefined ? { required: feature.required } : {}),
      ...(feature.glEsVersion ? { glEsVersion: feature.glEsVersion } : {}),
    };
  });
}
