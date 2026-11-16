# 给 Codex 的 V2 输入清单（DeepSeek，2026-11-16）

> 用途：Codex 做主架构与交互，这里是我这边能提供的**现状事实**，不含设计主张。
> 仓库：`WayMuse-v0.12.0-capacitor`，分支 `feat/native-compose`，HEAD `1a87210`，版本 0.28.2。

---

## 一、两份参考文档（已在仓库）

| 文件 | 内容 | 提交 |
| --- | --- | --- |
| `docs/CODE-BREAKDOWN.md` | 架构、双端能力对照、插件机制、数据流、10 个已知问题、12 个审查问题 | `6aa64bc` |
| `docs/V2-PROPOSAL-deepseek.md` | 我的产品判断（仅供参考，方向以 Codex 为准） | `1a87210` |

---

## 二、页面清单

| 页面 | 文件 | 行数 | 职责 | 当前交互缺口 |
| --- | --- | --- | --- | --- |
| 聊天 | `src/pages/ChatPage.tsx` | 1396 | SSE 对话、卡片渲染、朗读、通话入口、导出 | 单个文件承载全部交互，拆分是前置成本 |
| Today | `src/pages/TodayPage.tsx` | 317 | 时间轴、截止概览、今日简报挂载 | 「今日三件」只有展示，没有开始/完成闭环 |
| 计划/任务 | `src/pages/TaskPage.tsx` | 533 | 任务分组、作业卡、考试卡、添加弹层 | 录入全靠手打；完成回写在 L203 |
| 记忆 | `src/pages/MemoryPage.tsx` | 335 | 大脑图 + 三份明文文件 | **只能看，不能改/删单条** |
| 大脑图 | `src/pages/BrainMap.tsx` | 276 | 五区归位、节点、呼吸动画 | 节点不可点进详情 |
| 设置 | `src/pages/SettingsPage.tsx` | 455 | 账号/配额、模型、陪伴、数据、关于 | 无同步开关（尚未实现） |
| 引导 | `src/Onboarding.tsx` | 366 | 7 步 | 第 7 步已是「可以直接用了」 |
| 登录 | `src/pages/LoginPage.tsx` | — | 邮箱验证码 + 游客 | — |
| 通话浮窗 | `src/pages/CallSheet.tsx` | 200 | 58vh、5 状态机 | 依赖 ASR，当前说不出话 |

---

## 三、数据模型（`src/types.ts`）

```ts
type Page = "聊天" | "Today" | "任务" | "记忆" | "角色";

type Task = {
  id: string; text: string; done: boolean;
  dueAt?: string;          // ISO
  category?: string;
  createdAt: number; completedAt?: number;
};

type Course = {
  id: string; name: string;
  weekday: number;         // 1-7
  start: string; end: string;   // "08:00"
  location?: string;
  weeks?: string;
};

type Memory = {
  id: string; text: string;
  weight: 1 | 2 | 3;
  kind?: "normal" | "emotion" | "habit";
  status?: "pending" | "consolidated";
  source?: "inferred";
  createdAt: number;
};
```

另有（同文件或 `src/profile.ts`）：

```ts
type UserProfile = { callName, agentName, agentAvatar, school, major, grade, direction, temperature, responseLength, ... }
type Assignment / Exam   // 作业与考试，带截止时间与状态
```

### 存储键位（`src/storage.ts`，全部 localStorage，前缀 `waymuse-demo-`）

```
entered / name / agent-name / agent-avatar
courses / tasks / assignments / exams / memories
profile / docs(doc-<id>) / dismissed-habit-keys / last-consolidated-at
chat messages（weymuse-demo-deepseek-messages）
voice-auto（自动朗读）/ voice-on（旧）
search-provider / search-key / search-enabled
auth session（waymuse-auth）
```

**跨设备同步：完全没有。** 所有数据只在本机 localStorage，换机靠导出 JSON 手动恢复（`src/backup.ts`，合并模式）。

---

## 四、接口清单

### 客户端（`src/api.ts`）

| 函数 | 用途 |
| --- | --- |
| `guestLogin` / `requestCode` / `verifyCode` / `refreshSession` | 认证 |
| `fetchMe` / `fetchQuota` / `saveProfile` | 账号与配额 |
| `streamServerChat` | SSE 对话（服务端拼 prompt、检索经验库） |
| `parseCourseImage` | 课表截图识别 |
| `synthesizeSpeech` | TTS（服务端代理 Breeze） |

