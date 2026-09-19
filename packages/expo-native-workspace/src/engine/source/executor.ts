import { withAppDelegate, withMainApplication } from '@expo/config-plugins';
import type { Executor, Op } from '../core';

import { injectBlock } from './inject';
import type { AppDelegateOp, MainApplicationOp, SourceOp } from './types';
import { isSourceOp } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const IMPORT_LINE = /^(?:@[A-Za-z]+\s+)?import .+$/m;

/** Last line of the existing import run in a Swift/Kotlin/Java entry point. */
const importAnchor = IMPORT_LINE;

const DID_FINISH_LAUNCHING =
  /func application\([\s\S]*?didFinishLaunchingWithOptions[\s\S]*?\{|application:didFinishLaunchingWithOptions:[^\n]*\{/;
const ON_CREATE = /super\.onCreate\(\);?/;

function applyAppDelegate(contents: string, op: AppDelegateOp): string {
  let next = contents;
  if (op.spec.imports?.length) {
    next = injectBlock(next, {
      tag: `${op.tag}-imports`,
      lines: op.spec.imports,
      afterLast: importAnchor,
      comment: '//',
      label: op.label,
    });
  }
  if (op.spec.body?.length) {
    next = injectBlock(next, {
      tag: `${op.tag}-didFinishLaunching`,
      lines: op.spec.body,
      afterLast: DID_FINISH_LAUNCHING,
      comment: '//',
      indent: '    ',
      label: op.label,
    });
  }
  return next;
}

function applyMainApplication(contents: string, op: MainApplicationOp): string {
  let next = contents;
  if (op.spec.imports?.length) {
    next = injectBlock(next, {
      tag: `${op.tag}-imports`,
      lines: op.spec.imports,
      afterLast: importAnchor,
      comment: '//',
      label: op.label,
    });
  }
  if (op.spec.body?.length) {
    next = injectBlock(next, {
      tag: `${op.tag}-onCreate`,
      lines: op.spec.body,
      afterLast: ON_CREATE,
      comment: '//',
      indent: '    ',
      label: op.label,
    });
  }
  return next;
}

/** Applies entry-point source injections through Expo's own AppDelegate/MainApplication mods. */
export const sourceExecutor: Executor = (config, ops: Op[]) => {
  const sourceOps = ops.filter(isSourceOp) as SourceOp[];
  if (sourceOps.length === 0) {
    return config;
  }
  const appDelegate = sourceOps.filter((op): op is AppDelegateOp => op.kind === 'iosAppDelegate');
  const mainApplication = sourceOps.filter(
    (op): op is MainApplicationOp => op.kind === 'androidMainApplication',
  );

  let next = config;
  if (appDelegate.length > 0) {
    next = withAppDelegate(next as any, (modConfig: any) => {
      for (const op of appDelegate) {
        modConfig.modResults.contents = applyAppDelegate(modConfig.modResults.contents, op);
      }
      return modConfig;
    }) as typeof config;
  }
  if (mainApplication.length > 0) {
    next = withMainApplication(next as any, (modConfig: any) => {
      for (const op of mainApplication) {
        modConfig.modResults.contents = applyMainApplication(modConfig.modResults.contents, op);
      }
      return modConfig;
    }) as typeof config;
  }
  return next;
};
