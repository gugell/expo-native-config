import { XCBuildConfiguration, XCConfigurationList, XcodeProject } from '@bacons/xcode';

import type { TargetType } from './types';

export interface ConfigListProps {
  name: string;
  displayName?: string;
  /** Path to the target dir relative to ios/ (e.g. "../targets/ShareExtension"). */
  cwd: string;
  bundleId: string;
  deploymentTarget: string;
  currentProjectVersion: string | number;
}

type BuildSettings = Record<string, string | number | string[]>;

/** Common extension build settings, byte-for-byte from @bacons/apple-targets `createShareConfigurationList`. */
function commonSettings(props: ConfigListProps): BuildSettings {
  return {
    CLANG_ANALYZER_NONNULL: 'YES',
    CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: 'YES_AGGRESSIVE',
    CLANG_CXX_LANGUAGE_STANDARD: 'gnu++20',
    CLANG_ENABLE_OBJC_WEAK: 'YES',
    CLANG_WARN_DOCUMENTATION_COMMENTS: 'YES',
    CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER: 'YES',
    CLANG_WARN_UNGUARDED_AVAILABILITY: 'YES_AGGRESSIVE',
    CODE_SIGN_STYLE: 'Automatic',
    DEBUG_INFORMATION_FORMAT: 'dwarf',
    GCC_C_LANGUAGE_STANDARD: 'gnu11',
    GENERATE_INFOPLIST_FILE: 'YES',
    CURRENT_PROJECT_VERSION: props.currentProjectVersion,
    INFOPLIST_FILE: `${props.cwd}/Info.plist`,
    INFOPLIST_KEY_CFBundleDisplayName: props.displayName ?? props.name,
    INFOPLIST_KEY_NSHumanReadableCopyright: '',
    IPHONEOS_DEPLOYMENT_TARGET: props.deploymentTarget,
    LD_RUNPATH_SEARCH_PATHS: [
      '$(inherited)',
      '@executable_path/Frameworks',
      '@executable_path/../../Frameworks',
    ],
    MARKETING_VERSION: '1.0',
    MTL_FAST_MATH: 'YES',
    PRODUCT_BUNDLE_IDENTIFIER: props.bundleId,
    PRODUCT_NAME: '$(TARGET_NAME)',
    SKIP_INSTALL: 'YES',
    SWIFT_EMIT_LOC_STRINGS: 'YES',
    SWIFT_OPTIMIZATION_LEVEL: '-Onone',
    SWIFT_VERSION: '5.0',
    TARGETED_DEVICE_FAMILY: '1,2',
  };
}

function settingsForType(
  _type: TargetType,
  props: ConfigListProps,
): {
  debug: BuildSettings;
  release: BuildSettings;
} {
  const common = commonSettings(props);
  return {
    debug: {
      ...common,
      MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE',
      SWIFT_ACTIVE_COMPILATION_CONDITIONS: 'DEBUG',
    },
    release: { CLANG_ANALYZER_NONNULL: 'YES', ...common, COPY_PHASE_STRIP: 'NO' },
  };
}

export function createConfigurationListForType(
  project: XcodeProject,
  type: TargetType,
  props: ConfigListProps,
): XCConfigurationList {
  const { debug, release } = settingsForType(type, props);
  return XCConfigurationList.create(project, {
    buildConfigurations: [
      XCBuildConfiguration.create(project, { name: 'Debug', buildSettings: debug as never }),
      XCBuildConfiguration.create(project, { name: 'Release', buildSettings: release as never }),
    ],
    defaultConfigurationIsVisible: 0,
    defaultConfigurationName: 'Release',
  } as Parameters<typeof XCConfigurationList.create>[1]);
}
