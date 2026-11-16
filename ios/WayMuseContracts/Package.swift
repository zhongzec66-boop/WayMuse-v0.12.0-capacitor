// swift-tools-version: 5.9
import PackageDescription

// 跨端契约层：只放「必须与 TS/JavaScript 行为一致」的纯函数与模型。
// 不依赖 UIKit / SwiftUI / 网络，所以可以在任何 macOS 上 `swift test`，不需要 Xcode。
let package = Package(
    name: "WayMuseContracts",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(name: "WayMuseContracts", targets: ["WayMuseContracts"])
    ],
    targets: [
        .target(
            name: "WayMuseContracts",
            path: "Sources/WayMuseContracts"
        ),
        .testTarget(
            name: "WayMuseContractsTests",
            dependencies: ["WayMuseContracts"],
            path: "Tests/WayMuseContractsTests",
            resources: [.copy("Fixtures")]
        )
    ]
)
