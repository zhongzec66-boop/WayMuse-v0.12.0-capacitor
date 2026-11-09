# WayMuse 交接 · 2026-11-10

> 上一版 `0.11.0` 的交接内容已过期，本文覆盖它。

## 一句话现状

**能自己用，但没闭环、没上架。** 核心链路（聊天 → 方案 → 任务 → 提醒）已打通，
但只有装到 iOS 真机才能验证。Android 能出包，没测过。

## 仓库与产物

| 项 | 值 |
|---|---|
| 分支 | `feat/native-compose` @ `33b337a`（领先 main **3 个提交**） |
| main | `3babbe1`（已合并 78 个提交） |
| 最新包 | `D:\AI工作区\_work (2)\_work\waymuse-builds\WayMuse-unsigned.ipa`（2.4 MB，run #74） |
| 构建 | GitHub Actions：`Build unsigned iOS IPA` / `Build Android APK` |
| 安装 | Windows 上用 Sideloadly，免费 Apple ID，7 天要重签 |

### 远端地址

`https://github.com/zhongzec66-boop/WayMuse-v0.12.0-capacitor`

---

## 明天开工，按这个顺序

### 1. 合并 3 个提交到 main

这 3 个都编译通过，但 PDF 和提醒**还没装机验过**：

```
a569b0a  PDF 改用系统 PDFKit（扫描件自动 OCR）
059e747  灵动岛和本地通知统一到期时刻
33b337a  支持「几秒/几分钟后提醒我」+ 方案卡磨砂玻璃
```

先装包验一遍，没问题再合：

```bash
git checkout main
git merge --no-ff feat/native-compose
git push origin main
git checkout feat/native-compose
```

### 2. 给 PAT 加 `workflow` 权限

现在的 token **没有 `workflow` scope**，改不了 `.github/workflows/*`，
所以「在 CI 里跑 `npm test`」这件事推不上去。

去 GitHub → Settings → Developer settings → Personal access tokens →
给这个 fine-grained token 勾上 **Workflow** 权限，然后重新执行我之前那个提交（已撤销，
需要重新写一遍：两个 workflow 的 `npm run lint` 后面加一行 `npm test`）。

### 3. 换掉泄露的 Android 签名密钥

微信传来的 `waymuse-ipa.zip` 里有：

```
signing/waymuse-release.jks     ← 发布签名密钥
signing/password.txt            ← 明文密码
```

**任何人拿到这个 zip 都能签出同源可覆盖安装的包。** 如果还没上架，
直接换一个新 keystore；CI 用的是 GitHub Secrets，换三个值即可。

### 4. 修灵动岛「已过期」显示

`Text(timerInterval: Date()...due)` 在 `due` 过去之后行为未定义，
可能显示 `00:00` 或空白。修法：`dueAt` 过期时改显示静态文案「已逾期 X 分钟」。

位置：`ios/App/WayMuseWidget/WayMuseWidgetBundle.swift`。

### 5. 收尾杂项

- `npm run format:check` 是红的（16 个文件没过 Prettier，是上一批提交留下的）
- 8 个 `src/*.ts` 的**注释**是乱码（GBK 编辑器存过），不影响界面
- `NativeExtrasPlugin.swift` 里的语音代码（`startSpeech` 等）已经没人调用，可以删
- `HANDOFF.md` 之外，`README.md` 也是旧的，和实际功能对不上

---

## 功能现状

### 聊天

| 能力 | 说明 |
|---|---|
| 直连 DeepSeek | 用户自带 Key，流式输出 |
| 本地兜底 | 没 Key 也能给通用方案 |
| 方案卡 | 模型给方案 → 点「加入计划」写进任务（卡片是磨砂玻璃） |
| 记忆提议 | 值得记的事先问，确认后写入 |
| 联网搜索 | 默认开，Bing 结果注入，带来源 |
| 技能 | 命中「考试/复习/论文/复盘」加载对应做法 |
| 渲染 | Markdown + KaTeX 公式 + 表格，模型输出会被转义（防注入） |
| 导出 | 对话导出 Markdown |

### 文件与图片

| 类型 | 实现 | 备注 |
|---|---|---|
| 图片 | iOS Vision OCR | 本地跑，不上传 |
| PDF | **PDFKit**（系统框架） | 抽不到字自动转 OCR（扫描件） |
| Word `.docx` | mammoth | 纯前端 |
| Excel / CSV | SheetJS | 前 3 个 sheet |
| 文本 / 代码 | 直接读 | 上限 16000 字 |

