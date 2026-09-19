import { ERR } from '../core';

export type GradleConfiguration =
  | 'implementation'
  | 'api'
  | 'compileOnly'
  | 'runtimeOnly'
  | 'debugImplementation'
  | 'releaseImplementation';

export interface AndroidDependencyExclude {
  group: string;
  module?: string;
}

export interface AndroidLibraryDependency {
  /** Gradle configuration. Defaults to `implementation`. */
  configuration?: GradleConfiguration;
  /** Maven coordinate, e.g. `androidx.work:work-runtime:2.9.0`. */
  module: string;
  /** Transitive dependencies to drop from this entry. */
  exclude?: AndroidDependencyExclude[];
}

/** A local Gradle module, e.g. one included from settings.gradle. */
export interface AndroidProjectDependency {
  configuration?: GradleConfiguration;
  /** Gradle project name without the leading colon. */
  project: string;
}

/** A BOM, rendered as `implementation platform('…')`. */
export interface AndroidPlatformDependency {
  configuration?: GradleConfiguration;
  platform: string;
}

/** Raw Gradle line or a structured entry. */
export type AndroidDependency =
  string | AndroidLibraryDependency | AndroidProjectDependency | AndroidPlatformDependency;

const CONFIGURATIONS = new Set<string>([
  'implementation',
  'api',
  'compileOnly',
  'runtimeOnly',
  'debugImplementation',
  'releaseImplementation',
  'androidTestImplementation',
  'testImplementation',
]);

export function androidLibrary(
  module: string,
  configuration: GradleConfiguration = 'implementation',
): AndroidLibraryDependency {
  return { module, configuration };
}

function resolveConfiguration(dep: { configuration?: string }, label: string): string {
  const configuration = dep.configuration ?? 'implementation';
  if (!CONFIGURATIONS.has(configuration)) {
    throw new Error(`${ERR} ${label}.configuration "${configuration}" is not supported.`);
  }
  return configuration;
}

export function renderAndroidDependency(dep: AndroidDependency, label: string): string {
  if (typeof dep === 'string') {
    const line = dep.trim();
    if (!line) {
      throw new Error(`${ERR} ${label} cannot be empty.`);
    }
    return line;
  }
  if (!dep || typeof dep !== 'object') {
    throw new Error(`${ERR} ${label} must be an object or a Gradle line.`);
  }
  if ('project' in dep && dep.project?.trim()) {
    return `${resolveConfiguration(dep, label)} project(':${dep.project.trim()}')`;
  }
  if ('platform' in dep && dep.platform?.trim()) {
    return `${resolveConfiguration(dep, label)} platform('${dep.platform.trim()}')`;
  }
  if (!('module' in dep) || !dep.module?.trim()) {
    throw new Error(`${ERR} ${label} requires "module", "project" or "platform".`);
  }
  const configuration = resolveConfiguration(dep, label);
  const line = `${configuration} '${dep.module.trim()}'`;
  if (!dep.exclude?.length) {
    return line;
  }
  const excludes = dep.exclude.map(
    (entry) =>
      `        exclude group: '${entry.group}'${entry.module ? `, module: '${entry.module}'` : ''}`,
  );
  return [`${line} {`, ...excludes, '    }'].join('\n');
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
            module:
              'module' in dep
                ? dep.module.trim()
                : 'project' in dep
                  ? `project(':${dep.project.trim()}')`
                  : `platform('${dep.platform.trim()}')`,
          },
    );
  });
  return { lines, desired };
}

function parseGradleCoordinate(line: string): AndroidLibraryDependency {
  const match = line.match(
    /^(implementation|api|compileOnly|runtimeOnly|debugImplementation|releaseImplementation|androidTestImplementation|testImplementation)\s+['"]([^'"]+)['"]$/,
  );
  if (match) {
    return { configuration: match[1] as GradleConfiguration, module: match[2] };
  }
  return { configuration: 'implementation', module: line };
}
