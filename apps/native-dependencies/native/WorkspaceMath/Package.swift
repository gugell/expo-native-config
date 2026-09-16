// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "WorkspaceMath",
  platforms: [.iOS(.v15)],
  products: [.library(name: "WorkspaceMath", targets: ["WorkspaceMath"])],
  targets: [.target(name: "WorkspaceMath")]
)
