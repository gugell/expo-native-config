/**
 * Expo documents that a plugin should reach config-plugins through the `expo`
 * package it is running next to: importing `@expo/config-plugins` directly can
 * resolve a *second* copy under pnpm/Yarn PnP, and two copies of the mod
 * registry silently drop each other's mods. We prefer the app's re-export and
 * fall back to our own dependency, which is what the standalone CLI uses when
 * no app is present.
 */
type ConfigPlugins = typeof import('@expo/config-plugins');

function resolveConfigPlugins(): ConfigPlugins {
  try {
    return require('expo/config-plugins') as ConfigPlugins;
  } catch {
    return require('@expo/config-plugins') as ConfigPlugins;
  }
}

export const configPlugins: ConfigPlugins = resolveConfigPlugins();
