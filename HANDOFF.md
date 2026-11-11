# WayMuse 交接 · 2026-11-11 夜

> 上一版交接（0.25.0）已被本文覆盖。本文只写**今晚动了什么**与**现在处于什么状态**。

## 一句话

今晚把「后端收口」和「界面定稿」两件事一起推完了：提示词与域名搬完，界面按设计稿换了主色、背景、气泡、卡片，记忆页换成抽象大脑。

---

## 一、后端（仓库 `waymuse-server`）

| 提交 | 做了什么 |
|---|---|
| `82094fd` | **提示词模板搬到服务端**。人格、回复协议、四段技能正文不再在客户端 |
| `b81bb77` | 修：技能响应头写进 `writeHead`（`reply.header()` 会被流式响应绕过） |
| `fd48905` | 技能名由服务端下发，客户端不再内置能力清单 |
| `3157a17` | 身份边界与「陪伴方式」标题也搬到服务端，客户端零提示词文本 |
| `549d84e` | 协议新增 `<deadlines>` 块，模型可提议作业/考试 |
| `461f574` | 记忆提议带 `kind`（emotion / normal），附两个判定例子 |

**接口变化**（向后兼容）：

```json
POST /api/ai/chat
{ "useServerPrompt": true,
  "variables": { "today": "...", "courses": [...], "memories": [...] },
  "messages": [{ "role": "user", "content": "..." }] }
```

- 带了 `useServerPrompt`：服务端拼 system prompt，并**丢掉客户端发来的 system**
- 不带：完全走老逻辑，**已发出去的旧包不受影响**
- 响应头新增 `x-waymuse-skill`（id）、`x-waymuse-skill-name`（中文名）

## 二、域名与部署

| 项 | 值 |
|---|---|
| 新域名 | `https://waymuse.duckdns.org`（DuckDNS，A 记录指向 `101.32.101.117`） |
| 旧域名 | `https://api.101-32-101-117.sslip.io` **保留**，旧包靠它活着 |
| Caddy | 新站点已加进 `/opt/new-api/Caddyfile`，备份为 `Caddyfile.bak.dsh` |
| 服务器 | `/opt/waymuse-server`，已同步到 `461f574`，容器已重建 |
| 服务器备份 | `/opt/waymuse-server.bak.1794398005.tgz` |

**回滚 Caddy**：

```bash
cp /opt/new-api/Caddyfile.bak.dsh /opt/new-api/Caddyfile
docker restart new-api-caddy
```

**回滚后端代码**：

```bash
cd /opt/waymuse-server && git fetch --depth=1 origin master && git reset --hard FETCH_ORIGIN
docker compose up -d --build waymuse-api
```

## 三、前端（仓库 `WayMuse-v0.12.0-capacitor`，分支 `feat/native-compose`）

### 3.1 主题与视觉

| 提交 | 内容 |
|---|---|
| `5382cfb` | 全 App 主色由蓝换品牌绿 `#036F3B`（含暗色模式、写死的蓝色阴影） |
| `aa5d906` | 背景改纸质奶白 + 细纸纹（内联 base64 SVG 噪点，不额外带图片） |
| `b90e1eb` | 聊天气泡：用户气泡改绿、宽 78%、行高 1.55、尖角 6px |
| `33e4713` `a6a6416` | 顶部悬浮头像胶囊：56px 头像 + 下方 -8px 胶囊（真 `backdrop-filter`），无背板 |

### 3.2 计划与提醒

| 提交 | 内容 |
|---|---|
| `61e47d4` | 截止提醒改成 **48 / 12 / 2 小时分级**，过期档位不补发 |
| `1ab6d9c` | 学期结构化数据：作业 / 考试 / 课程学分考核方式；上课前 40 分钟算法 |
| `a59ffb1` | 作业与考试落盘（坏数据整条丢弃，不连累整个列表） |
| `104f14d` | 计划页作业卡 + 考试卡 + 添加弹层 |
| `77a2d16` | 模型可提议作业/考试（确认卡）；Today 顶部「N 个今天/明天到期」 |

