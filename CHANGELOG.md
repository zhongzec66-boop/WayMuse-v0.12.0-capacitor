# 0.11.0 · 可操作工作台

- 响应式侧栏、双栏首页与手机单列导航。
- 首页可完成任务；推荐按优先级及日期排序。
- 任务编辑、日期、分类、搜索与删除撤销。
- 课程和记忆可编辑，删除可撤销。
- 删除假定时页面；新增直接体验入口；简化聊天初始画面。
- 验收记录：docs/reports/0.11.0-demo.md。

# 更新记录

## 0.10.0 — 2026-11-06

### 阶段 1：设计地基

- 新增 `src/styles/tokens.css`：三段渐变、玻璃、文字、主色/强调/危险、6 档字号、4 档圆角、4 倍间距、3 档时长、深色模式、安全区、reduced-motion。
- 旧 6 个 CSS 合并为 12 个按组件划分的 `src/styles/*.css`；选择器重复 185 → 0，`!important` 6 → 0。
- 字号取值 30 → 6（12/14/17/20/26/34）；圆角取值 32 → 4（16/28/40/999）。
- 删除 `src/tint.ts` 的全局头像取色；头像只显示，不再写 `--wm-tint`。
- 旧 CSS 移到 `archive/css-legacy/`，旧主题说明移到 `archive/docs/PHONE-THEME-0.9.md`，不参与构建。
- 业务逻辑、数据结构和 DeepSeek 调用未改；页面结构与旧版一致，阶段 2 才开始改 Dock/大标题/动效。

## 0.9.3 — 2026-11-06

### 阶段 A：整理，不加新功能

- 默认入口确定为经典五 Tab（Today / 任务 / 记忆 / 聊天 / 角色）；`?shell=1` 删除。
- `PersonalShell.tsx`、`shell.css`、`docs/PERSONAL-SHELL.md` 移到 `archive/`，不参与 tsc/ESLint/Prettier/Vite。
- 移除只被 Shell 使用的 `TaskStatus / StoredTask / StoredMemory` 和 storage 方法；旧 `memory-entries` 会迁移为经典 `string[]` 记忆。
- 删除“恋人”陪伴类型，保留朋友 / 导师 / 自定义；旧数据在 `normalizeProfile` 中回落为朋友。
- README、HANDOFF、CHANGELOG、APPSTORE、PHONE-THEME 同步真实代码；HANDOFF 顶部标注当前阶段与下一阶段，原阶段 2/3 标记暂缓。
- 除删除“恋人”外不改功能行为。

## 0.9.2 — 2026-11-06

- 全局隐藏可见滚动条：设置、聊天、对话、任务、记忆、建档、抽屉、Shell 等所有滚动区域仍可滚动，但不再显示滑块。
- 使用 `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`，同时覆盖 html/body/#root。
- 深色/浅色、桌面/手机、Firefox/Chromium 都生效。

## 0.9.1 — 2026-11-06

- 头像上传改为修改 **WayMuse 的头像**：入口在设置 → WayMuse 头像、建档第 2 步（称呼与 WayMuse 头像）。
- 头像存到 `waymuse-demo-agent-avatar`，不再写用户档案的 `profile.avatar`；旧 `profile.avatar` 会自动迁移。
- 头像染色改为采样 WayMuse 头像；聊天、角色页、设置页都显示同一个 WayMuse 头像。
- 聊天用户消息不再显示用户头像。

## 0.9.0 — 2026-11-06

### 回到手机端，并换上白色 + 头像染色

- 默认入口恢复为原来的五 Tab 手机端（Today / 任务 / 记忆 / 聊天 / 角色）；桌面双栏 Shell 保留在 `?shell=1`。
- 聊天页改用 iOS Messages 排布：居中 AI 头像/名称、18px 气泡、用户蓝/AI 灰、72% 最大宽度、用户头像、隐藏逐条时间。
- 底部仍使用原来的 Dock（输入框 + 五 Tab），不改成独立聊天页。
- 整体从蓝/薄荷渐变改成白色；卡片、Dock、设置、建档、任务、记忆、角色等表面统一白色玻璃。
- 新增头像取色：canvas 采样后生成 HSL tint，写入 `--wm-tint` / `--wm-tint-rgb` / `--wm-tint-deep`。
- 头像上传改的是 WayMuse 的头像（设置 → WayMuse 头像 / 建档第 3 步），不是用户头像；旧 `profile.avatar` 会自动迁移到 `waymuse-demo-agent-avatar`。
- 白色玻璃表面、边框、选中态、进度条、角色球、任务勾选等跟随头像颜色映射。
- 没有头像时使用中性蓝灰 fallback。

