# WayMuse 双端代码拆解（给外部审查用）

> 版本 0.28.1 · 分支 `feat/native-compose` @ `d9dea9c`
> 仓库：`github.com/zhongzec66-boop/WayMuse-v0.12.0-capacitor`（前端+双端壳）、`waymuse-server`（后端）
> 目的：让没看过这份代码的人（或另一个模型）在 30 分钟内建立结构感，并能指出具体文件里的问题。

---

## 一、这是什么

面向中国大学生的 AI 助手：聊天、课表、作业/考试、记忆（大脑图）、语音朗读、语音通话。
技术形态是 **Capacitor 8 混合应用**：一套 React 网页跑在 iOS WKWebView / Android WebView 里，原生能力用 Capacitor 插件补。

| 项 | 值 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite 5，无 UI 框架（手写 CSS 变量体系） |
| 壳 | Capacitor 8（`app.waymuse.student`） |
| iOS | Swift 5，SPM 链接，最低 iOS 15（工程 deployment target 15.0）；免费账号 7 天重签 |
| Android | Java 17，Gradle 8.14，JDK 21，minSdk 24，release 签名在 GitHub Secrets |
| 后端 | Fastify 5 + Postgres 16 + Redis 7，部署在东京轻量服务器 |
| 模型 | `deepseek-flash`（支持视觉），**key 只在服务端** |

---

## 二、仓库结构

```
src/           105 个文件  Web 层（页面、状态、API、语音、大脑、备份）
ios/            43 个文件  Xcode 工程 + Widget + 注入后的插件
android/        79 个文件  Gradle 工程 + 两个 Java 插件
patches/         3 个文件  iOS 原生插件的源文件（注入用）
scripts/         5 个文件  postinstall 注入脚本
.github/         2 个文件  iOS / Android 构建流水线
```

### Web 层代码量 Top 15（行数）

| 行数 | 文件 | 职责 |
| --- | --- | --- |
| 1396 | `src/pages/ChatPage.tsx` | 聊天：SSE、分句朗读、卡片、通话入口 |
| 533 | `src/pages/TaskPage.tsx` | 计划/任务/作业/考试 |
| 521 | `src/WayMuseReference.tsx` | 顶层状态、页面路由、Dock 装配 |
| 489 | `src/storage.ts` | localStorage 封装、迁移、键位 |
| 455 | `src/pages/SettingsPage.tsx` | 设置 4 大块 |
| 412 | `src/agent.ts` | 回复协议解析（plans/memories/courses/choices/deadlines） |
| 401 | `src/api.ts` | 服务端客户端：游客登录、刷新、SSE、识图、TTS |
| 366 | `src/Onboarding.tsx` | 7 步引导 |
| 354 | `src/courseImport.ts` | 课表文本解析（含表格模式） |
| 341 | `src/pages/DeadlineCards.tsx` | 作业/考试卡 |
| 335 | `src/pages/MemoryPage.tsx` | 记忆页（大脑/文件两子页） |
| 317 | `src/pages/TodayPage.tsx` | 时间线 |
| 276 | `src/pages/BrainMap.tsx` | 大脑图 |
| 273 | `src/useBubbleField.ts` | 输入框交互 |
| 269 | `src/voice/tts.ts` | 分句器 + 清洗 + 播放队列 |

---

## 三、运行架构

```
┌──────────── WebView（一套 React 代码） ─────────────┐
│ ChatPage / TaskPage / TodayPage / MemoryPage ...    │
│ api.ts ──HTTPS+Bearer──▶ 自建后端                   │
│ voice/tts.ts ──AudioContext──▶ 播放                 │
└───────▲───────────────────────┬────────────────────┘
        │ Capacitor bridge      │ HTTP
        │                       ▼
┌───────┴────────┐     ┌──────────────────────────┐
│ 原生插件（两端）│     │ Fastify（东京）           │
│ iOS: 3 个 Swift │     │ /api/auth/* /api/ai/chat │
│ Droid: 2 个 Java│     │ /api/voice/tts /course   │
└────────────────┘     └──────┬───────────────────┘
                              │
                    Postgres 16 / Redis 7 / Breeze / DeepSeek
```

