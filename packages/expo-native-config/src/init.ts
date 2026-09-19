import fs from 'node:fs';
import path from 'node:path';
import { configNames, ConfigError } from './session';
const templates = ['minimal', 'share-extension', 'widget', 'android', 'lifecycle-module'];
const share = `import UIKit
import Social

final class ShareViewController: SLComposeServiceViewController {
    override func isContentValid() -> Bool { true }
    override func didSelectPost() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
    override func configurationItems() -> [Any]! { [] }
}
`;
const widget = `import SwiftUI
import WidgetKit

struct Entry: TimelineEntry { let date: Date }
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [Entry(date: Date())], policy: .never))
    }
}
@main
struct WorkspaceWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WorkspaceWidget", provider: Provider()) { entry in
            Text("Hello from Expo Native Config").containerBackground(.blue.gradient, for: .widget)
        }
        .configurationDisplayName("Workspace Widget")
        .description("A reproducible native widget.")
        .supportedFamilies([.systemSmall])
    }
}
`;
/**
 * A local Expo module whose only job is to run app-owned code at launch.
 *
 * This is the supported alternative to editing AppDelegate or MainApplication:
 * `expo-modules-autolinking` discovers the module, the Gradle plugin puts the
 * `BasePackage` subclass into the generated package list that
 * `ApplicationLifecycleDispatcher` reads, and `appDelegateSubscribers`
 * registers the iOS subscriber. Nothing here edits a generated file.
 *
 * Deliberately smaller than `create-expo-module --local`: there is no
 * JavaScript API, because a startup hook is not called from JavaScript.
 */
const lifecycleModule: Record<string, string> = {
  'modules/startup/expo-module.config.json': `{
  "platforms": ["apple", "android"],
  "apple": {
    "appDelegateSubscribers": ["StartupAppDelegateSubscriber"]
  },
  "android": {
    "name": "startup",
    "modules": []
  }
}
`,
  'modules/startup/android/build.gradle': `plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'expo.modules.startup'
version = '0.1.0'

android {
  namespace "expo.modules.startup"
  defaultConfig {
    versionCode 1
    versionName "0.1.0"
  }
  lintOptions {
    abortOnError false
  }
}
`,
  'modules/startup/android/src/main/AndroidManifest.xml': `<manifest>
</manifest>
`,
  // The default is empty on purpose: the app overrides it from
  // \`android.strings\` in the workspace config, which is the documented way to
  // hand a value to native code that runs before the JS engine starts.
  'modules/startup/android/src/main/res/values/strings.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="startup_value" translatable="false"></string>
</resources>
`,
  'modules/startup/android/src/main/java/expo/modules/startup/StartupPackage.kt': `package expo.modules.startup

import android.app.Application
import android.content.Context
import android.util.Log
import expo.modules.core.BasePackage
import expo.modules.core.interfaces.ApplicationLifecycleListener

class StartupPackage : BasePackage() {
  override fun createApplicationLifecycleListeners(
    context: Context,
  ): List<ApplicationLifecycleListener> = listOf(StartupLifecycleListener(context))
}

class StartupLifecycleListener(private val context: Context) : ApplicationLifecycleListener {
  /** Runs on Application.onCreate, before the JS engine starts. */
  override fun onCreate(application: Application) {
    val value = context.getString(R.string.startup_value)
    Log.i("startup", "startup listener ran with: " + value)
    // TODO: do the startup work here.
  }
}
`,
  'modules/startup/ios/Startup.podspec': `Pod::Spec.new do |s|
  s.name           = 'Startup'
  s.version        = '0.1.0'
  s.summary        = 'App-owned startup hooks'
  s.description    = 'Runs app-owned code at launch through Expo lifecycle hooks.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
`,
  'modules/startup/ios/StartupAppDelegateSubscriber.swift': `import ExpoModulesCore

public class StartupAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  /** Runs from application(_:didFinishLaunchingWithOptions:), without editing the AppDelegate. */
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // TODO: do the startup work here.
    return true
  }
}
`,
};

export function initialize(
  projectRoot: string,
  template = 'minimal',
): { files: string[]; next: string[] } {
  if (!templates.includes(template))
    throw new ConfigError([
      {
        severity: 'error',
        code: 'init.template',
        message: `Unknown template ${template}. Choose ${templates.join(', ')}.`,
      },
    ]);
  for (const name of configNames)
    if (fs.existsSync(path.join(projectRoot, name)))
      throw new ConfigError([
        { severity: 'error', code: 'init.exists', message: `Refusing to shadow existing ${name}.` },
      ]);
  const files = new Map<string, string>();
  let body = '';
  // Starter configs use the constructors, so the first thing a user reads is
  // the form that supplies discriminants and avoids magic strings.
  let imports = ['defineWorkspace'];
  if (template === 'android') {
    imports = ['AndroidFeature', 'AndroidHardware', 'AndroidPermission', 'defineWorkspace'];
    body =
      '  android: {\n' +
      '    permissions: [AndroidPermission.camera],\n' +
      '    features: [AndroidFeature.optional(AndroidHardware.camera)],\n' +
      '  },\n';
  }
  if (template === 'lifecycle-module') {
    imports = ['defineWorkspace'];
    body =
      '  android: {\n' +
      '    // Read by StartupLifecycleListener before the JS engine starts.\n' +
      "    strings: { startup_value: 'hello from workspace.config.ts' },\n" +
      '  },\n';
    for (const [file, contents] of Object.entries(lifecycleModule)) {
      files.set(file, contents);
    }
  }
  if (template === 'share-extension' || template === 'widget') {
    const name = template === 'widget' ? 'WorkspaceWidget' : 'ShareExtension';
    const type = template === 'widget' ? 'widget' : 'share';
    imports = ['defineWorkspace', 'Target'];
    body =
      '  ios: {\n' +
      `    targets: [Target.${type}({ name: '${name}', bundleIdentifier: '.${type}' })],\n` +
      '  },\n';
    files.set(
      `targets/${name}/${template === 'widget' ? 'WorkspaceWidget' : 'ShareViewController'}.swift`,
      template === 'widget' ? widget : share,
    );
  }
  files.set(
    'workspace.config.ts',
    `import { ${imports.join(', ')} } from 'expo-native-config';\n\nexport default defineWorkspace({\n  schemaVersion: 1,\n${body}});\n`,
  );
  for (const file of files.keys())
    if (fs.existsSync(path.join(projectRoot, file)))
      throw new ConfigError([
        { severity: 'error', code: 'init.exists', message: `Refusing to overwrite ${file}` },
      ]);
  fs.mkdirSync(projectRoot, { recursive: true });
  for (const [file, contents] of files) {
    const dest = path.join(projectRoot, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, contents, { flag: 'wx' });
  }
  return {
    files: [...files.keys()],
    next: [
      'Install expo-native-config in your Expo app.',
      'Add "expo-native-config/plugin" last in expo.plugins.',
      ...(template === 'widget' || template === 'share-extension'
        ? ['Set expo.ios.bundleIdentifier in your Expo app config.']
        : []),
      ...(template === 'lifecycle-module'
        ? [
            'Write the startup work in modules/startup; nothing edits AppDelegate or MainApplication.',
            'Autolinking picks the module up: no registration step, and no plugin entry.',
          ]
        : []),
      'Run expo-native-config validate, then expo-native-config plan.',
      'Run expo prebuild --clean to generate native projects.',
    ],
  };
}
