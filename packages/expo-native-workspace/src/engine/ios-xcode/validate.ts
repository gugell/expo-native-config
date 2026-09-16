import { ERR, assertBuildConfiguration } from '../core';

import type { SchemeDefinition } from './types';

const INVALID_SCHEME_CHARS = /[\\/:*?"<>|]/;

export function normalizeSchemeDefinitions(
  schemes: SchemeDefinition[] | undefined,
): SchemeDefinition[] {
  if (!Array.isArray(schemes) || schemes.length === 0) {
    return [];
  }
  const seen = new Set<string>();

  return schemes.map((scheme, index) => {
    if (!scheme?.name?.trim() || !scheme.configuration) {
      throw new Error(
        `${ERR} schemes[${index}] requires "name" and "configuration" ("Debug" | "Release").`,
      );
    }
    const name = scheme.name.trim();
    if (INVALID_SCHEME_CHARS.test(name)) {
      throw new Error(`${ERR} schemes[${index}].name contains invalid path characters: "${name}"`);
    }
    if (seen.has(name)) {
      throw new Error(`${ERR} Duplicate scheme name "${name}" in schemes configuration.`);
    }
    seen.add(name);

    assertBuildConfiguration(scheme.configuration, `schemes[${index}].configuration`);
    if (scheme.archive) {
      assertBuildConfiguration(scheme.archive, `schemes[${index}].archive`);
    }
    if (scheme.analyze) {
      assertBuildConfiguration(scheme.analyze, `schemes[${index}].analyze`);
    }
    return { ...scheme, name };
  });
}
