# WayMuse 原生 iOS 第一版

此目录是独立的 SwiftUI 主 App 工程，不替换 `ios/App` 的 Capacitor 工程。两个工程不应同时用同一个 Bundle ID 安装到一台设备上。

## 在 Mac 上生成并编译

需要 Xcode 与 [XcodeGen](https://github.com/yonaskolb/XcodeGen)。在本目录执行：

```sh
xcodegen generate
xcodebuild -project WayMuseNative.xcodeproj -scheme WayMuseNative -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

生成的 `WayMuseNative.xcodeproj` 不提交到版本库，依 `project.yml` 重新生成。

## 当前范围

- 原生聊天界面接真实 `/api/auth/guest` 与 `/api/ai/chat` SSE；请求只发文字。
- 普通 iPhone 底部导航，设置中可切到 Duo 风格的顶部工具栏与右侧竖向胶囊导航。窗口宽度达到 700 点时，Duo 展开为左侧会话上下文、中央正文和右侧导航三栏。
- 导航和工具区域在 iOS 26 及以上使用系统 Liquid Glass；旧系统使用系统半透明材质。
- 今日、课表、记忆目前只显示开发状态，不展示假数据。
- 会话只存在内存；账号、刷新令牌、协议块结构化解析、语音和课程能力仍未完成。
- 这是编译和交互对接版本，不用于 TestFlight 上传或产品验收。
