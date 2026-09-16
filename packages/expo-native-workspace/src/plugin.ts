import type { ConfigPlugin } from '@expo/config-plugins';
import { apply } from './engine';
import type { WorkspaceAppConfig } from './engine';
import { createSession } from './session';

export interface PluginOptions {
  configPath?: string;
}
const plugin: ConfigPlugin<PluginOptions | void> = (config, options) => {
  const projectRoot = config._internal?.projectRoot ?? process.cwd();
  const session = createSession(
    projectRoot,
    options?.configPath,
    config as unknown as WorkspaceAppConfig,
  );
  if (!session.valid) {
    throw new Error(
      '[expo-native-workspace] Invalid workspace configuration:\n' +
        session.diagnostics
          .filter((item) => item.severity === 'error')
          .map((item) => item.message)
          .join('\n'),
    );
  }
  return apply(config, session.plan);
};
export default plugin;
