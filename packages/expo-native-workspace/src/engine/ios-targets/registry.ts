import type { TargetType } from './types';

export interface TargetRegistryEntry {
  extensionPointIdentifier?: string;
  productType?: string;
  frameworks?: string[];
  needsEmbeddedSwift?: boolean;
  appGroupsByDefault?: boolean;
}

const DEFAULT_PRODUCT_TYPE = 'com.apple.product-type.app-extension';

/** v1 subset of @bacons/apple-targets' TARGET_REGISTRY. */
export const TARGET_REGISTRY: Record<TargetType, TargetRegistryEntry> = {
  share: {
    extensionPointIdentifier: 'com.apple.share-services',
    needsEmbeddedSwift: true,
    appGroupsByDefault: true,
  },
  widget: {
    extensionPointIdentifier: 'com.apple.widgetkit-extension',
    frameworks: ['WidgetKit', 'SwiftUI', 'ActivityKit', 'AppIntents'],
    appGroupsByDefault: true,
  },
  clip: {
    productType: 'com.apple.product-type.application.on-demand-install-capable',
    needsEmbeddedSwift: true,
    appGroupsByDefault: true,
  },
  'notification-service': {
    extensionPointIdentifier: 'com.apple.usernotifications.service',
    frameworks: ['UserNotifications'],
    needsEmbeddedSwift: true,
    appGroupsByDefault: true,
  },
  'notification-content': {
    extensionPointIdentifier: 'com.apple.usernotifications.content-extension',
    frameworks: ['UserNotifications', 'UserNotificationsUI'],
    needsEmbeddedSwift: true,
    appGroupsByDefault: true,
  },
  intent: {
    extensionPointIdentifier: 'com.apple.intents-service',
    frameworks: ['Intents'],
    needsEmbeddedSwift: true,
    appGroupsByDefault: true,
  },
  action: {
    extensionPointIdentifier: 'com.apple.services',
    needsEmbeddedSwift: true,
    appGroupsByDefault: true,
  },
  safari: {
    extensionPointIdentifier: 'com.apple.Safari.web-extension',
    needsEmbeddedSwift: true,
  },
};

export function productTypeForType(type: TargetType): string {
  return TARGET_REGISTRY[type].productType ?? DEFAULT_PRODUCT_TYPE;
}

export function needsEmbeddedSwift(type: TargetType): boolean {
  return TARGET_REGISTRY[type].needsEmbeddedSwift ?? false;
}

export function appGroupsByDefault(type: TargetType): boolean {
  return TARGET_REGISTRY[type].appGroupsByDefault ?? false;
}

export function getFrameworksForType(type: TargetType, extra: string[] = []): string[] {
  return [...(TARGET_REGISTRY[type].frameworks ?? []), ...extra];
}

export function extensionPointIdentifier(type: TargetType): string | undefined {
  return TARGET_REGISTRY[type].extensionPointIdentifier;
}
