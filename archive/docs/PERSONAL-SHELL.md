# Personal AI Shell（0.9.0，可选预览）

日期：2026-11-06
入口：`http://127.0.0.1:5174/?shell=1`（默认入口是五 Tab 手机端）

## 定位

以“人”为组织单位的 Personal AI Agent：左侧是唯一持续对话，右侧是由 Memory 驱动的个人状态世界。不是“每个任务一个会话”的通用 Agent，也不是传统 IM 的会话列表 + 详情。

## 桌面端

- 全高双栏：左栏 `minmax(480px, 1.62fr)`，右栏 `minmax(320px, 1fr)`；1px `#E5E6E9` 分隔线，白色画布。
- 左栏：紧凑 Chat Header（头像 + 名称 + 设置）、iOS Messages 气泡（用户 `#007AFF`、AI `#E9E9EB`、最大 72%、18px 圆角、方向性小圆角）、内嵌任务卡、可折叠 Memory 读取状态、底部圆角输入。
- 右栏四模块：今天简报（3 张个性化卡片）、任务（进行中/定时/已完成小标题分组）、记忆（3 组 6 条，搜索/折叠/行内编辑/删除）、AI 伙伴（头像、性格、相处天数、日记、个性化设置）。
- 对话：有 Key 时真实 DeepSeek SSE；无 Key 时本地演示回复。任务卡可加入任务；任务点可切换完成；记忆可编辑/删除；分组可折叠。

## 响应式

- `>= 1024px`：双栏。
- `768–1023px`：左栏占满，右侧通过 Header 的列表按钮打开抽屉。
- `< 768px`：底部五个 Tab：Chat / Today / Tasks / Memories / 我的；Chat 全屏，输入贴安全区；Tab 切换不丢对话状态。

## 首次进入与设置

- 未建档时先走 5 步本地建档（学业 → 称呼/头像 → 陪伴方式 → 数据说明）。
- AI 伙伴设置里可编辑：称呼、学校、专业、年级、主要课程、性格、语气、温度、回复长度、AI 头像、DeepSeek Key。
- 数据区可导出 JSON、清除全部数据（清除后回到建档）。

## 数据持久化

| 数据 | 存储 |
| --- | --- |
| 档案/陪伴方式 | `waymuse-demo-profile` |
| AI 名称/头像 | `waymuse-demo-agent`、`waymuse-demo-agent-avatar` |
| 任务 | `waymuse-demo-tasks`（id/text/detail/status/done） |
| 记忆 | `waymuse-demo-memory-entries`（id/category/text） |
| Shell 对话 | `waymuse-demo-shell-messages` |
| DeepSeek 配置/Key | `waymuse-demo-deepseek-config`、`waymuse-demo-deepseek-key` |

旧数据迁移：`{text,done}` → `doing/scheduled/done`；`string[]` → `{id,category,text}`。

## 文件

| 文件 | 作用 |
| --- | --- |
| `src/shell/PersonalShell.tsx` | Shell、四个模块、移动端 Tab、完整设置、真实 AI、全部状态 |
| `src/shell/shell.css` | 布局、iOS Messages、右栏、移动端、抽屉、设置 |
| `src/main.tsx` | 唯一入口 |
| `src/profile.ts` | 档案/陪伴方式类型与预设 |
| `src/storage.ts` | 档案、任务、记忆、对话、DeepSeek 存储与迁移 |

## 设计 token

- 画布 `#FFFFFF`，分组背景 `#F2F2F7`
- 强调 `#0A84FF`，发送气泡 `#007AFF`
- 接收气泡 `#E9E9EB`，正文 `#111114`，次要 `#777981`
- 分隔线 `#E5E6E9`
- 气泡 18px，卡片 12px，输入 22px
- 几乎不用阴影，靠分隔线和间距建立层级

## 当前边界

- 真实 DeepSeek 仍是“用户自备 Key 直连”；正式版/iOS 要后端代理。
- Today 简报、相处天数、AI 日记仍是占位内容，尚未接真实数据源。
- Memory 自动提取、后台任务执行、连接器是下一阶段。
- 经典 `src/pages/` 与 `WayMuseReference` 保留为归档代码，不再参与入口。