### 服务端（Fastify，`waymuse-server/src/`）

```
GET  /health           GET  /ready
POST /api/auth/guest   /request-code  /verify  /refresh  /logout
GET  /api/me           /api/me/quota      POST /api/me/profile
POST /api/ai/chat（SSE）  /api/course/parse-image  /api/voice/tts
```

**注意**：`/api/device/raw` 不存在（实测 404，从未实现）；客户端也没有调用它。

---

## 五、「今日三件」现状（按数据流）

```
TodayPage（L233 挂 BriefCard）
  └ BriefCard（L46，读 tasks/assignments/exams，算"最高优先级"）
       └ 只展示：标题 + 剩余数量 + 一条建议
            ↑ 无"开始"按钮
            ↓ 无完成回写

TaskPage（L203 toggleTask）
  └ 完成只改 done/completedAt，不回到 Today 的三件
```

**缺口清单（给 Codex 定交互时参考）**：

1. 「三件」的选取规则现在写在 `BriefCard` 里，不对外暴露，无法被"开始/完成"复用
2. 没有"第一步动作"（用户要的是"现在做什么"，不是"有哪三件"）
3. 完成后 Today 不刷新三件，也不记录"为什么排这个"
4. 跨天没有延续逻辑（昨天没做完的三件去哪了）

---

## 六、记忆的查看/纠正/删除现状

| 能力 | 现状 |
| --- | --- |
| 查看 | 有：大脑图（5 区）+ 三份明文文件（`getDoc/setDoc`） |
| 单条编辑 | **无**，只能改整份文件 |
| 单条删除 | **无**（只能整份覆盖） |
| 来源标注 | 有 `source: "inferred"`（推断出的习惯可删），但 UI 没有入口 |
| 巩固状态 | 有 `pending/consolidated`，`lastConsolidatedAt` 记录上次巩固 |

---

## 七、交互约束（会直接影响 Codex 的设计）

1. **原生层遮挡**：iOS 原生 Tab 栏与输入框画在 WebView 之上，任何全屏/半屏浮层必须调用 `useHideNativeChrome(true)` 让位，否则会被盖住（`src/chrome.ts`）。
2. **双端能力不对等**：
   - iOS：原生 Tab 栏、原生输入框、语音识别（当前坏）、震动、灵动岛
   - Android：无原生 Tab（走 Web Dock）、无语音识别、无震动（`nativeExtras` 只认 iOS）
3. **玻璃只能用 CSS**：`backdrop-filter`，不允许调 `nativeGlass`（会把 WebView 内容一起糊掉）。
4. **ChatPage 1396 行**：任何交互改动都集中在这里，建议先拆 `useCall` / `useVoiceRead` 再改流程。
5. **提示词在服务端**：客户端改不了模型行为，改话术要动 `waymuse-server/src/prompts/`。

---

## 八、需要 Codex 拍板的 7 个设计问题

1. 「今日三件」的选取规则是**规则引擎**（本地可解释）还是**模型生成**（更灵活但不可解释）？
2. 完成一件后，三件是**补位**（立刻补第四件）还是**留白**（今天就是三件）？
3. 记忆的纠正入口放在：大脑图节点 / 文件页 / 对话里说"你记错了"？
4. 跨设备同步先做**全量快照**还是**增量事件**？（影响服务端表设计）
5. 无 ASR 期间，通话浮窗是**隐藏**还是**保留但标注"只能用文字"**？
6. Android 能力缺口（无震动/无识别）在 UI 上**显式提示**还是**静默降级**？
7. V2.0 是否保留「角色/人格」页？（我的判断：保留但降级为设置里的一个入口）

---

## 九、我可以立刻开工的前置项（等 Codex 指令）

| 任务 | 估计 | 风险 |
| --- | --- | --- |
| 拆 `useCall` | 2h | 低（逻辑已独立，有 10 个单测） |
| 拆 `useVoiceRead` | 2h | 低 |
| 三件选取规则抽成纯函数 + 单测 | 3h | 低（可先做，不依赖设计定稿） |
| health.ts 假数据下线/标注 | 30min | 极低（等 chez 一句话） |
| `/api/device/raw` 确认删除 | 10min | 极低（本来就没有） |
