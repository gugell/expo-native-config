import plist from '@expo/plist';

import type { TargetType } from './types';
import { extensionPointIdentifier } from './registry';

/** Per-type Info.plist contents (mirrors @bacons/apple-targets). Written create-if-absent. */
export function getTargetInfoPlist(type: TargetType): Record<string, unknown> {
  const pointIdentifier = extensionPointIdentifier(type);
  switch (type) {
    case 'share':
      return {
        NSExtension: {
          NSExtensionAttributes: {
            NSExtensionActivationRule: {
              NSExtensionActivationSupportsText: true,
              NSExtensionActivationSupportsWebURLWithMaxCount: 1,
            },
          },
          NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).ShareViewController',
          NSExtensionPointIdentifier: pointIdentifier,
        },
      };
    case 'widget':
      return { NSExtension: { NSExtensionPointIdentifier: pointIdentifier } };
    case 'clip':
      return {
        CFBundleName: '$(PRODUCT_NAME)',
        CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
        CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
        CFBundleExecutable: '$(EXECUTABLE_NAME)',
        CFBundlePackageType: '$(PRODUCT_BUNDLE_PACKAGE_TYPE)',
        CFBundleShortVersionString: '$(MARKETING_VERSION)',
        UIApplicationSupportsIndirectInputEvents: true,
        NSAppClip: {
          NSAppClipRequestEphemeralUserNotification: false,
          NSAppClipRequestLocationConfirmation: false,
        },
      };
    case 'notification-service':
      return {
        NSExtension: {
          NSExtensionPointIdentifier: pointIdentifier,
          NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).NotificationService',
        },
      };
    case 'notification-content':
      return {
        NSExtension: {
          NSExtensionAttributes: {
            // Replace with the category your payload sends; an unmatched category
            // simply means iOS never shows this content extension.
            UNNotificationExtensionCategory: 'default',
            UNNotificationExtensionInitialContentSizeRatio: 1,
          },
          NSExtensionMainStoryboard: 'MainInterface',
          NSExtensionPointIdentifier: pointIdentifier,
        },
      };
    case 'intent':
      return {
        NSExtension: {
          NSExtensionAttributes: { IntentsSupported: [] },
          NSExtensionPointIdentifier: pointIdentifier,
          NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).IntentHandler',
        },
      };
    case 'action':
      return {
        NSExtension: {
          NSExtensionAttributes: { NSExtensionActivationRule: 'TRUEPREDICATE' },
          NSExtensionPointIdentifier: pointIdentifier,
          NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).ActionViewController',
        },
      };
    case 'safari':
      return {
        NSExtension: {
          NSExtensionPointIdentifier: pointIdentifier,
          NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler',
        },
      };
    default:
      return {};
  }
}

export function buildInfoPlist(type: TargetType): string {
  return plist.build(getTargetInfoPlist(type) as never);
}