---

## 四、双端能力对照

| 能力 | iOS | Android | 实现位置 |
| --- | --- | --- | --- |
| 聊天（SSE） | ✅ | ✅ | `src/api.ts` → 后端 |
| 语音朗读（TTS） | ✅ | ✅ | 服务端 Breeze，客户端只播放 |
| 语音识别（ASR） | ⚠️ 原生代码在，**真机未通** | ❌ 未实现 | iOS `NativeExtrasPlugin.swift` |
| 拍照/选图 | ✅ 系统 picker | ✅ 原生插件 | `NativeCapturePlugin.java` |
| 屏幕时间/步数 | ❌（需付费账号） | ✅ | `NativeInsightsPlugin.java` |
| 本地通知 | ✅ | ✅ | `@capacitor/local-notifications` |
| 灵动岛/实时活动 | ✅ | — | `LiveActivityPlugin.swift` + Widget |
| 原生 Tab 栏/输入框 | ✅ | ❌（走 Web Dock） | `patches/liquid-glass/*` |
| 震动 | ✅ | ❌（no-op） | `nativeExtras.ts` 仅 iOS |

**这张表是审查重点**：Android 在"原生感"上明显弱于 iOS，语音识别两端都没真正跑通。

---

## 五、iOS 代码拆解

### 5.1 工程结构

```
ios/App/App/
  AppDelegate.swift            35 行   启动、通知回调
  SceneDelegate.swift          18 行   场景
  LiveActivityPlugin.swift     95 行   灵动岛/实时活动桥
  Info.plist                            权限声明（麦克风/语音识别/日历/提醒）
ios/App/WayMuseWidget/                  WidgetKit 扩展（倒计时）
ios/App/CapApp-SPM/                     SPM 容器（链接第三方包）
```

### 5.2 三个注入式插件（关键设计）

`patches/liquid-glass/` 下三个 Swift 文件**不在 Xcode 工程里**，而是由 `scripts/inject-native-compose.cjs` 在 `postinstall` 时复制进：

```
node_modules/@ajuarezso/capacitor-liquid-glass/ios/Sources/LiquidGlassPlugin/
  ├─ NativeComposePlugin.swift    4.6 KB  原生输入框桥
  ├─ NativeComposeOverlay.swift   13 KB   原生输入框 UI（盖在 WebView 上）
  └─ NativeExtrasPlugin.swift     27 KB   震动/语音识别/日历/OCR/音频路由
```

**为什么这么绕**（脚本注释里写了，但值得审查）：

1. 工程用的是传统 `project.pbxproj`，每个 `.swift` 要在 4 处显式引用，手改易写坏；
2. Capacitor 的 SPM 插件在 `node_modules` 里通过 `Package.swift` 链接，SPM 会自动编译 target 目录下所有 `.swift`；
3. CI 里 `npm ci` 后 `node_modules` 是全新的，所以必须由 postinstall 重新写入。

**代价**：插件升级会覆盖、依赖路径变了就静默跳过（只 warn 不报错）。这是可审查的设计债。

### 5.3 NativeExtrasPlugin 里有什么（27 KB 的大杂烩）

- 震动 `impact` / `notify`
- 语音识别：`SFSpeechRecognizer` + `AVAudioEngine`，`requiresOnDeviceRecognition`，权限申请，事件 `speechPartial/Final/Error/Cancelled/Debug`
- 日历/提醒事项读写
- OCR（Vision）`recognizeText`
- PDF 文本提取（PDFKit）
- 音频：`playAudio` / `beginCallAudio`（`AVAudioSession` 切 `.playAndRecord` + AEC）/ `endCallAudio` / `audioRoute`

**审查点**：一个文件承担 6 类能力，任何一处改错都影响全部；建议拆成多个 plugin。

---

## 六、Android 代码拆解

