import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { mergeContents } from '@expo/config-plugins/build/utils/generateCode';
import { WorkspaceSchema } from '../src/schema';
import { androidGenerator } from '../src/engine/android/generators/android';
import type { AndroidGradleBlockOp, AndroidGradleReplaceOp } from '../src/engine/android/types';
import { toPlanOperation } from '../src/engine/core/ops';

function operations(optional = true) {
  return androidGenerator.generate({
    manifest: {
      manifestVersion: 1,
      android: { signing: { propertiesFile: 'codesign/codesign.properties', optional } },
    },
    projectRoot: path.resolve('/fixture/app'),
    config: {},
    configPath: '/fixture/app/workspace.config.ts',
  }).ops;
}
function apply(source: string) {
  let result = source;
  for (const op of operations()) {
    if (op.kind === 'androidGradleBlock') {
      const block = op as AndroidGradleBlockOp;
      result = mergeContents({
        tag: block.tag,
        src: result,
        newSrc: block.contents,
        anchor: new RegExp(block.anchor),
        offset: block.offset,
        comment: block.comment,
      }).contents;
    } else if (op.kind === 'androidGradleReplace') {
      const replace = op as AndroidGradleReplaceOp;
      result = result.replace(new RegExp(replace.find), replace.replacement);
    } else assert.fail(`Signing must not copy credentials: ${op.kind}`);
  }
  return result;
}
const template = `apply plugin: "com.android.application"
android {
    signingConfigs {
        debug { storeFile file('debug.keystore') }
    }
    buildTypes {
        debug { signingConfig signingConfigs.debug }
        release { signingConfig signingConfigs.debug }
    }
}
`;
test('properties signing preserves env API and rejects ambiguous mixed credential sources', () => {
  assert(
    WorkspaceSchema.safeParse({
      android: { signing: { propertiesFile: 'codesign/codesign.properties', optional: true } },
    }).success,
  );
  assert(
    WorkspaceSchema.safeParse({
      android: {
        signing: {
          storeFile: 'release.jks',
          keyAlias: 'release',
          storePassword: { env: 'STORE_PASSWORD' },
          keyPassword: { env: 'KEY_PASSWORD' },
        },
      },
    }).success,
  );
  assert(
    !WorkspaceSchema.safeParse({
      android: {
        signing: { propertiesFile: 'codesign.properties', storePassword: { env: 'PASSWORD' } },
      },
    }).success,
  );
});
test('properties signing plans only Gradle references without reading credential files', () => {
  const ops = operations();
  assert.equal(ops.length, 3);
  assert(ops.every((op) => op.kind === 'androidGradleBlock' || op.kind === 'androidGradleReplace'));
  const rendered = JSON.stringify(ops.map(toPlanOperation));
  assert(rendered.includes('codesign/codesign.properties'));
  const result = apply(template);
  assert(result.includes("rootProject.file('../codesign/codesign.properties')"));
  assert(result.includes('new File(workspaceSigningFile.parentFile'));
  assert(result.includes('debug { signingConfig signingConfigs.debug }'));
  assert(result.includes('release { signingConfig signingConfigs.release }'));
  assert.equal(apply(result), result);
});
test('optional credentials permit debug configuration but release tasks reject missing or debug credentials', () => {
  const result = apply(template);
  assert(!result.includes('Android release signing properties file is missing'));
  assert(result.includes("['validateSigning', 'assemble', 'bundle', 'package']"));
  assert(result.includes('effectiveSigning == android.signingConfigs.debug'));
  assert(result.includes('!effectiveSigning.storeFile.isFile()'));
  assert(result.includes('!effectiveSigning.storePassword'));
  assert(result.includes('throw new GradleException'));
  assert(
    JSON.stringify(operations(false)).includes(
      'Android release signing properties file is missing',
    ),
  );
});