## 0.8.0 — 2026-11-06

### 彻底合并为一个 Personal AI App

- 移除 `?legacy=1` 路由；`PersonalShell` 成为唯一入口，经典页面保留为归档代码但不再渲染。
- Shell 首次打开且未建档时，直接进入 5 步本地建档。
- Shell 的 AI 伙伴设置扩展为完整设置：称呼、学校、专业、年级、主要课程、性格、语气、温度、回复长度、头像、DeepSeek 连接。
- 统一任务存储：Shell 任务写入 `waymuse-demo-tasks`，自动把旧的 `{text,done}` 迁移为 `doing/scheduled/done`。
- 统一记忆存储：新增 `memory-entries`（id/category/text），自动迁移旧的 `string[]` 记忆。
- Shell 对话、任务、记忆都持久化；刷新后保留。
- Shell 设置里增加导出 JSON、清除全部数据（清除后回到建档）。
- 旧的 `src/pages/`、`WayMuseReference` 等保留作为归档，不再参与默认入口。

## 0.7.0 — 2026-11-06

### 经典版能力接入 Personal Shell

- 首次打开 Shell 且未建档时，先走经典版 5 步本地建档，完成后进入 Shell。
- Shell 的本地档案、AI 名称/头像、陪伴方式与经典版共用 storage。
- Shell 聊天接入真实 DeepSeek：有 Key 时流式输出、思考过程、token/延迟；无 Key 时保留本地演示回复。
- Shell 的 AI 伙伴设置弹窗增加 DeepSeek API Key、Base URL、模型、测试连接与保存。
- Shell 发送时使用陪伴风格的温度和回复长度，并带入学业档案/记忆/任务到 system prompt。
- Shell 仍保留占位任务/记忆数据；它们与经典版的任务/记忆尚未统一持久化。

## 0.6.0 — 2026-11-06

### Personal AI Agent 双栏 Shell（新默认界面）

- 新增 `src/shell/PersonalShell.tsx` + `shell.css`，默认入口改为桌面双栏 Shell；经典版保留在 `?legacy=1`。
- 左栏为单一会话流：iOS Messages 语法（蓝/灰气泡、内容自适应、紧凑分组、内嵌任务卡、Memory 读取状态、底部输入）。
- 右栏四个纵向模块：今天简报、任务（进行中/定时/已完成）、结构化记忆（搜索/折叠/行内编辑/删除）、AI 伙伴（头像、性格、相处天数、日记、个性化）。
- 桌面宽度 60–65% / 35–40%，1px 分隔线，白色画布；<1024px 右侧折叠为抽屉；<768px 降级为 Chat / Today / Tasks / Memories / 我的 五个 Tab。
- 所有交互本地 state 模拟：发送消息、加入任务、切换任务状态、编辑/删除记忆、折叠分组、切换 Tab 保持对话。
- AI 伙伴设置弹窗支持改名、上传头像、切换性格与语气。

## 0.5.0 — 2026-11-06

### 本地档案、头像与陪伴方式

- 首次进入改成 5 步：欢迎 → 学业档案 → 称呼与头像 → 陪伴方式 → 数据说明。
- 学业档案：学校、专业、年级、主要课程。
- 头像：本地上传图片，自动裁成 256px JPEG，只存本机；聊天页/角色页/设置页显示。
- 称呼：WayMuse 该怎么称呼你。
- 陪伴方式：朋友 / 恋人 / 导师 / 自定义；自定义可调语气、表达温度、回复长度。
- 设置页新增“个人档案”和“陪伴风格”，可随时修改。
- AI 系统提示词带入学业档案、称呼、陪伴风格和安全边界。
- 聊天请求的温度和 max tokens 由陪伴风格决定（短 700 / 中 1400 / 长 2600）。
- 旧数据迁移：没有 profile 时回退到旧的称呼。

