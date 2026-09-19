import fs from 'fs';
import path from 'path';
import { IOSConfig } from '@expo/config-plugins';
import { XcodeProject } from '@bacons/xcode';

// `@bacons/xcode/json` is an exports-map subpath; require it for classic resolution.
const { build: buildPbxproj } = require('@bacons/xcode/json') as {
  build: (project: unknown) => string;
};

export interface OpenedProject {
  project: XcodeProject;
  pbxprojPath: string;
  xcodeprojPath: string;
  xcodeprojBasename: string;
  schemesDirectory: string;
}

export function openXcodeProject(appProjectRoot: string): OpenedProject {
  const pbxprojPath = IOSConfig.Paths.getPBXProjectPath(appProjectRoot);
  if (!fs.existsSync(pbxprojPath)) {
    throw new Error(
      `[expo-native-config] PBX project not found at ${pbxprojPath}. Run "expo prebuild" for iOS first.`,
    );
  }
  const xcodeprojPath = IOSConfig.Paths.getXcodeProjectPath(appProjectRoot);
  const xcodeprojBasename = path.basename(xcodeprojPath);
  const schemesDirectory = path.join(xcodeprojPath, 'xcshareddata', 'xcschemes');

  return {
    project: XcodeProject.open(pbxprojPath),
    pbxprojPath,
    xcodeprojPath,
    xcodeprojBasename,
    schemesDirectory,
  };
}

export function serializeXcodeProject(project: XcodeProject): string {
  return buildPbxproj(project.toJSON());
}
