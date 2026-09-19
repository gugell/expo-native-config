import path from 'path';
import { withMeta } from '../../core';
import type { BaseOp, Generator, Op, OpMeta, WriteFileOp } from '../../core';

import type {
  AndroidGradleBlockOp,
  AndroidGradleRemoveBlockOp,
  AndroidGradleReplaceOp,
  AndroidResourceFileSpec,
  AndroidSlice,
  BuildConfigFieldSpec,
  GradleFile,
  GradleReplaceRule,
  MavenRepository,
  MavenRepositorySpec,
} from '../types';

const TAGS = {
  repositories: 'expo-native-config-android-repositories',
  buildscript: 'expo-native-config-android-buildscript',
  plugins: 'expo-native-config-android-plugins',
  defaultConfig: 'expo-native-config-android-default-config',
  resolution: 'expo-native-config-android-resolution',
  modules: 'expo-native-config-android-modules',
} as const;

/**
 * Anchors match a single LINE: `mergeContents` splits the file and matches line
 * by line, so no multi-line pattern can ever hit. Blocks that have no reliable
 * single-line anchor are appended instead (`append: true`).
 */
const ANCHORS = {
  /** First `dependencies {` in the root build.gradle is buildscript's. */
  buildscriptDependencies: String.raw`^\s*dependencies\s*\{`,
  defaultConfig: String.raw`^\s*defaultConfig\s*\{`,
} as const;

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function block(
  file: GradleFile,
  tag: string,
  anchor: string,
  contents: string,
  label: string,
  offset = 1,
): AndroidGradleBlockOp {
  return { kind: 'androidGradleBlock', file, tag, anchor, offset, comment: '//', contents, label };
}

/** A block with no dependable anchor line; appended at the end of the file. */
function appended(
  file: GradleFile,
  tag: string,
  contents: string,
  label: string,
): AndroidGradleBlockOp {
  return {
    kind: 'androidGradleBlock',
    file,
    tag,
    anchor: '^',
    offset: 0,
    comment: '//',
    contents,
    label,
    append: true,
  };
}

function clear(file: GradleFile, tag: string, label: string): AndroidGradleRemoveBlockOp {
  return { kind: 'androidGradleRemoveBlock', file, tag, label };
}

function repositoryLines(repositories: MavenRepository[]): string[] {
  return repositories.flatMap((repository) => {
    const spec: MavenRepositorySpec =
      typeof repository === 'string' ? { url: repository } : repository;
    const lines = [`        maven {`, `            url ${quote(spec.url)}`];
    if (spec.credentials) {
      lines.push(
        '            credentials {',
        `                username System.getenv(${quote(spec.credentials.username.env)})`,
        `                password System.getenv(${quote(spec.credentials.password.env)})`,
        '            }',
      );
    }
    for (const group of spec.includeGroups ?? []) {
      lines.push(
        '            content {',
        `                includeGroup ${quote(group)}`,
        '            }',
      );
    }
    lines.push('        }');
    return lines;
  });
}

function flatDirLines(flatDirs: string[]): string[] {
  return flatDirs.flatMap((dir) => [
    '        flatDir {',
    `            dirs ${quote(path.posix.join('../..', dir))}`,
    '        }',
  ]);
}

function buildConfigFieldLine(field: BuildConfigFieldSpec): string {
  return `        buildConfigField ${quote(field.type)}, ${quote(field.name)}, ${quote(field.value)}`;
}

/**
 * The Gradle surface beyond SDK versions and app dependencies: repositories,
 * buildscript classpath, applied plugins, defaultConfig entries, dependency
 * resolution, included local modules, autolinking exclusions, res files, and a
 * regex escape hatch per Gradle file.
 */
