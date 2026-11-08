# 原生聊天输入框（iOS）

iOS 上用系统原生视图承载聊天输入框（Liquid Glass / 超薄材质），
Web、Android、插件缺失时自动回退到原来的网页 `<input>`。

## 为什么不是改 npm 插件

`@ajuarezso/capacitor-liquid-glass` 里**没有任何文本输入相关的原生接口**，
只有 Tab 栏、搜索浮层和 WebView 底色。所以输入框必须自己加原生代码。

而它是个 npm 依赖：`npm ci` 会整个重装 `node_modules`，直接改包里的 Swift 会被冲掉。
本工程又用传统 `project.pbxproj`（新加 `.swift` 要在 4 个地方写引用），手改容易把工程写坏。

因此采用的是：

```
patches/liquid-glass/*.swift        ← 源码入库，进 git
        │  postinstall 复制
        ▼
node_modules/@ajuarezso/capacitor-liquid-glass/ios/Sources/LiquidGlassPlugin/
        │  SPM 自动编译该 target 下所有 .swift
        ▼
    App 二进制
```

`package.json` 里的 `postinstall` 调 `scripts/inject-native-compose.cjs`，
保证每次 `npm ci` / `npm install` 之后这两个文件都在位。脚本幂等，目录不存在只告警不报错。

## 注册

注入的类不在 Capacitor 的自动插件清单里，所以 `SceneDelegate.swift` 里用
`WayMuseBridgeViewController` 子类在 `capacitorDidLoad()` 手动注册：

```swift
final class WayMuseBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeComposePlugin())
    }
}
```

## 原生 API

| 方法 | 说明 |
| --- | --- |
| `showComposeBar({ bounds, placeholder, text, tintColor, enabled })` | 显示浮层，`bounds` 为 DOM 矩形（viewport CSS px） |
| `setComposeBounds({ bounds })` | 滚动/转屏/键盘变化时更新位置 |
| `setComposeText({ text })` | JS 侧文本回写（受去抖保护，不会打断输入） |
| `hideComposeBar()` | 隐藏 |

事件：`composeTextChanged`、`composeSubmit`、`composeAttach`、`composeVoice`。

## Web 侧接线

`src/nativeCompose.ts` 里的 `useNativeCompose()`：

1. 只在 `Capacitor.isNativePlatform() && getPlatform() === 'ios'` 时启用；
2. 用 `#waymuse-compose-slot`（即 `.wr-compose`）作为锚点，把矩形推给原生；
3. `ResizeObserver` + `scroll` + `visualViewport` 变化经 `requestAnimationFrame` 合并后同步；
4. 原生激活时给锚点加 `wr-compose-native`，把网页输入框设为 `opacity: 0` 并禁用点击，
   避免「Web 胶囊 + 原生胶囊」重影；
5. 原生事件回传文本 → 写入 `draft`；提交 → 调 `submit()`；附件/语音 → 对应原有动作。

## 已知风险点（首次 CI 编译需要重点看）

- `UIGlassEffect`：iOS 26 才有，代码里用 `#available(iOS 26.0, *)` 包住，
  低版本退回 `UIBlurEffect(.systemUltraThinMaterial)`。若该符号在 CI 的 Xcode 版本里
  名字不同，编译会在 `makeGlassEffect()` 处报错——只需改这一个函数。
- `CAPBridgeViewController.capacitorDidLoad()` 与 `bridge?.registerPluginInstance(_:)`
  是 Capacitor 官方自定义插件写法；若版本差异导致签名不同，改 `SceneDelegate.swift`。
- 键盘处理用的是 `UIResponder.keyboardWillChangeFrameNotification`，
  把浮层整体上移；原生输入框不会触发 WebKit 的 visualViewport 调整，所以必须自己算。

## 构建

```bash
npm ci          # 触发 postinstall 注入 Swift
npm run typecheck && npm run lint && npm run build
npx cap sync ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' build
```

`.github/workflows/ios-build.yml` 已经包含上述流程，`workflow_dispatch` 手动触发即可。
