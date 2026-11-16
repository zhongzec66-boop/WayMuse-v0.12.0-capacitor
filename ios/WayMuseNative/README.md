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
- 普通 iPhone 使用图标底部导航；Duo 展开窗口按含侧边安全区的宽度切换为账户/计划/会话、聊天、侧边导航三栏。
- 导航和工具区域在 iOS 26 及以上使用系统 Liquid Glass；旧系统使用系统半透明材质。
- WayMuse 默认头像随待机、输入和回复状态轻微变化；设置页可从系统照片选择器上传头像，自定义头像仅做本地轻动效，图片裁成 512px 方形并保存在本机。系统“减少动态效果”开启时停止动画。
- 今日、课表、记忆目前只显示开发状态，不展示假数据。
- 原生会话和可编辑称呼保存在本机，侧栏可搜索和切换会话；额度从 `/api/me/quota` 读取。账号完整资料、刷新令牌、协议块结构化解析、语音和课程能力仍未完成。
- 这是编译和交互对接版本，不用于 TestFlight 上传或产品验收。
