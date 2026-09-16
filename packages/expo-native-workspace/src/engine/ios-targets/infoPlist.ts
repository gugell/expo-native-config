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
    default:
      return {};
  }
}

export function buildInfoPlist(type: TargetType): string {
  return plist.build(getTargetInfoPlist(type) as never);
}