### 3.3 大脑记忆页

| 提交 | 内容 |
|---|---|
| `e04d1f6` | 大脑图 + 五区归位 + 巩固逻辑 + 习惯推断（149 个单测） |
| `7e2e97b` | 轮廓改成手挑控制点 + Catmull-Rom；记忆页拆「大脑 / 文件」子页 |
| `2357ea7` | 文案定为「WayMuse 的抽象大脑」 |

### 3.4 修的两个 bug

| 提交 | 问题 |
|---|---|
| `986337d` | **登录点击没反应**：登录页渲染在 `.wr-phone`（`overflow:hidden`）里被挤出可视区，改成全屏 fixed 浮层 |
| `a6a6416` | 顶部胶囊背后垫了一块白背板，把绿色气泡糊成一条绿带；已删背板 |

---

## 四、现在能用的功能

| 模块 | 能力 |
|---|---|
| 聊天 | 服务端模型、流式、方案卡、确认卡（作业/考试）、记忆提议（带情绪标记） |
| 计划 | 任务分组、作业卡、考试卡、课表导入 |
| 提醒 | 48/12/2 分级本地通知；灵动岛倒计时 |
| Today | 时间轴 + 截止概览 |
| 记忆 | 抽象大脑（五区、节点、呼吸动画）+ 三份明文文件 |
| 文件 | PDF（PDFKit）、Word、Excel、图片 OCR |

---

## 五、还没做的（按优先级）

1. **复盘完成当场触发巩固**——验收第 3 条，目前只有「打开 App 时补处理」
2. **上课前 40 分钟提醒接线**——`planClassReminders()` 写好了，还没接进通知同步
3. **6 种消息卡的其余三种**——任务卡、来源卡、系统卡
4. **服务端定时任务**（你选的 A 方案）——夜里跑复盘，需要 cron + 推送通道
5. 大脑页的巩固动画只在逻辑层验证过，**动画本身没在真机看过**

---

## 六、待真机验证

- 胶囊的 `backdrop-filter` 模糊：预览里白底气泡上不明显，需要让**绿色气泡**从胶囊下滚过
- 三条验收：习惯生成（同类任务 3 次）、昨天 pending 的巩固、情绪记忆归杏仁区
- 登录页是否能正常打开

---

## 七、环境与凭据

| 项 | 位置 |
|---|---|
| 服务器 SSH（我能用的） | `D:\tools\ssh\waymuse_deploy_agent`，出口 IP 已加白名单 |
| GitHub 后端 deploy key | `D:\tools\ssh\gh_waymuse_server`（**只能推 waymuse-server**） |
| 前端推送 | HTTPS + PAT `D:\tools\.waymuse-pat`（SSH key 没生效在它上面） |
| 部署脚本 | `D:\AI工作区\_work (2)\_work\ops\`（Caddy、后端同步、冒烟验证） |
| 截图与验证工具 | `D:\AI工作区\_work (2)\_work\WayMuse\_verify\` |

**注意**：DuckDNS 的 token 曾在对话里露出过，建议去官网重新生成一次。

---

## 八、常用命令

```bash
# 前端
npm run typecheck && npm run lint && npm test && npm run build

# 触发 iOS 构建
curl -X POST -H "Authorization: Bearer <PAT>" \
  -H "Accept: application/vnd.github+json" \
  -d '{"ref":"feat/native-compose"}' \
  https://api.github.com/repos/zhongzec66-boop/WayMuse-v0.12.0-capacitor/actions/workflows/ios-build.yml/dispatches

# 后端部署（服务器上）
cd /opt/waymuse-server && git fetch --depth=1 origin master \
  && git reset --hard FETCH_HEAD && docker compose up -d --build waymuse-api
```

产物：`D:\AI工作区\_work (2)\_work\waymuse-builds\WayMuse-unsigned.ipa`
