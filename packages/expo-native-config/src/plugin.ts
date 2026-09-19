import type { ConfigPlugin } from '@expo/config-plugins';
import { apply, configPlugins } from './engine';
import type { WorkspaceAppConfig } from './engine';
import { createSession } from './session';

const { name, version } = require('../package.json') as { name: string; version: string };

export interface PluginOptions {
  configPath?: string;
}
const withWorkspace: ConfigPlugin<PluginOptions | void> = (config, options) => {
  const projectRoot = config._internal?.projectRoot ?? process.cwd();
  const session = createSession(
    projectRoot,
    options?.configPath,
    config as unknown as WorkspaceAppConfig,
  );
  if (!session.valid) {
    throw new Error(
      '[expo-native-config] Invalid workspace configuration:\n' +
        session.diagnostics
          .filter((item) => item.severity === 'error')
          .map((item) => item.message)
          .join('\n'),
    );
  }
  return apply(config, session.plan);
};

/**
 * Guarded with `createRunOncePlugin`: a config that registers the plugin twice
 * (directly and through another plugin) would otherwise plan and apply every
 * operation twice.
 */
const plugin = configPlugins.createRunOncePlugin(withWorkspace, name, version);
export default plugin;
