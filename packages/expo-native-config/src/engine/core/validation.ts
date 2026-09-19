export const ERR = '[expo-native-config]';

export type XcodeBuildConfiguration = 'Debug' | 'Release';

const BUILD_CONFIGURATIONS = new Set<XcodeBuildConfiguration>(['Debug', 'Release']);

export function assertBuildConfiguration(
  value: string,
  label: string,
): asserts value is XcodeBuildConfiguration {
  if (!BUILD_CONFIGURATIONS.has(value as XcodeBuildConfiguration)) {
    throw new Error(`${ERR} ${label} must be "Debug" or "Release", received "${value}".`);
  }
}

/** Match a target by exact name, prefix, or regex. Shared across pods/SPM/etc. */
export interface NameMatcher {
  equals?: string;
  startsWith?: string;
  regex?: string;
}

export function rubyLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Renders a `NameMatcher` (or raw string) to a Ruby predicate against `target.name`. */
export function nameMatcherToRuby(matcher: string | NameMatcher): string {
  if (typeof matcher === 'string') {
    return `target.name == ${rubyLiteral(matcher.trim())}`;
  }
  const conditions: string[] = [];
  if (matcher.equals) {
    conditions.push(`target.name == ${rubyLiteral(matcher.equals.trim())}`);
  }
  if (matcher.startsWith) {
    conditions.push(`target.name.start_with?(${rubyLiteral(matcher.startsWith.trim())})`);
  }
  if (matcher.regex) {
    conditions.push(`target.name =~ Regexp.new(${rubyLiteral(matcher.regex)})`);
  }
  return conditions.join(' && ');
}

export function assertNameMatcher(
  matcher: unknown,
  label: string,
): asserts matcher is string | NameMatcher {
  if (!matcher) {
    throw new Error(`${ERR} ${label} requires a target matcher.`);
  }
  if (typeof matcher === 'string') {
    if (!matcher.trim()) {
      throw new Error(`${ERR} ${label} matcher cannot be empty.`);
    }
    return;
  }
  const m = matcher as NameMatcher;
  if (!m.equals && !m.startsWith && !m.regex) {
    throw new Error(`${ERR} ${label} requires at least one of "equals" | "startsWith" | "regex".`);
  }
}
