import SwiftUI
import WidgetKit

struct FocusEntry: TimelineEntry { let date: Date }
struct FocusProvider: TimelineProvider {
  func placeholder(in context: Context) -> FocusEntry { FocusEntry(date: Date()) }
  func getSnapshot(in context: Context, completion: @escaping (FocusEntry) -> Void) {
    completion(FocusEntry(date: Date()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<FocusEntry>) -> Void) {
    let now = Date()
    completion(Timeline(entries: [FocusEntry(date: now)], policy: .after(now.addingTimeInterval(3600))))
  }
}

@main
struct WorkspaceWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "WorkspaceFocus", provider: FocusProvider()) { entry in
      VStack(alignment: .leading, spacing: 12) {
        Text("DAILY FOCUS").font(.caption).foregroundStyle(.secondary)
        Text("Make one thing better.").font(.headline)
        Text(entry.date, style: .date).font(.caption)
      }
      .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("Workspace Widget")
    .description("A simple focus prompt built with WidgetKit.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