```
android/app/src/main/java/app/waymuse/student/
  MainActivity.java          12 行   注册两个插件（必须在 super.onCreate 之前）
  NativeCapturePlugin.java  170 行   拍照/相册（FileProvider + 缩放到 1600px JPEG 82）
  NativeInsightsPlugin.java 233 行   UsageStatsManager + 计步传感器
```

Manifest 权限：`INTERNET`、`CAMERA`、`READ_MEDIA_IMAGES`、`READ_EXTERNAL_STORAGE(maxSdk 32)`，以及 `<queries>` 声明相机/文档选择器。

Gradle：`applicationId app.waymuse.student`，`versionCode 157 / versionName 0.28.1`，release 签名从 Secrets 还原。

**缺口**：没有语音识别插件、没有 `RECORD_AUDIO`、没有震动实现（`nativeExtras` 的 `isNativeExtrasSupported()` 只认 iOS，安卓直接 no-op）。

---

## 七、Web 层关键模块

| 模块 | 要点 |
| --- | --- |
| `src/api.ts` | 游客静默登录、令牌刷新、SSE 解析、`x-waymuse-kb` 头、`synthesizeSpeech` |
| `src/pages/ChatPage.tsx` | 1396 行，聊天全部逻辑（发送、流式、卡片、朗读、通话、导出、搜索） |
| `src/voice/tts.ts` | `SentenceSplitter`（首句 12 字先切）、`cleanForSpeech`（去 Markdown/代码/公式）、`VoicePlayer`（音频队列 + 预取 + abort） |
| `src/call/callSession.ts` | 5 状态机，沉默 10s/30s，`speaking|interrupted → listening` 震一次 |
| `src/pages/CallSheet.tsx` | 58vh 浮窗，portal 挂 body，纯 CSS 玻璃 |
| `src/storage.ts` | 所有 localStorage 键位与迁移，敏感键不进备份 |
| `src/backup.ts` | 导出/恢复（合并模式，原子写，SECRET_KEYS 排除） |
| `src/agent.ts` | 协议解析：`<plans> <memories> <courses> <choices> <deadlines>` |

**服务端提示词已搬走**：客户端不再持有 system prompt，后端 `src/prompts/` 组装（`useServerPrompt: true`）。

---

## 八、关键数据流

### 8.1 聊天
```
用户输入 → ChatPage.sendMessage()
  → api.streamServerChat({useServerPrompt, variables, messages})
  → 后端拼 prompt + 检索经验库 → DeepSeek SSE
  → 前端逐块渲染 → agent.ts 解析协议块 → 卡片/选项
```

### 8.2 语音朗读
```
流式增量 → SentenceSplitter.push() → 句子
  → cleanForSpeech() → VoicePlayer.enqueue()
  → POST /api/voice/tts（服务端带 Breeze key）
  → 音频字节 → decodeAudioData → 播放（播 N 预取 N+1）
```

### 8.3 语音识别（当前状态）
```
CallSheet → startSpeech() → iOS SFSpeechRecognizer
  → speechPartial 事件 → 字幕
  现状：真机 10 轮 partial 全空（No speech detected），已在加打点定位
```

### 8.4 课表截图
```
选图 → 压缩到 1600px → POST /api/course/parse-image
  → 后端视觉模型 → 课程 JSON → 确认卡 → 写入本机课表
```

---

## 九、构建与发布

| 项 | 说明 |
| --- | --- |
| 版本唯一来源 | `package.json`（`__APP_VERSION__` 注入）+ `android/app/build.gradle` 两处必须同步 |
| iOS CI | `macos-26`，产出 unsigned IPA（无签名，需自签） |
| Android CI | `ubuntu-latest`，JDK 21，Secrets 还原 keystore，产出签名 APK |
| 测试 | `vitest run`，168 个测试，**CI 已加 `npm test`**（2026-11-12 补） |
| 时区 | CI 固定 `TZ=Asia/Shanghai`（时间相关测试按国内时区写） |

---

## 十、已知问题（审查时请重点看）

