import Foundation
@objc public final class WorkspaceGreeting: NSObject {
  @objc public static func greeting(name: String) -> String {
    "Hello, \(name.trimmingCharacters(in: .whitespacesAndNewlines))!"
  }
}
