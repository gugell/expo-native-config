/**
 * This package ships an iOS widget. Any app that depends on it can link the
 * target with `{ package: 'workspace-widget-target' }` — the declaration
 * travels with the Swift instead of living in one app's manifest.
 *
 * `name` and `bundleIdentifier` are left to the app: the app is what knows its
 * own bundle identifier.
 */
module.exports = {
  type: 'widget',
  deploymentTarget: '18.0',
  frameworks: ['WidgetKit', 'SwiftUI'],
};
