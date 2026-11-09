# WayMuse · iOS 上架与 iOS 27 适配评估

更新：2026-11-06
适用代码：`H:\ai工作区\waymuse-web`（v0.10.0）

## 0. 先说结论

**当前项目不能直接提交 App Store。** 它是一个 Vite + React 的浏览器演示，不是 iOS App。CSS 只能解决“在 iPhone 上看起来对”，解决不了“成为一个可审核的 iOS App”。

要上架，至少还需要：

1. Apple Developer Program 账号；
2. 一台 macOS + Xcode 27（或云 Mac）；
3. 原生容器（推荐 Capacitor）或 SwiftUI 重写；
4. 可访问的隐私政策 URL、App 支持 URL；
5. App Store Connect 的 App Privacy、年龄分级、截图、图标；
6. 一个审核员能感知到的真实功能——不能只是网页套壳，也不能把固定回复说成 AI。

本轮已经把 **Web 层的 iOS 27 适配**和**不依赖后端的缺失功能**补上，并把真实 DeepSeek 接进手机端聊天页；原生壳、产品级 AI/后端、App Store 素材仍需下一步。

## 1. iOS 27 的硬要求

Apple 在 2026-09-09 开放 iOS 27 提交，并规定：**从 2027 年 4 月起，iOS/iPadOS App 必须使用 iOS 27 SDK 或更高版本构建**。也就是说现在（2026-11）还能用 iOS 26 SDK 过渡，但上架窗口只剩几个月。

iOS 27 的 Liquid Glass 相比 iOS 26 有几处变化，会影响原生壳和 WebView 的观感：

- 玻璃材质对背后内容的扩散更强，文字更易读；
- 元素增加更暗的边缘和更亮的镜面高光；
- 系统设置新增透明度滑块，用户可以把玻璃调成从“极清”到“完全着色”；
- 滚动内容经过浮动栏时，系统 toolbar 会自动保证可读性；
- App 图标支持多层 Liquid Glass 与折射效果，Apple 用 Icon Composer 制作；
- 玻璃会自动适配“降低透明度”和“增强对比度”辅助功能。