| # | 问题 | 位置 | 严重度 |
| --- | --- | --- | --- |
| 1 | iOS ASR 真机 partial 全空，疑似音频会话停在 `.playback` 或端上模型不支持 | `NativeExtrasPlugin.swift` begin() | 高 |
| 2 | Android 无语音识别插件、无 `RECORD_AUDIO`、无震动 | 整个 android 目录 | 高 |
| 3 | 插件靠 postinstall 注入 `node_modules`，升级依赖可能静默失效 | `scripts/inject-native-compose.cjs` | 中 |
| 4 | `NativeExtrasPlugin.swift` 27 KB 承担 6 类能力 | 同上 | 中 |
| 5 | 原生 Tab 栏/输入框盖在 WebView 之上，任何浮层都必须 `useHideNativeChrome` | `src/chrome.ts` | 中 |
| 6 | 部分注释因历史编辑乱码（`娣诲姞闄勪欢` 之类） | `WebDock.tsx`、`chrome.ts`、`inject-native-compose.cjs` | 低（可读性） |
| 7 | iOS 静音拨片会让 WebAudio 无声 | `voice/tts.ts` | 中 |
| 8 | 免费 Apple 账号 7 天重签，无 CloudKit/App Attest | iOS 工程 | 中 |
| 9 | Turnstile 仍是测试密钥 | 服务端 `.env` | 高（上线前） |
| 10 | 版本号只靠人工同步两处 | `package.json` / `build.gradle` | 中 |

---

## 十一、给审查者的 12 个问题

1. `ChatPage.tsx` 1396 行，是否应拆成 hooks（`useChatStream` / `useVoiceRead` / `useCall`）？拆分边界建议？
2. `VoicePlayer` 的"播 N 预取 N+1"在 abort 时是否有泄漏（AudioBuffer 与 fetch 各一份）？
3. `SentenceSplitter` 首句 12 字强切，会不会在 Markdown 中间切断（比如代码块内）？
4. `cleanForSpeech` 用正则剥协议块，遇到嵌套或未闭合标签会怎样？
5. 通话状态机 `modelDone` 在 `thinking` 时也调 `armSilence`，30 秒挂断是否可能在模型还在回时触发？
6. `useHideNativeChrome` 引用计数，若组件异常卸载（报错边界）会不会永久 hidden？
7. iOS 插件注入方案有没有更稳的替代（本地 SPM 包 / 直接进工程）？
8. `NativeExtrasPlugin` 的音频会话切换顺序（`setCategory` → `setActive` → `overrideOutputAudioPort`）有无竞态？
9. 服务端 `useServerPrompt` 丢弃客户端 system，是否会让旧版客户端的行为静默变化？
10. 备份/恢复用合并模式，冲突键（同 id 不同内容）策略是否明确？
11. 168 个测试里，时间相关的是否都该注入时钟而不是依赖 `TZ`？
12. 双端在"能力不对等"（iOS 有原生 Tab、Android 没有）下，UI 该不该分平台做两套？

---

## 十二、代码阅读路线（建议顺序）

```
1. src/WayMuseReference.tsx     看全局状态与路由怎么装
2. src/api.ts                   看和服务端怎么说话
3. src/pages/ChatPage.tsx       看一次对话的完整生命周期（最长，可跳读）
4. src/voice/tts.ts             看分句/清洗/播放三段
5. src/call/callSession.ts      看状态机（纯逻辑，最好读）
6. patches/liquid-glass/NativeExtrasPlugin.swift   看原生能力怎么桥
7. android/.../NativeCapturePlugin.java            看安卓侧写法对比
8. .github/workflows/*.yml      看出包链路
```

---

## 十三、本地怎么跑

```bash
npm ci                 # postinstall 会把 Swift 注入 node_modules
npm run typecheck
npm run lint
npm test               # 168 tests
npm run build          # dist/
npx cap sync           # 同步到 ios/ android/

# 只验 Web 模式（不需要模拟器）
node serve.cjs dist 8128
# 注入演示态后再截图：
# localStorage['waymuse-demo-entered']='1'
# localStorage['waymuse-demo-profile']='{"callName":"小林",...}'
```
