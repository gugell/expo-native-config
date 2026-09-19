import { withPodfileProperties } from '@expo/config-plugins';
import type { Executor, Op } from '../core';

import { isPodfilePropertiesOp } from './types';

/** Writes `Podfile.properties.json` keys through Expo's own introspectable mod. */
export const podfilePropertiesExecutor: Executor = (config, ops: Op[]) => {
  const propertyOps = ops.filter(isPodfilePropertiesOp);
  if (propertyOps.length === 0) {
    return config;
  }
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return withPodfileProperties(config as any, (modConfig: any) => {
    for (const op of propertyOps) {
      Object.assign(modConfig.modResults, op.properties);
    }
    return modConfig;
  }) as typeof config;
};