参考：[Apple Developer News（2026-09-09）](https://developer.apple.com/news/?id=k1mtkt1k)、[MacRumors：iOS 27 的 Liquid Glass 变化](https://www.macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27/)。

**关键点**：这些是原生 UIKit/SwiftUI 的材质。Capacitor/WKWebView 里的网页不会自动获得系统 Liquid Glass；我们只能用 CSS 仿制，并让原生导航栏/弹窗使用系统材质。

## 2. 上架阻塞项

| # | 项目 | 现状 | 必须做什么 |
| --- | --- | --- | --- |
| 1 | 原生容器 | 无，只有网页 | Capacitor 套壳（改动最小）或 SwiftUI 重写 |
| 2 | Apple Developer Program | 未知 | 注册并完成协议、税务、银行信息 |
| 3 | macOS + Xcode 27 | 当前是 Windows | 需要 Mac 或云 Mac；Windows 只能准备代码，不能签名/上传 |
| 4 | 隐私政策 URL | 无 | 托管公开页面（可用 `docs/PRIVACY.md` 草稿） |
| 5 | App 支持 URL | 无 | 托管支持页，填 App Store Connect |
| 6 | App Privacy | 未填 | 若保留聊天页 DeepSeek 接入，需声明“用户内容”发送给第三方 AI；否则上架版隐藏该能力 |
| 7 | App 图标 | 已有 1024 PNG | App Store 要求 1024×1024 无透明；建议用 Icon Composer 做分层 |
| 8 | 截图 | 有演示截图 | 6.9"/6.5" 等尺寸，不能含设备边框/误导文案 |
| 9 | 真实功能 | 演示 | 至少一个审核员可感知的真实价值，避免 4.2 |
| 10 | AI 真实性 | 聊天页可接自带 Key 的 DeepSeek；未连接时显示连接卡 | 产品化前接后端/代理，或不要以 AI 为核心卖点 |
| 11 | 账户删除 | 无账户 | 若以后加账户，必须提供 App 内删除 |
| 12 | 隐私清单 | 无 | `PrivacyInfo.xcprivacy`（Capacitor 插件会带入） |
| 13 | 权限文案 | 无 | `NSMicrophoneUsageDescription` 等，必须具体 |
| 14 | TestFlight | 无 | 先内测，再提交审核 |
| 15 | 年龄分级 | 未定 | AI 对话可能涉及 12+/17+，按问卷如实填 |
| 16 | 出口合规 | 未定 | 只用 HTTPS 通常可填 `ITSAppUsesNonExemptEncryption = NO` |
| 17 | 许可证 | **MIT**（2026-11 已确认） | 仓库中无 GPL 代码，依赖全为 MIT/ISC/Apache-2.0，与 App Store 无冲突 |

### 最大的审核风险：Guideline 4.2 Minimum Functionality

App Store 明确不接受“只是把网站打包”的 App。当前项目如果直接套壳，风险很高，因为：

- 没有账户、云端、推送、日历、离线之外的系统能力；
- 聊天需要用户自备 Key 才有真实 AI；没有 Key 时只显示连接设置，不产生假回复；
- 大部分“连接应用”是“规划中”；
- 课程只能手动录，不能导入。

必须至少补一类原生价值：本地通知、日历/课表导入、离线可用、Widget/Live Activity、Share Extension，或者真实的 AI 服务。否则建议先不要提交，避免被拒后浪费审核周期。

### 许可证：已解除的阻塞（2026-11）

历史上这个仓库的 `LICENSE`、`NOTICE`、`THIRD_PARTY_NOTICES.md` 是从项目模板继承的 GPLv3 文件，
文档里也写过「代码派生自 nanoMuse」。2026-11 逐项核查后确认：

- 仓库里没有 OpenMinis / nanoMuse 的代码：无 `android/src`、无 `deps/`、无 `// nanoMuse:` 标记；
- 全部依赖为 MIT / ISC / Apache-2.0，没有 GPL/AGPL；
- 因此三个 GPL 文件已替换为 MIT 与准确的第三方声明。

结论：**GPL 与 App Store 的冲突不再存在**。后续若要商业化，可以在新版本改用 Apache-2.0
（MIT 版本不可撤回，已发布的副本永久 MIT）。贡献者提交 PR 需同意维护者可以换许可证再发布。

另外，`WayMuse` 作为 App 名称需要在 App Store Connect 和商标数据库做一次检索，避免名称被占用或侵权。

## 3. iOS 27 适配清单（Web 层）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 安全区（刘海/Dynamic Island/Home Indicator） | 已做 | `env(safe-area-inset-*)` + `viewport-fit=cover` |
| iOS 输入框自动放大 | 已做 | 聚焦字段 16px |
| 44pt 触控目标 | 已做 | 删除按钮用伪元素扩大热区，不改变行高 |
| `-webkit-backdrop-filter` | 已做 | 玻璃层补齐前缀 |
| 降低透明度 / 增强对比度 | 已做 | `prefers-reduced-transparency` / `prefers-contrast` |
| 不支持玻璃时的回退 | 已做 | `@supports not` 纯色背景 |
| 独立 App 状态栏 | 已做 | `black-translucent` + 安全区 |
| 图标 | 已做 | 1024/512/192/180 PNG + SVG |
| 触屏设备全屏 | 已做 | 去掉桌面手机外框，铺满屏幕 |
| 深色模式 | 未做 | 当前锁定浅色；上架前要么做完整深色，要么在 App 内说明仅浅色 |
| Dynamic Type | 未做 | 尚未接系统字号；需要改用相对单位并测试大字号 |
| VoiceOver | 部分 | 有 aria-label；弹层还缺焦点陷阱与 `aria-modal` |
| 触觉反馈 | 未做 | 需要原生 Haptics 插件 |
| 横屏/ iPad | 未定 | manifest 锁竖屏；若支持 iPad 需要单独布局 |
| 启动屏 | 未做 | 需要 LaunchScreen / splash 资源 |

## 4. 原生壳建议：Capacitor

如果不想重写 SwiftUI，Capacitor 是最小改动路径：保留现有 React 页面，把 `dist/` 装进 `WKWebView`，再用插件补原生能力。

在 macOS 上大致步骤：

```bash
cd waymuse-web
npm install
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init WayMuse com.yourcompany.waymuse --web-dir=dist
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

> 这会新增 Capacitor 依赖和 `ios/` 工程，属于架构变更，需要你确认后再做。Windows 上可以生成部分工程文件，但编译、签名、上传必须用 macOS + Xcode 27。

建议的 `Info.plist` 键：

| 键 | 用途 | 文案要求 |
| --- | --- | --- |
| `NSMicrophoneUsageDescription` | 录音 | 说明“录制语音笔记，仅在本地预览” |
| `NSPhotoLibraryUsageDescription` | 选图片 | 说明“选择课表/通知图片用于预览” |
| `NSCameraUsageDescription` | 拍照（若开启） | 说明“拍摄课表或通知” |
| `ITSAppUsesNonExemptEncryption` | 出口合规 | 只用 HTTPS 时填 `NO` |
| `UISupportedInterfaceOrientations` | 方向 | 先只保留竖屏 |
| `CFBundleDisplayName` | 桌面名称 | `WayMuse` |

建议补的原生能力（按上架价值排序）：

1. **本地通知**（`@capacitor/local-notifications`）：课程提醒、截止日期提醒；
2. **分享/导出**（`@capacitor/share` + `@capacitor/filesystem`）：把演示数据导出为文件，替代网页下载；
3. **日历/课表导入**（EventKit 或文档选择器）：真正兑现“添加课表”；
4. **触觉反馈**（`@capacitor/haptics`）：任务完成、确认清除；
5. **安全存储**（Keychain）：未来账户 token，不用 localStorage；
6. **网络状态/离线**：课程与任务离线可用；
7. **Widget / Live Activity**（可选）：今天的下一节课/最近截止日期。

## 5. App Review 重点条款

- **4.2 Minimum Functionality**：不能是纯网页套壳；需要原生能力或真实服务。
- **2.1 App Completeness**：不能有崩溃、空白页、明显占位；演示内容必须标“演示”。
- **2.3 Accurate Metadata**：截图、描述、关键词不能暗示未实现的功能（AI、课表识别、连接应用）。
- **5.1.1 Privacy**：权限文案、隐私政策、App Privacy 必须与实际一致；不能后台读取通讯录/相册。
- **1.2 User-Generated Content**：如果聊天接入真实 AI，需要有内容过滤、举报、屏蔽。
- **5.1.1(v) Account Deletion**：一旦有账户，必须提供 App 内删除。
- **3.1.1 In-App Purchase**：如果未来卖订阅，必须用 IAP，不能引导外部支付。
- **2.5.1 Public APIs**：不能用私有 API 做玻璃/图标效果。

## 6. 功能差距（按上架优先级）

### P0：不补就很难过审

- 原生容器 + 权限文案 + 隐私清单；
- 隐私政策/支持 URL + App Privacy；
- 真实价值：本地通知、课表导入、日历、离线，至少一个；
- 真实 AI 或明确“非 AI 的学习规划工具”定位；
- 崩溃兜底（已加 ErrorBoundary）与数据清除（已加）。

### P1：iOS 27 体验

- 深色模式或明确仅浅色；
- Dynamic Type / VoiceOver / 焦点管理；
- iPad 布局（若支持）；
- 启动屏与 App 图标分层；
- 触觉反馈；
- 网络状态与离线提示；
- 本地化（至少 zh-Hans，若出海再加 en）。

### P2：产品完善

- 课程编辑、学期周次、单双周、CSV 导入（阶段 B / 后续）；
- 任务编辑/删除/排序；
- 聊天历史与真实模型；
- 账户与 CloudKit 同步；
- Widget / Live Activity / App Intents；
- 单元测试与 CI。

## 7. 本轮已经改了什么

- 新增 `src/ios.css`：安全区、16px 输入、44pt 热区、玻璃前缀、降低透明度/增强对比度、无玻璃回退、触屏全屏。
- `index.html`：`viewport-fit=cover`、状态栏、`color-scheme`、apple-touch-icon、描述。
- `manifest.webmanifest`：竖屏、图标、分类、主题色。
- 新增 1024/512/192/180 图标（线连节点 + 琥珀节点）。
- 任务改为 localStorage 持久化；新增 `storage.getTasks/setTasks`。
- 课程星期加入周日；今天/课程筛选统一 `Asia/Shanghai`。
- 存储增加数据校验与 id 回退，旧/损坏数据不再让 Today 排序崩溃。
- 设置新增“隐私与数据”：隐私说明、导出 JSON、清除全部演示数据（二次确认）。
- 新增 `PrivacyPage`、`ErrorBoundary`、`version.ts`。
- 新增聊天页 DeepSeek 真实接入：多轮对话、SSE 流式输出、思考过程、token 用量、首字延迟、模型列表、错误映射、停止生成、配置与密钥本地保存。
- 首次进入改为 5 步：学业档案（学校/专业/年级/主要课程）、称呼、头像上传、陪伴方式（朋友/导师/自定义）、数据说明。
- 头像自动裁成 256px JPEG 只存本机；设置页可改个人档案和陪伴风格。
- AI system prompt 带入学业档案、称呼、语气、温度、回复长度和安全边界。
- 默认入口为五 Tab 手机端；聊天页已接入真实 DeepSeek，任务/记忆/对话持久化；旧 PersonalShell 已归档，不参与入口。
- 版本升到 `0.10.0`。

**行为变化**：任务和聊天记录都持久化；聊天不再显示固定演示回复，未配置 Key 时显示连接设置。

### 聊天页 DeepSeek 接入（个人自测，不是产品接入）

- 入口：**设置 → AI 连接**，或聊天页左上角连接设置。
- 浏览器直连 `https://api.deepseek.com`。已实测其 CORS 预检允许 `127.0.0.1` 的 `POST`、`Authorization` 与 `Content-Type`，所以个人测试不需要代理。
- 支持 `deepseek-flash` / `deepseek-v4-pro`，也允许手填模型；支持 `thinking` 与 `reasoning_effort`。
- API Key 默认只写 `sessionStorage`（关闭标签页即失效）；勾选“记住密钥”才写 `localStorage`。密钥只发往你填写的 Base URL。
- 对话保存在 `waymuse-demo-deepseek-messages`；可在 AI 伙伴设置里清空/导出数据。

**上架前必须改掉**：

- 不要在正式 App 里让用户填长期 API Key 后直连；应改为你自己的后端代理（或让用户带自己的 Key 走 Keychain + 受限代理），否则密钥可被提取，且无法做用量/内容治理。
- 如果正式版保留 AI 对话，App Privacy 必须声明“用户内容”收集，并补内容过滤/举报/屏蔽（Guideline 1.2）。
- `client.ts` 是纯 `fetch` 实现，移植 iOS 时只需换传输层；`storage` 需要换成 Keychain/沙盒存储。

## 8. 需要你确认

1. **原生路线**：Capacitor 套壳（推荐，改动小）还是 SwiftUI 重写？
2. **AI 路线**：把聊天页 DeepSeek 接入升级为产品级（后端代理 + 账号/额度/内容治理），还是先定位为“非 AI 的本地学习规划工具”？
3. **设备**：你有没有 Mac + Xcode 27 + Apple Developer 账号？没有的话需要先解决，否则无法签名上传。
4. **范围**：先做“能过审的最小原生版”（本地通知 + 课表导入 + 隐私合规），还是等阶段 2–4 全部完成再上架？
5. **依赖**：是否允许新增 Capacitor 及插件依赖？这会改变“无新依赖”的交接约束。

## 9. 建议的下一步

**最小可审核版本（MVP）**：

1. 阶段 B（课程周次）完成，让“今天的课”可靠；
2. 阶段 C（Today 真实生成）完成，形成课表 → 简报 → 任务 → 聊天的闭环；
3. 阶段 D/E（通知待确认、记忆候选）完成；
4. 再评估视觉重排（原阶段 2/3 暂缓）；
5. 加 Capacitor 壳、原生通知、分享、权限文案；
6. 加隐私政策/支持页、App Privacy、截图、TestFlight；
7. 提交审核。

如果时间紧，也可以先做 Capacitor + 本地通知 + 隐私合规的“小版本”试水，但 4.2 风险仍在。
