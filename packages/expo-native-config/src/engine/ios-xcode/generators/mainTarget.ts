import path from 'path';
import { PBXFileReference, PBXShellScriptBuildPhase, type XcodeProject } from '@bacons/xcode';
import { pbxOp } from '../pbxOp';
import { withMeta } from '../../core';
import type { CopyFileOp, Generator, Op } from '../../core';

import type { RunScriptSpec } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const SCRIPT_MARKER = '# @generated expo-native-config';

function mainTarget(project: XcodeProject): any {
  const target = project.rootObject.getMainAppTarget('ios');
  if (!target) {
    throw new Error('[expo-native-config] Could not find the main iOS application target.');
  }
  return target;
}

/** Body written into the phase, carrying the marker used to recognize our own phase. */
function scriptBody(spec: RunScriptSpec): string {
  return `${SCRIPT_MARKER}: ${spec.name}\n${spec.script}\n`;
}

/**
 * Creates or updates one shell-script phase per declared script. The phase is
 * matched by its `name`, so repeated prebuilds update in place rather than
 * appending a second copy.
 */
export function applyRunScripts(project: XcodeProject, scripts: RunScriptSpec[]): void {
  const target = mainTarget(project);
  const phases = target.props.buildPhases as any[];
  for (const spec of scripts) {
    const props = {
      name: spec.name,
      shellPath: spec.shell ?? '/bin/sh',
      shellScript: scriptBody(spec),
      inputPaths: spec.inputPaths ?? [],
      outputPaths: spec.outputPaths ?? [],
      inputFileListPaths: spec.inputFileListPaths ?? [],
      outputFileListPaths: spec.outputFileListPaths ?? [],
      runOnlyForDeploymentPostprocessing: spec.runOnlyForDeploymentPostprocessing ? 1 : 0,
      ...(spec.alwaysOutOfDate ? { alwaysOutOfDate: 1 } : {}),
      files: [],
    };
    const existing = phases.find(
      (phase) => PBXShellScriptBuildPhase.is(phase) && phase.props.name === spec.name,
    );
    if (existing) {
      Object.assign(existing.props, props);
      continue;
    }
    target.createBuildPhase(PBXShellScriptBuildPhase, props as any);
  }
}

/**
 * Adds copied resources to the main target's Resources phase. Paths are the
 * basenames written next to the generated project by the matching copy op, so a
 * repeated prebuild finds the existing reference instead of adding a second one.
 */
export function applyResources(project: XcodeProject, resourceNames: string[]): void {
  const target = mainTarget(project);
  const phase = target.getResourcesBuildPhase();
  const group = project.rootObject.props.mainGroup as any;
  for (const name of resourceNames) {
    if (phase.includesFile(name)) {
      continue;
    }
    const existing = (group.props.children as any[]).find(
      (child) => PBXFileReference.is(child) && child.props.path === name,
    );
    const fileRef = existing ?? group.createFile({ path: name, sourceTree: 'SOURCE_ROOT' } as any);
    phase.ensureFile({ fileRef } as any);
  }
}

export const mainTargetGenerator: Generator = {
  name: 'iosMainTarget',
  generate({ manifest }) {
    const ops: Op[] = [];
    const buildSettings = manifest.iosBuildSettings as Record<string, string> | undefined;
    const scripts = (manifest.runScripts as RunScriptSpec[] | undefined) ?? [];
    const resources = (manifest.iosResources as string[] | undefined) ?? [];

    if (buildSettings && Object.keys(buildSettings).length > 0) {
      ops.push(
        withMeta(
          pbxOp('ios:buildSettings', ({ project }) => {
            const target = mainTarget(project);
            for (const [key, value] of Object.entries(buildSettings)) {
              target.setBuildSetting(key, value);
            }
          }),
          {
            id: 'ios.buildSettings',
            platform: 'ios',
            semanticKind: 'ios.target.buildSetting.set',
            source: 'ios.buildSettings',
            status: 'update',
            files: ['ios/*.xcodeproj/project.pbxproj'],
            desired: buildSettings,
          },
        ),
      );
    }

    if (scripts.length > 0) {
      ops.push(
        withMeta(
          pbxOp('ios:runScripts', ({ project }) => {
            applyRunScripts(project, scripts);
          }),
          {
            id: 'ios.runScripts',
            platform: 'ios',
            semanticKind: 'ios.target.runScript.add',
            source: 'ios.runScripts',
            status: 'add',
            files: ['ios/*.xcodeproj/project.pbxproj'],
            risk: 'medium',
            desired: scripts.map((script) => script.name),
          },
        ),
      );
    }

    if (resources.length > 0) {
      const names = resources.map((resource) => path.basename(resource));
      const duplicate = names.find((name, index) => names.indexOf(name) !== index);
      if (duplicate) {
        throw new Error(
          `[expo-native-config] ios.resources has two entries named ${duplicate}; resources are copied next to the generated project by basename.`,
        );
      }
      for (const [index, resource] of resources.entries()) {
        ops.push(
          withMeta(
            {
              kind: 'copyFile',
              base: 'ios',
              from: resource,
              path: names[index],
              label: `ios:resource:${names[index]}`,
            } satisfies CopyFileOp,
            {
              id: `ios.resource.${names[index]}`,
              platform: 'ios',
              semanticKind: 'ios.target.resource.copy',
              source: 'ios.resources',
              status: 'add',
              files: [`ios/${names[index]}`],
              desired: resource,
            },
          ),
        );
      }
      ops.push(
        withMeta(
          pbxOp('ios:resources', ({ project }) => {
            applyResources(project, names);
          }),
          {
            id: 'ios.resources',
            platform: 'ios',
            semanticKind: 'ios.target.resource.add',
            source: 'ios.resources',
            status: 'add',
            files: ['ios/*.xcodeproj/project.pbxproj'],
            desired: resources,
          },
        ),
      );
    }

    return { ops };
  },
};
