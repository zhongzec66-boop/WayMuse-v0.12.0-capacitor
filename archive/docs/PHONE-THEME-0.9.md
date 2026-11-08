# 手机端白色主题与头像染色

日期：2026-11-06
入口：`http://127.0.0.1:5174/`

## 1. 结构

默认入口仍是原来的手机端 `src/WayMuseReference.tsx`：

- 底部 Dock：输入框 + Today / 任务 / 记忆 / 聊天 / 角色
- 页面：`src/pages/TodayPage.tsx`、`TaskPage.tsx`、`MemoryPage.tsx`、`ChatPage.tsx`、`PersonaPage.tsx`
- 聊天页使用真实 DeepSeek；未填 Key 时显示连接配置

默认入口是原来的手机端 `src/WayMuseReference.tsx`；旧桌面 Shell 已归档到 `archive/`，不参与入口。

## 2. 白色主题

`src/theme.css` 覆盖原来的蓝/薄荷渐变：

- `.wr-page` / `.wr-phone` / `.wr-content` 白色
- 卡片、Dock、设置、建档、任务、记忆、角色使用白色玻璃
- 聊天：用户 `#007AFF`、AI `#E9E9EB`、18px 圆角、72% 最大宽度
- 底部仍是原 Dock，不改成独立输入条

## 3. WayMuse 头像取色

头像上传改的是 **WayMuse 的头像**（`waymuse-demo-agent-avatar`），不是用户头像。入口：设置 → WayMuse 头像；建档第 3 步也可以设置。

`src/tint.ts`：

1. 把头像缩到 32×32 canvas；
2. 跳过透明、近白、近黑像素；
3. 求平均 RGB；
4. 转 HSL，把饱和度/亮度夹到适合玻璃的区间；
5. 生成三个 CSS 变量。

写入 `document.documentElement`：

| 变量 | 用途 |
| --- | --- |
| `--wm-tint` | 主 tint（角色球、进度、头像） |
| `--wm-tint-rgb` | `rgba()` 表面/边框 |
| `--wm-tint-deep` | 选中态、勾选、链接、深色强调 |

没有头像时使用 `#8FA3B0`（中性蓝灰）。换 WayMuse 头像后 `WayMuseReference` 的 effect 会重新采样并更新。

## 4. 聊天排布

`src/pages/ChatPage.tsx` 保留原 Dock 输入，聊天区：

- 居中 AI 头像 + 名称
- 用户消息右侧、蓝色；AI 消息左侧、灰色
- 不显示用户头像
- 隐藏逐条时间；消息上限 72%
- 思考过程、token/延迟仍保留
- 连接设置在左上角

## 5. 边界

- 取色是整张头像的平均色，不是“主色聚类”；复杂照片可能得到柔和混合色。
- 头像为纯白/纯黑/透明时回退到中性蓝灰。
- 白色玻璃主要靠 tint + 细边框，不使用大阴影。
- 归档的 Shell 不参与这套 `.wr-*` 主题。
