import fs from 'node:fs';
import path from 'node:path';
import { configNames, ConfigError } from './session';
const templates = ['minimal', 'share-extension', 'widget', 'android'];
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
            Text("Hello from Expo Native Workspace").containerBackground(.blue.gradient, for: .widget)
        }
        .configurationDisplayName("Workspace Widget")
        .description("A reproducible native widget.")
        .supportedFamilies([.systemSmall])
    }
}
`;
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
  if (template === 'android')
    body =
      "  android: { permissions: ['android.permission.CAMERA'], features: [{ name: 'android.hardware.camera', required: false }] },\n";
  if (template === 'share-extension' || template === 'widget') {
    const name = template === 'widget' ? 'WorkspaceWidget' : 'ShareExtension';
    const type = template === 'widget' ? 'widget' : 'share';
    body = `  ios: { targets: [{ name: '${name}', type: '${type}', bundleIdentifier: '.${type}' }] },\n`;
    files.set(
      `targets/${name}/${template === 'widget' ? 'WorkspaceWidget' : 'ShareViewController'}.swift`,
      template === 'widget' ? widget : share,
    );
  }
  files.set(
    'workspace.config.ts',
    `import { defineWorkspace } from 'expo-native-workspace';\n\nexport default defineWorkspace({\n  schemaVersion: 1,\n${body}});\n`,
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
      'Install expo-native-workspace in your Expo app.',
      'Add "expo-native-workspace/plugin" last in expo.plugins.',
      ...(template === 'widget' || template === 'share-extension'
        ? ['Set expo.ios.bundleIdentifier in your Expo app config.']
        : []),
      'Run expo-native-workspace validate, then expo-native-workspace plan.',
      'Run expo prebuild --clean to generate native projects.',
    ],
  };
}
