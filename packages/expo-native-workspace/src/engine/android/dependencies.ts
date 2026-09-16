import { ERR } from '../core';

export type GradleConfiguration =
  | 'implementation'
  | 'api'
  | 'compileOnly'
  | 'runtimeOnly'
  | 'debugImplementation'
  | 'releaseImplementation';

export interface AndroidLibraryDependency {
  /** Gradle configuration. Defaults to `implementation`. */
  configuration?: GradleConfiguration;
  /** Maven coordinate, e.g. `androidx.work:work-runtime:2.9.0`. */
  module: string;
}

/** Raw Gradle line or a structured coordinate. */
export type AndroidDependency = string | AndroidLibraryDependency;

const CONFIGURATIONS = new Set<string>([
  'implementation',
  'api',
  'compileOnly',
  'runtimeOnly',
  'debugImplementation',
  'releaseImplementation',
]);

export function androidLibrary(
  module: string,
  configuration: GradleConfiguration = 'implementation',
): AndroidLibraryDependency {
  return { module, configuration };
}

export function renderAndroidDependency(dep: AndroidDependency, label: string): string {
  if (typeof dep === 'string') {
    const line = dep.trim();
    if (!line) {
      throw new Error(`${ERR} ${label} cannot be empty.`);
    }
    return line;
  }
  if (!dep || typeof dep !== 'object' || !dep.module?.trim()) {
    throw new Error(`${ERR} ${label} requires a non-empty "module".`);
  }
  const configuration = dep.configuration ?? 'implementation';
  if (!CONFIGURATIONS.has(configuration)) {
    throw new Error(`${ERR} ${label}.configuration "${configuration}" is not supported.`);
  }
  return `${configuration} '${dep.module.trim()}'`;
}

export function renderAndroidDependencies(deps: AndroidDependency[] | undefined): {
  lines: string[];
  desired: AndroidLibraryDependency[];
} {
  if (!deps?.length) {
    return { lines: [], desired: [] };
  }
  const lines: string[] = [];
  const desired: AndroidLibraryDependency[] = [];
  deps.forEach((dep, index) => {
    const line = renderAndroidDependency(dep, `android.dependencies[${index}]`);
    lines.push(`    ${line}`);
    desired.push(
      typeof dep === 'string'
        ? parseGradleCoordinate(line)
        : {
            configuration: dep.configuration ?? 'implementation',
            module: dep.module.trim(),
          },
    );
  });
  return { lines, desired };
}

function parseGradleCoordinate(line: string): AndroidLibraryDependency {
  const match = line.match(
    /^(implementation|api|compileOnly|runtimeOnly|debugImplementation|releaseImplementation)\s+['"]([^'"]+)['"]$/,
  );
  if (match) {
    return { configuration: match[1] as GradleConfiguration, module: match[2] };
  }
  return { configuration: 'implementation', module: line };
}
