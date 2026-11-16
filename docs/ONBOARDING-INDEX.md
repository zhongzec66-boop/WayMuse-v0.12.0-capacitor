# Onboarding 索引（给今晚入群的原生开发者）

> 一份索引，不重复文档内容。每项给「位置 + 状态」，需要细节点进去看。
> 最后更新：2026-11-16 17:00。

---

## 1. 仓库与分支（完整提交）

| 仓库 | 分支 | 提交 | 说明 |
| --- | --- | --- | --- |
| `WayMuse-v0.12.0-capacitor`（前端 + iOS/Android 壳） | `preview/0.28.3` | `e36881b` | 今日合并三分支的预览分支，**未合主干** |
| 同上 | `feat/native-compose` | `d629a0f` | 主干，已含 PR #1/#2（三件纯函数、时区测试修复） |
| 同上 | `feat/course-import-unify` | `6faaf3f` | PR #4：课表校验/去重纯函数，待 Codex 复核 |
| 同上 | `feat/testflight-prep` | `36d1806` | PR #5：版本对齐 + 导出合规 + TestFlight 核查 |
| 同上 | `feat/duo-rail-web` | `eb3042f` | Duo 竖胶囊（Web）+ 契约文档；若确认全原生可直接丢弃 |
| `waymuse-server`（后端） | `master` | `f5be8f9` | 已部署到东京，`/health` 正常 |
| 同上 | Codex 本地分支 | `61010b8`（补丁） | 语音可靠性修复，**未部署**；静态复核已过，缺路由集成/真实音频测试 |

---

## 2. 基线与依赖

| 项 | 版本/要求 |
| --- | --- |
| Node | 22（CI 与本地一致） |
| 前端 | React 18 + TypeScript + Vite（`npm ci` 后 `postinstall` 会注入 3 个 Swift 文件到 `node_modules` 的 SPM target） |
| 壳 | Capacitor 8；`app.waymuse.student`；iOS 部署目标 15.0（Widget 16.2） |
| Android | JDK 21，Gradle 8.14，minSdk 24 |
| 后端 | Fastify 5 + Postgres 16 + Redis 7；公网 `https://waymuse.duckdns.org` |
| 版本来源 | `package.json` + `android/app/build.gradle`；`node scripts/sync-version.cjs` 同步到 iOS 工程 |

---

## 3. 已验收 / 未验收

### 已验收（有可核证据）

| 项 | 证据 |
| --- | --- |
| 单元测试 217 条 | 本地 `npx vitest run`；UTC 与 Asia/Shanghai 均通过 |
| 类型与 lint | `tsc --noEmit` 0 错；`eslint --max-warnings 0` 0 错 |
| 构建 | `vite build` 成功；CI 双端构建 success |
| 0.28.3 预览包 | iOS run `43831402372`、Android run `43831406287` |
| 服务端健康 | `/health` 200（公网实测） |
| 课表解析与三件选取 | `docs/contract/*.json` 15 条用例，`contractCases.test.ts` 全过 |

### 未验收（不要当成已完成）

| 项 | 状态 |
| --- | --- |
| iOS 真机 ASR | 自检 10 轮 partial 全空；0.28.2 改了音频会话模式，**未真机复验** |
| 语音通话全链路 | 打通了 Web 端状态机与 TTS，但 ASR 未通，不能称可用 |
| TTS 路由集成 | 服务端接口在，但 Codex 的 `61010b8` 未部署，未做真实音频测试 |
| TestFlight 上传 | 未做过；证书、Team、Bundle ID 注册均未验证 |
| 跨设备同步 | 未设计 |
| 网页版四列布局 | 只有设计稿（Codex 的独立 HTML），未迁入 React |

---

## 4. 首包步骤（TestFlight 内测）

1. 账号持有人 Xcode 登录 → Team 选个人团队 → 确认两个 Bundle ID 可用（`app.waymuse.student`、`app.waymuse.student.WayMuseWidget`）
2. Archive → Distribute → App Store Connect 上传
3. ASC 建 App 记录 → TestFlight 内部测试组
4. 首包前必须补：**账号注销**（苹果 5.1.1(v) 硬门槛）、隐私政策公网 URL

细节见 `docs/TESTFLIGHT-READY.md`、`docs/TESTFLIGHT-AUDIT.md`。

---

## 5. 分工与待定项

| 事项 | 归属 | 状态 |
| --- | --- | --- |
| 架构 / 交互 / 验收口径 | Codex | 已定 |
| TTS / Breeze / 语音通话 / 语音条 | Codex | 已定，**我不动这条链路** |
| 独立审计（拆包、源码核验） | Denise | 已定 |
| 工程实现、出包、跨端契约 | DeepSeek | 已定 |
| SwiftUI 主写 | **待定**（外部 Codex 入群后划分） | 未定 |
| Capacitor 版是否冻结功能开发 | 待 Codex 定 | 未定 |
| PR #4 / #5 合并顺序 | 待 Codex 定 | 未定 |
| 学习可视化图形协议 | 待 Codex 定 | 未定（首批：函数曲线、导数切线、几何标注，禁止执行模型返回代码） |

---

## 6. 文档索引（点进去看细节）

| 文档 | 内容 |
| --- | --- |
| `docs/API-CONTRACT.md` | 接口、SSE 协议、响应头、错误码；含"不要实现"清单 |
| `docs/contract/top3-cases.json` | 今日三件 11 条跨语言用例 |
| `docs/contract/course-parse-cases.json` | 课表解析 4 条用例 |
| `docs/CODE-BREAKDOWN.md` | 现有架构、双端能力对照、10 个已知问题 |
| `docs/NATIVE-REWRITE.md` | 原生重写的影响面、范围、阶段 |
| `docs/TESTFLIGHT-READY.md` / `TESTFLIGHT-AUDIT.md` | 上架前置条件与只读核查 |
| `docs/WEB-LAYOUT-ENGINEERING.md` | 网页四列布局的工程映射与迁移清单 |
| `docs/OWNER-REQUIREMENTS.md` | chez 的需求汇总（已定/待定） |
| `HANDOFF.md` | 运维与部署手册 |

---

## 7. 一条提醒

行数不要用来估工时：同一文件在不同统计口径下差几十行（本仓实测 `ChatPage` 约 1500 行、`TaskPage` 约 590 行，以 `git show <ref>:file | wc -l` 为准）。工作量按功能点估，不按行数。

---

整理人：DeepSeek。所有条目均可按表中提交与命令复核。
