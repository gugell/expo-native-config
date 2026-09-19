import fs from 'fs';
import path from 'path';
import type { ConfigPlugin } from '@expo/config-plugins';
import { withDangerousMod } from '@expo/config-plugins';
import { mergeContents, removeContents } from '@expo/config-plugins/build/utils/generateCode';

import { reportChange, reportSkip } from './report';
import type { Executor, FileBase, FileOp, MergeBlockOp, Op } from './types';
import { isFileOp } from './types';

const ERR = '[expo-native-workspace]';

/** Merge a tagged block, retaining Expo's sync hash for repeated application. */
export function mergeFileBlock(original: string, op: MergeBlockOp): string {
  const options = {
    tag: op.tag,
    src: original,
    newSrc: op.newSrc,
    anchor: op.anchor,
    offset: op.offset,
    comment: op.comment,
  };
  try {
    return mergeContents(options).contents;
  } catch (error) {
    if (!op.appendIfNoAnchor || (error as { code?: string }).code !== 'ERR_NO_MATCH') throw error;
    const block = mergeContents({ ...options, src: '', anchor: /^$/, offset: 0 }).contents;
    const clean = removeContents({ src: original, tag: op.tag }).contents;
    return `${clean.trimEnd()}\n\n${block}\n`;
  }
}

function applyFileOps(platform: 'ios' | 'android', ops: FileOp[]): ConfigPlugin {
  return (config) =>
    withDangerousMod(config, [
      platform,
      async (config) => {
        const { platformProjectRoot, projectRoot } = config.modRequest;
        const baseDir = (base: FileBase | undefined): string =>
          base === 'project' ? projectRoot : platformProjectRoot;

        for (const op of ops) {
          if (op.kind === 'writeFile') {
            const filePath = path.resolve(baseDir(op.base), op.path);
            if (op.overwrite === 'ifAbsent' && fs.existsSync(filePath)) {
              reportSkip(op.label, filePath);
              continue;
            }
            if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === op.contents) {
              reportSkip(op.label, filePath);
              continue;
            }
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, op.contents, 'utf8');
            reportChange(op.label, filePath);
            continue;
          }

          if (op.kind === 'mergeBlock') {
            const filePath = path.resolve(baseDir(op.base), op.path);
            if (!fs.existsSync(filePath)) {
              throw new Error(`${ERR} ${op.label}: file not found at ${filePath}.`);
            }
            const original = fs.readFileSync(filePath, 'utf8');
            const contents = mergeFileBlock(original, op);
            if (contents !== original) {
              fs.writeFileSync(filePath, contents, 'utf8');
              reportChange(op.label, filePath);
            } else {
              reportSkip(op.label, filePath);
            }
            continue;
          }

          if (op.kind === 'copyFile') {
            const source = path.resolve(projectRoot, op.from);
            if (!fs.existsSync(source)) {
              throw new Error(`${ERR} ${op.label}: source file not found at ${source}.`);
            }
            const filePath = path.resolve(baseDir(op.base), op.path);
            const next = fs.readFileSync(source);
            if (fs.existsSync(filePath) && fs.readFileSync(filePath).equals(next)) {
              reportSkip(op.label, filePath);
              continue;
            }
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, next);
            reportChange(op.label, filePath);
            continue;
          }

          if (op.kind === 'replaceInFile') {
            const filePath = path.resolve(baseDir(op.base), op.path);
            if (!fs.existsSync(filePath)) {
              throw new Error(`${ERR} ${op.label}: file not found at ${filePath}.`);
            }
            const original = fs.readFileSync(filePath, 'utf8');
            if (op.skipIfContains && original.includes(op.skipIfContains)) {
              reportSkip(op.label, filePath);
              continue;
            }
            const pattern = new RegExp(op.find, op.all ? 'g' : '');
            if (!pattern.test(original)) {
              if (op.required) {
                throw new Error(
                  `${ERR} ${op.label}: pattern /${op.find}/ did not match anything in ${filePath}.`,
                );
              }
              reportSkip(op.label, filePath);
              continue;
            }
            const contents = original.replace(
              new RegExp(op.find, op.all ? 'g' : ''),
              op.replacement,
            );
            if (contents !== original) {
              fs.writeFileSync(filePath, contents, 'utf8');
              reportChange(op.label, filePath);
            } else {
              reportSkip(op.label, filePath);
            }
            continue;
          }

          if (op.kind === 'removeBlock') {
            const filePath = path.resolve(baseDir(op.base), op.path);
            if (!fs.existsSync(filePath)) {
              continue;
            }
            const original = fs.readFileSync(filePath, 'utf8');
            if (!original.includes(op.tag)) {
              continue;
            }
            const contents = removeContents({ src: original, tag: op.tag }).contents;
            if (contents !== original) {
              fs.writeFileSync(filePath, contents, 'utf8');
              reportChange(op.label, filePath);
            }
            continue;
          }

          if (op.kind === 'appendOnce') {
            const filePath = path.resolve(baseDir(op.base), op.path);
            if (!fs.existsSync(filePath)) {
              throw new Error(`${ERR} ${op.label}: file not found at ${filePath}.`);
            }
            const original = fs.readFileSync(filePath, 'utf8');
            if (original.includes(op.marker)) {
              reportSkip(op.label, filePath);
              continue;
            }
            fs.writeFileSync(filePath, `${original}\n\n${op.contents}`, 'utf8');
            reportChange(op.label, filePath);
            continue;
          }

          // deleteGlob
          const dirPath = path.resolve(baseDir(op.base), op.dir);
          if (!fs.existsSync(dirPath)) {
            continue;
          }
          for (const entry of fs.readdirSync(dirPath)) {
            if (op.match(entry)) {
              fs.unlinkSync(path.join(dirPath, entry));
              reportChange(op.label, path.join(dirPath, entry));
            }
          }
        }
        return config;
      },
    ]);
}

/** Applies all file ops, partitioned by platform mod (iOS + project under ios, Android under android). */
export const fileExecutor: Executor = (config, ops: Op[]) => {
  const fileOps = ops.filter(isFileOp);
  if (fileOps.length === 0) {
    return config;
  }
  const iosOps = fileOps.filter((o) => (o.base ?? 'ios') !== 'android');
  const androidOps = fileOps.filter((o) => o.base === 'android');

  if (iosOps.length > 0) {
    config = applyFileOps('ios', iosOps)(config, undefined as never);
  }
  if (androidOps.length > 0) {
    config = applyFileOps('android', androidOps)(config, undefined as never);
  }
  return config;
};
