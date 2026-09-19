import path from 'node:path';
import { withMeta } from '../core';
import type { AndroidOp, AndroidPropertiesSigningConfig } from './types';

function groovyString(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\r', '\\r').replaceAll('\n', '\\n')}'`;
}

/** Render references only. Credential files are read by Gradle, never by prebuild. */
export function propertiesSigningOps(
  config: AndroidPropertiesSigningConfig,
  projectRoot: string,
): AndroidOp[] {
  const propertiesPath = path
    .relative(path.join(projectRoot, 'android'), path.resolve(projectRoot, config.propertiesFile))
    .split(path.sep)
    .join('/');
  const setup = `def workspaceSigningFile = rootProject.file(${groovyString(propertiesPath)})
def workspaceSigningProperties = new Properties()
if (workspaceSigningFile.isFile()) {
    workspaceSigningFile.withInputStream { workspaceSigningProperties.load(it) }
}${
    config.optional
      ? ''
      : ` else {
    throw new GradleException("Android release signing properties file is missing")
}`
  }
def workspaceSigningKeys = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']
def workspaceSigningComplete = workspaceSigningKeys.every { workspaceSigningProperties.getProperty(it)?.trim() }
def workspaceSigningStore = workspaceSigningComplete ? new File(workspaceSigningProperties.getProperty('storeFile')) : null
if (workspaceSigningStore != null && !workspaceSigningStore.isAbsolute()) {
    workspaceSigningStore = new File(workspaceSigningFile.parentFile, workspaceSigningProperties.getProperty('storeFile'))
}
// Validate only release signing tasks; missing optional credentials do not block debug builds.
tasks.configureEach { task ->
    if (task.name.contains('Release') && ['validateSigning', 'assemble', 'bundle', 'package'].any { task.name.startsWith(it) }) {
        task.doFirst {
            def effectiveSigning = android.buildTypes.release.signingConfig
            // EAS may inject a complete release configuration after prebuild.
            if (effectiveSigning == null || effectiveSigning == android.signingConfigs.debug ||
                effectiveSigning.storeFile == null || !effectiveSigning.storeFile.isFile() ||
                !effectiveSigning.storePassword || !effectiveSigning.keyAlias || !effectiveSigning.keyPassword) {
                throw new GradleException("Android release signing requires complete credentials and an existing keystore; debug signing is not allowed")
            }
        }
    }
}`;
  const release = `        release {
            if (workspaceSigningComplete) {
                storeFile workspaceSigningStore
                storePassword workspaceSigningProperties.getProperty('storePassword')
                keyAlias workspaceSigningProperties.getProperty('keyAlias')
                keyPassword workspaceSigningProperties.getProperty('keyPassword')
            }
        }`;
  const entries: AndroidOp[] = [
    {
      kind: 'androidGradleBlock',
      file: 'app',
      tag: 'expo-workspace-android-signing-properties',
      anchor: '^android\\s*\\{',
      offset: 0,
      comment: '//',
      contents: setup,
      label: 'android:signingProperties',
    },
    {
      kind: 'androidGradleBlock',
      file: 'app',
      tag: 'expo-workspace-android-signing',
      anchor: 'signingConfigs\\s*\\{',
      offset: 1,
      comment: '//',
      contents: release,
      label: 'android:signingConfig',
    },
    {
      kind: 'androidGradleReplace',
      file: 'app',
      find: '(buildTypes\\s*\\{[\\s\\S]*?release\\s*\\{[^}]*?signingConfig\\s+)signingConfigs\\.debug',
      replacement: '$1signingConfigs.release',
      all: false,
      label: 'android:signingConfig:release',
    },
  ];
  return entries.map((op, index) =>
    withMeta(op, {
      id: ['android.signing.properties', 'android.signing.config', 'android.signing.release'][
        index
      ],
      platform: 'android',
      semanticKind: 'android.signing.set',
      source: 'android.signing',
      status: 'update',
      files: ['android/app/build.gradle'],
      risk: 'high',
      ...(index === 0
        ? { desired: { propertiesFile: config.propertiesFile, optional: config.optional ?? false } }
        : {}),
    }),
  );
}