## 0.4.0 — 2026-11-06

### 聊天页直接接入 DeepSeek

- 删除独立的“DeepSeek 测试页”，把真实对话合并进底部“聊天”。
- 聊天页左上角连接设置：API Key、Base URL、模型、Temperature、Max tokens、深度思考、系统提示词、带入演示数据。
- 复用底部输入栏发送：在 Today/任务/记忆页输入后会自动跳到聊天并发送。
- 支持 SSE 流式输出、思考过程、token 用量、首字/总延迟、停止生成、重试、导出、新对话。
- 对话持久化到 `waymuse-demo-deepseek-messages`；密钥默认 `sessionStorage`，可选 `localStorage`。
- 移除假的“当前模型”切换和设置里的测试页入口。
- 设置页新增“AI 连接”区块，和聊天页共用同一份配置。
- 设置页、隐私页、README、上架文档同步改为“聊天页接入”。

## 0.3.0 — 2026-11-06

### DeepSeek 真实测试页

- 新增“设置 → 真实 API → DeepSeek 测试页”。
- 支持多轮对话、SSE 流式输出、停止生成、错误重试、导出 Markdown。
- 支持 `deepseek-flash` / `deepseek-v4-pro` / 手填模型。
- 支持深度思考开关、`reasoning_effort`、思考过程折叠展示、token 用量与首字/总延迟。
- 支持 Base URL、Temperature、Max tokens、系统提示词、带入本地演示数据。
- API Key 默认只写 `sessionStorage`；可选写入 `localStorage`；可单独清除。
- 对话单独保存在 `waymuse-demo-deepseek-messages`，不写入演示数据。
- 新增 `src/deepseek/`（types / config / prompt / client / Markdown）与 `src/deepseek.css`。
- 隐私页与隐私政策补充 DeepSeek 数据流向说明。

### 说明

- 浏览器直连 `https://api.deepseek.com`；已验证 localhost 的 CORS 预检允许 `Authorization` 与 `Content-Type`。
- 这是个人测试页，不是产品级接入。正式版应使用后端代理，不要把长期 API Key 打进 App。

## 0.2.0 — 2026-11-06

### iOS 27 / 上架准备

- 新增 `src/ios.css`：安全区、16px 输入框、44pt 触控热区、`-webkit-backdrop-filter`、降低透明度/增强对比度、无玻璃回退、触屏设备全屏。
- `index.html` 补 `viewport-fit=cover`、状态栏、`color-scheme`、`apple-touch-icon` 和描述。
- `manifest.webmanifest` 补竖屏、分类、id 与 PNG 图标。
- 新增 1024/512/192/180 图标（线连节点 + 琥珀节点）。
- 新增 `docs/APPSTORE-READINESS.md` 与 `docs/PRIVACY.md`。

### 功能

- 任务改为 localStorage 持久化（`waymuse-demo-tasks`）。
- 课程星期加入周日，今天/课程筛选统一使用 `Asia/Shanghai`。
- 设置新增“隐私与数据”：隐私说明、导出 JSON、清除全部演示数据（二次确认）。
- 新增 `PrivacyPage` 与 `ErrorBoundary`。
- 新增 `src/version.ts`，版本升到 0.2.0。

### 修复

- 存储读取增加结构校验，损坏/旧数据不再让 Today 排序崩溃。
- 课程 id 改用带 fallback 的 `newId()`，不再直接依赖 `crypto.randomUUID`。
- 清除数据后不再因 effect 回写空的 `courses/tasks/memories` 键。

### 行为变化

- 任务完成状态刷新后保留（此前会重置）。
- 聊天仍然刷新重置，因为还没有真实模型。

### 未做

- 原生 Capacitor/SwiftUI 工程、权限文案、隐私清单。
- 真实 AI/后端、账户、课表导入、日历、本地通知、深色模式、Dynamic Type。
