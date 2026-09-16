public enum WorkspaceMath {
  public static func clampedProgress(completed: Int, total: Int) -> Double {
    guard total > 0 else { return 0 }
    return min(1, max(0, Double(completed) / Double(total)))
  }
}
