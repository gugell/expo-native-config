import { withMeta } from '../core';
import type { Generator, Op } from '../core';

import { hasLines } from './inject';
import type { AppDelegateOp, MainApplicationOp, SourceInjectionSpec } from './types';

const APP_DELEGATE_TAG = 'expo-native-workspace-app-delegate';
const MAIN_APPLICATION_TAG = 'expo-native-workspace-main-application';

interface AppDelegateSpec {
  imports?: string[];
  didFinishLaunching?: string[];
}
interface MainApplicationSpec {
  imports?: string[];
  onCreate?: string[];
}

/**
 * Injects app-owned lines into the generated iOS AppDelegate and Android
 * MainApplication. Both are generated files, so the lines live in the manifest
 * and are re-applied (in a replaceable tagged block) after every prebuild.
 */
export const sourceGenerator: Generator = {
  name: 'entryPoints',
  generate({ manifest }) {
    const ops: Op[] = [];
    const appDelegate = manifest.appDelegate as AppDelegateSpec | undefined;
    const android = manifest.android as { mainApplication?: MainApplicationSpec } | undefined;
    const mainApplication = android?.mainApplication;

    const appDelegateSpec: SourceInjectionSpec = {
      imports: appDelegate?.imports,
      body: appDelegate?.didFinishLaunching,
    };
    if (hasLines(appDelegateSpec)) {
      ops.push(
        withMeta(
          {
            kind: 'iosAppDelegate',
            tag: APP_DELEGATE_TAG,
            spec: appDelegateSpec,
            label: 'ios:appDelegate',
          } satisfies AppDelegateOp,
          {
            id: 'ios.appDelegate',
            platform: 'ios',
            semanticKind: 'ios.appDelegate.inject',
            source: 'ios.appDelegate',
            status: 'update',
            files: ['ios/*/AppDelegate.swift'],
            risk: 'escape-hatch',
            desired: appDelegateSpec,
          },
        ),
      );
    }

    const mainApplicationSpec: SourceInjectionSpec = {
      imports: mainApplication?.imports,
      body: mainApplication?.onCreate,
    };
    if (hasLines(mainApplicationSpec)) {
      ops.push(
        withMeta(
          {
            kind: 'androidMainApplication',
            tag: MAIN_APPLICATION_TAG,
            spec: mainApplicationSpec,
            label: 'android:mainApplication',
          } satisfies MainApplicationOp,
          {
            id: 'android.mainApplication',
            platform: 'android',
            semanticKind: 'android.mainApplication.inject',
            source: 'android.mainApplication',
            status: 'update',
            files: ['android/app/src/main/java/**/MainApplication.kt'],
            risk: 'escape-hatch',
            desired: mainApplicationSpec,
          },
        ),
      );
    }

    return { ops };
  },
};
