# 方向决策记录：后续用 Swift + SwiftUI 原生构建

> chez 2026-11-16：「完全使用 Swift 和 SwiftUI 构建后面」。
> 本文记录这个决定的影响面、必须澄清的问题、以及建议的分阶段路径。不含代码。

---

## 一、这句话改变了什么

| 项 | 现在的做法 | 决定后的做法 |
| --- | --- | --- |
| iOS 界面 | React 跑在 WKWebView + 原生插件补能力 | **SwiftUI 原生界面**，WKWebView 退场 |
| 状态与数据 | localStorage（`waymuse-demo-*`） | 原生存储（SwiftData / Core Data / 文件） |
| 交互能力 | Web 层实现 + Capacitor 桥 | 全部原生，不再受 WebView 层叠/手势限制 |
| 与后端 | HTTPS + Bearer，SSE | **不变**，接口契约可原样复用 |
| 网页/iPad 版 | 同一套 React | 需要决定：保留、还是也改原生（iPad Catalyst 或 SwiftUI 自适应） |
| Android | Capacitor + WebView | 需要决定：同步重写（Kotlin/Compose）还是保留现状 |

**这不是"适配"，是重写。** 现有 105 个前端文件里，只有 `src/api.ts` 的接口契约、`src/courseImport.ts` 的解析规则、`src/todayTop3.ts` 的选取规则、`src/semantic` 类的纯逻辑可以直接翻译成 Swift；界面部分（`ChatPage` 1396 行、`TaskPage` 533 行等）是重做。

---

## 一补、范围已定（2026-11-16）：只做 iOS 原生。

Android 与网页版继续保留 Capacitor，不跟着重写；SwiftUI 只覆盖 iOS。

## 二、必须先回答的三个问题

2. **谁写**：朋友那边的 Codex 写 SwiftUI，我继续维护 Capacitor 版并做服务端/数据迁移？还是我也转 Swift？
3. **数据怎么迁**：现有用户/测试机上的课表、任务、记忆、聊天记录在 localStorage 里，原生版需要一次性导入（可复用现有导出 JSON 格式）。
4. **过渡期怎么办**：双端并存多久？TestFlight 上旧版是否继续更新？

---

## 三、建议路径（若确认 iOS 原生优先）

**阶段 0：契约先行（1 周，不写界面）**
- 把 `src/api.ts` 的接口、错误码、SSE 协议整理成一份 `docs/API-CONTRACT.md`，作为 Swift 端唯一依据
- 把纯逻辑（课表解析、今日三件、提醒时间计算）写成**语言无关的测试用例集**（JSON 输入输出），Swift 端照用例实现，两边结果必须一致

**阶段 1：SwiftUI 骨架（1–2 周）**
- 四个 Tab：聊天 / Today / 计划 / 记忆；导航用原生 `TabView`
- 网络层：`URLSession` + SSE 解析；令牌与游客登录复用现有接口
- 存储：SwiftData 三张表（Course / Task / Memory），先做本机

**阶段 2：聊天闭环（2 周）**
- 消息流、SSE 增量、卡片（方案/作业/考试/选项）
- 语音朗读：`AVSpeechSynthesizer` 还是继续用服务端 TTS？**建议继续用服务端**（音色一致）

**阶段 3：Today / 计划 / 记忆（2–3 周）**
- 「今日三件」用阶段 0 的用例对齐
- 课表导入：Vision OCR + 现有 `/api/course/parse-image`
- 记忆：可看/改/删

**阶段 4：迁移与并行（1 周）**
- 导入旧版导出 JSON
- TestFlight 双版本并行，收集反馈

---

## 四、现在这套 Web 代码何去何从

**不要立刻删。** 三个用途：

1. **契约与用例的来源**：Swift 端照着它对齐行为（尤其课表解析的边界）
2. **网页/iPad 版**：如果保留网页版，它就是现成实现
3. **回退路径**：原生版出问题时，TestFlight 还能发 WebView 版

刚做的 Duo 竖向胶囊（`feat/duo-rail-web`，commit c3b2eca）属于**网页/窄屏的过渡实现**，若确认全原生，这条分支可以直接丢弃，不合并。

---

## 五、我的建议

1. 先只做 **iOS 原生**，Android 与网页版暂时保留 Capacitor——这是唯一能在 4–6 周内看到可测版本的范围。
2. 阶段 0 的「契约 + 用例集」由我做，因为现有逻辑在我手上；SwiftUI 由朋友的 Codex 主写，我做服务端与数据迁移配合。
3. 在契约定稿前**不要动现有 Capacitor 版的业务代码**，避免两边同时改、行为漂移。

---

写于 2026-11-16。未改代码。
