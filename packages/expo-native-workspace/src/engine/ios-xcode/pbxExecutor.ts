import fs from 'fs';
import { withMod } from '@expo/config-plugins';
import type { Executor, Op } from '../core';
import { reportChange, reportSkip } from '../core';

import { openXcodeProject, serializeXcodeProject } from './openProject';
import { isPbxOp } from './pbxOp';

/**
 * Applies all pbx ops in a single `finalized` ios mod: open the project once via
 * @bacons/xcode, run every pbx op in order, serialize and write once (if changed).
 */
export const pbxExecutor: Executor = (config, ops: Op[]) => {
  const pbxOps = ops.filter(isPbxOp);
  if (pbxOps.length === 0) {
    return config;
  }

  return withMod(config, {
    platform: 'ios',
    mod: 'finalized',
    async action(config) {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const { project, pbxprojPath } = openXcodeProject(projectRoot);
      const original = fs.readFileSync(pbxprojPath, 'utf8');

      for (const op of pbxOps) {
        op.apply({ project, projectRoot, platformProjectRoot });
      }

      const next = serializeXcodeProject(project);
      if (next.trim().length > 0 && next !== original) {
        fs.writeFileSync(pbxprojPath, next);
        reportChange('pbxproj', pbxprojPath);
      } else {
        reportSkip('pbxproj', pbxprojPath);
      }
      return config;
    },
  });
};