export const gradleExtrasGenerator: Generator = {
  name: 'androidGradleExtras',
  generate({ manifest }) {
    const slice = (manifest as { android?: AndroidSlice }).android;
    if (!slice || typeof slice !== 'object') {
      return { ops: [] };
    }
    const ops: Op[] = [];
    const tag = <T extends BaseOp>(op: T, meta: OpMeta): number => ops.push(withMeta(op, meta));

    // --- repositories + flatDir (root build.gradle, allprojects) -----------
    const repositories = slice.mavenRepositories ?? [];
    const flatDirs = slice.flatDirs ?? [];
    if (repositories.length > 0 || flatDirs.length > 0) {
      tag(
        appended(
          'project',
          TAGS.repositories,
          [
            'allprojects {',
            '    repositories {',
            ...repositoryLines(repositories),
            ...flatDirLines(flatDirs),
            '    }',
            '}',
          ].join('\n'),
          'android:repositories',
        ),
        {
          id: 'android.repositories',
          platform: 'android',
          semanticKind: 'android.repository.add',
          source: 'android.mavenRepositories',
          status: 'add',
          files: ['android/build.gradle'],
          desired: { repositories, flatDirs },
        },
      );
    } else {
      tag(clear('project', TAGS.repositories, 'android:repositories'), {
        id: 'android.repositories',
        platform: 'android',
        semanticKind: 'android.repository.add',
        source: 'android.mavenRepositories',
        status: 'remove',
        phase: 'cleanup',
        files: ['android/build.gradle'],
      });
    }

    // --- buildscript classpath --------------------------------------------
    const classpath = slice.buildscriptDependencies ?? [];
    if (classpath.length > 0) {
      tag(
        block(
          'project',
          TAGS.buildscript,
          ANCHORS.buildscriptDependencies,
          classpath.map((coordinate) => `        classpath ${quote(coordinate)}`).join('\n'),
          'android:buildscriptDependencies',
        ),
        {
          id: 'android.buildscriptDependencies',
          platform: 'android',
          semanticKind: 'android.buildscript.classpath.add',
          source: 'android.buildscriptDependencies',
          status: 'add',
          files: ['android/build.gradle'],
          desired: classpath,
        },
      );
    } else {
      tag(clear('project', TAGS.buildscript, 'android:buildscriptDependencies'), {
        id: 'android.buildscriptDependencies',
        platform: 'android',
        semanticKind: 'android.buildscript.classpath.add',
        source: 'android.buildscriptDependencies',
        status: 'remove',
        phase: 'cleanup',
        files: ['android/build.gradle'],
      });
    }

    // --- resolutionStrategy.force -----------------------------------------
    const force = slice.forceDependencies ?? [];
    if (force.length > 0) {
      tag(
        appended(
          'project',
          TAGS.resolution,
          [
            'allprojects {',
            '    configurations.all {',
            '        resolutionStrategy {',
            ...force.map((coordinate) => `            force ${quote(coordinate)}`),
            '        }',
            '    }',
            '}',
          ].join('\n'),
          'android:forceDependencies',
        ),
        {
          id: 'android.forceDependencies',
          platform: 'android',
          semanticKind: 'android.dependency.force',
          source: 'android.forceDependencies',
          status: 'update',
          files: ['android/build.gradle'],
          risk: 'medium',
          desired: force,
        },
      );
    } else {
      tag(clear('project', TAGS.resolution, 'android:forceDependencies'), {
        id: 'android.forceDependencies',
        platform: 'android',
        semanticKind: 'android.dependency.force',
        source: 'android.forceDependencies',
        status: 'remove',
        phase: 'cleanup',
        files: ['android/build.gradle'],
      });
    }

    // --- applied plugins (app build.gradle) --------------------------------
    const plugins = slice.plugins ?? [];
    if (plugins.length > 0) {
      tag(
        appended(
          'app',
          TAGS.plugins,
          plugins.map((id) => `apply plugin: ${quote(id)}`).join('\n'),
          'android:plugins',
        ),
        {
          id: 'android.plugins',
          platform: 'android',
          semanticKind: 'android.plugin.apply',
          source: 'android.plugins',
          status: 'add',
          files: ['android/app/build.gradle'],
          desired: plugins,
        },
      );
    } else {
      tag(clear('app', TAGS.plugins, 'android:plugins'), {
        id: 'android.plugins',
        platform: 'android',
        semanticKind: 'android.plugin.apply',
        source: 'android.plugins',
        status: 'remove',
        phase: 'cleanup',
        files: ['android/app/build.gradle'],
      });
    }

    // --- defaultConfig: abiFilters, placeholders, buildConfigFields --------
    const abiFilters = slice.abiFilters ?? [];
    const placeholders = slice.manifestPlaceholders ?? {};
    const buildConfigFields = slice.buildConfigFields ?? [];
    const defaultConfigLines: string[] = [];
    if (abiFilters.length > 0) {
      defaultConfigLines.push(
        '        ndk {',
        `            abiFilters ${abiFilters.map(quote).join(', ')}`,
        '        }',
      );
    }
    if (Object.keys(placeholders).length > 0) {
      const entries = Object.entries(placeholders)
        .map(([key, value]) => `${key}: ${quote(value)}`)
        .join(', ');
      defaultConfigLines.push(`        manifestPlaceholders += [${entries}]`);
    }
    for (const field of buildConfigFields) {
      defaultConfigLines.push(buildConfigFieldLine(field));
    }
    if (defaultConfigLines.length > 0) {
      tag(
        block(
          'app',
          TAGS.defaultConfig,
          ANCHORS.defaultConfig,
          defaultConfigLines.join('\n'),
          'android:defaultConfig',
        ),
        {
          id: 'android.defaultConfig',
          platform: 'android',
          semanticKind: 'android.defaultConfig.set',
          source: 'android.abiFilters/manifestPlaceholders/buildConfigFields',
          status: 'update',
          files: ['android/app/build.gradle'],
          desired: { abiFilters, manifestPlaceholders: placeholders, buildConfigFields },
        },
      );
      if (buildConfigFields.length > 0) {
        tag(
          {
            kind: 'androidGradleProperty',
            key: 'android.defaults.buildfeatures.buildconfig',
            value: 'true',
            label: 'android:gradleProperty:buildConfig',
          },
          {
            id: 'android.buildConfig.enabled',
            platform: 'android',
            semanticKind: 'android.gradle.property.set',
            source: 'android.buildConfigFields',
            status: 'update',
            files: ['android/gradle.properties'],
            desired: true,
          },
        );
      }
    } else {
      tag(clear('app', TAGS.defaultConfig, 'android:defaultConfig'), {
        id: 'android.defaultConfig',
        platform: 'android',
        semanticKind: 'android.defaultConfig.set',
        source: 'android.abiFilters/manifestPlaceholders/buildConfigFields',
        status: 'remove',
        phase: 'cleanup',
        files: ['android/app/build.gradle'],
      });
    }

    // React Native compiles per architecture off its own property, so an ABI
    // filter that only reaches AGP still ships jniLibs for every architecture.
    if (abiFilters.length > 0) {
      tag(
        {
          kind: 'androidGradleProperty',
          key: 'reactNativeArchitectures',
          value: abiFilters.join(','),
          label: 'android:gradleProperty:reactNativeArchitectures',
        },
        {
          id: 'android.abiFilters.architectures',
          platform: 'android',
          semanticKind: 'android.gradle.property.set',
          source: 'android.abiFilters',
          status: 'update',
          files: ['android/gradle.properties'],
          desired: abiFilters,
        },
      );
    }

    // --- settings.gradle: local modules + autolinking exclusions -----------
    const modules = slice.modules ?? [];
    if (modules.length > 0) {
      const lines = modules.flatMap((module) => [
        `include ':${module.name}'`,
        `project(':${module.name}').projectDir = new File(rootProject.projectDir, ${quote(
          path.posix.join('..', module.path),
        )})`,
      ]);
      tag(appended('settings', TAGS.modules, lines.join('\n'), 'android:modules'), {
        id: 'android.modules',
        platform: 'android',
        semanticKind: 'android.module.include',
        source: 'android.modules',
        status: 'add',
        files: ['android/settings.gradle'],
        desired: modules,
      });
    } else {
      tag(clear('settings', TAGS.modules, 'android:modules'), {
        id: 'android.modules',
        platform: 'android',
        semanticKind: 'android.module.include',
        source: 'android.modules',
        status: 'remove',
        phase: 'cleanup',
        files: ['android/settings.gradle'],
      });
    }

    const exclude = slice.autolinkingExclude ?? [];
    if (exclude.length > 0) {
      const marker = '// expo-native-config-autolinking-exclude';
      const list = exclude.map(quote).join(', ');
      // Autolinking is configured two different ways depending on the SDK:
      // `expoAutolinking.exclude = […]` before `expoAutolinking.useExpoModules()`
      // on newer templates, and an options map passed to a bare
      // `useExpoModules()` on older ones. Both rules carry the same marker, so
      // whichever applies first makes the other skip.
      const rules: Array<[string, string, string, boolean]> = [
        [
          'modern',
          String.raw`expoAutolinking\.useExpoModules\(\)`,
          `expoAutolinking.exclude = [${list}] ${marker}\nexpoAutolinking.useExpoModules()`,
          false,
        ],
        [
          // `required`, so a template with neither shape fails loudly instead of
          // silently shipping the module the config asked to exclude.
          'legacy',
          String.raw`(?<!expoAutolinking\.)useExpoModules\(\)`,
          `useExpoModules([exclude: [${list}]]) ${marker}`,
          true,
        ],
      ];
      for (const [variant, find, replacement, required] of rules) {
        tag(
          {
            kind: 'androidGradleReplace',
            file: 'settings',
            find,
            replacement,
            all: false,
            skipIfContains: marker,
            required,
            label: `android:autolinkingExclude:${variant}`,
          } satisfies AndroidGradleReplaceOp,
          {
            id: `android.autolinkingExclude.${variant}`,
            platform: 'android',
            semanticKind: 'android.autolinking.exclude',
            source: 'android.autolinkingExclude',
            status: 'update',
            files: ['android/settings.gradle'],
            desired: exclude,
          },
        );
      }
    }

    // --- res files ---------------------------------------------------------
    for (const resource of (slice.resources ?? []) as AndroidResourceFileSpec[]) {
      tag(
        {
          kind: 'writeFile',
          base: 'android',
          path: `app/src/main/res/${resource.path}`,
          contents: resource.contents,
          overwrite: resource.overwrite ?? 'always',
          label: `android:res:${resource.path}`,
        } satisfies WriteFileOp,
        {
          id: `android.resource.${resource.path}`,
          platform: 'android',
          semanticKind: 'android.resource.write',
          source: 'android.resources',
          status: 'add',
          files: [`android/app/src/main/res/${resource.path}`],
          desired: resource.path,
        },
      );
    }

    // --- regex escape hatch per Gradle file --------------------------------
    for (const file of ['app', 'project', 'settings'] as GradleFile[]) {
      const rules = (slice.gradle?.[file] ?? []) as GradleReplaceRule[];
      for (const [index, rule] of rules.entries()) {
        tag(
          {
            kind: 'androidGradleReplace',
            file,
            find: rule.find,
            replacement: rule.replacement,
            all: rule.all ?? false,
            skipIfContains: rule.skipIfContains,
            required: rule.required,
            label: `android:gradle:${file}:replace:${index}`,
          } satisfies AndroidGradleReplaceOp,
          {
            id: `android.gradle.${file}.replace.${index}`,
            platform: 'android',
            semanticKind: 'android.gradle.replace',
            source: `android.gradle.${file}[${index}]`,
            status: 'update',
            files: [
              file === 'app'
                ? 'android/app/build.gradle'
                : `android/${file === 'project' ? 'build' : 'settings'}.gradle`,
            ],
            risk: 'escape-hatch',
            desired: rule,
          },
        );
      }
    }

    return { ops };
  },
};