### Today

竖排时间轴，课程 + 任务 + 系统日历合并成一条线，状态分：已结束 / 进行中 / 逾期 / 今天到期。

### 计划

- 任务分组：逾期 / 今天 / 接下来 / 没定时间 / 已完成
- 课程表：7 列网格，支持单双周
- 课表导入：一行一门课 **或** 教务系统表格粘贴（按节次行）+ AI 兜底
- 提醒：本地通知（提前 10 分钟）+ 灵动岛倒计时

### 记忆

- 三份可编辑明文：`IDENTITY.md` / `SOUL.md` / `MEMORY.md`
- 记忆气泡场（可拖动、滑动推开）
- **健康卡是假数据**（`src/health.ts`，固定值，为了调版式）

### 系统集成（iOS）

原生玻璃 Tab 栏 / 原生玻璃输入框 / 灵动岛 / 本地通知 / 全局触觉 / EventKit 日历与提醒事项

### 已砍掉

**语音全部不做**（识别、通话、朗读）。Swift 里还留着方法但没调用。

---

## 已知问题

| # | 问题 | 严重度 |
|---|---|---|
| 1 | PAT 缺 `workflow` 权限，测试进不了 CI | 中 |
| 2 | Android keystore + 密码泄露 | **高** |
| 3 | 灵动岛过期后倒计时显示未定义 | 中 |
| 4 | 包体 2.4MB，1.27MB 是 pdf.js worker（iOS 已不用它，但保留给 Android/Web 兜底） | 低 |
| 5 | `format:check` 红 | 低 |
| 6 | 注释乱码 8 个文件 | 低 |
| 7 | 健康卡假数据 | 低（你自己要求先这样） |

---

## 常用命令

```bash
npm run typecheck     # 类型
npm run lint          # ESLint，0 警告
npm test              # 46 个单元测试（vitest）
npm run build         # 生产构建
npm run format        # Prettier 重排（注意：会动很多文件）
```

触发 iOS 构建（需要 token，见下）：

```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  -d '{"ref":"feat/native-compose"}' \
  https://api.github.com/repos/zhongzec66-boop/WayMuse-v0.12.0-capacitor/actions/workflows/ios-build.yml/dispatches
```

Token 存在 `D:\tools\.waymuse-pat`（**不在仓库里，别提交**）。

---

## 关键文件地图

| 文件 | 干什么 |
|---|---|
| `src/WayMuseReference.tsx` | 应用外壳：状态、路由、提醒/上岛的副作用 |
| `src/pages/ChatPage.tsx` | 聊天，最大的文件 |
| `src/pages/TaskPage.tsx` | 计划 + 课程表 |
| `src/pages/MemoryPage.tsx` | 记忆（三份文件 + 气泡） |
| `src/agent.ts` | 回复协议（`<plans>` / `<memories>`）与解析 |
| `src/fileText.ts` | 文件 → 纯文本（PDF/Word/Excel 分发） |
| `src/ocr.ts` | 图片 OCR + PDF 原生抽取的 JS 桥 |
| `src/taskTime.ts` | 任务到期时刻的**唯一**计算点 |
| `src/reminders.ts` | 本地通知的排程 |
| `src/upnext.ts` | 灵动岛选哪一件事 |
| `src/liveActivity.ts` | 灵动岛桥 + 占岛优先级仲裁 |
| `src/markdown.ts` | Markdown + KaTeX 渲染 |
| `src/courseImport.ts` | 课表解析（单行 / 表格两种格式） |
| `patches/liquid-glass/*.swift` | 原生代码，由 `postinstall` 注入 SPM target |

---

## 两个值得记住的坑

**1. 原生代码不走 pbxproj。**
Swift 文件放在 `patches/liquid-glass/`，`postinstall` 把它们复制进
`node_modules/@ajuarezso/capacitor-liquid-glass/ios/Sources/LiquidGlassPlugin/`，
由 SPM 自动编译。好处是不用改 Xcode 工程；坏处是**不提交 node_modules 就没有原生代码**，
所以这些文件必须留在 `patches/` 里。

**2. 到期时刻只能有一处计算。**
之前灵动岛按 23:59 算、通知按 20:00 算，同一条任务两条通道互相打脸。
现在统一走 `src/taskTime.ts` 的 `taskDueAt()`，有测试锁着。
