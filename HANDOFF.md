# WayMuse 交接文档

> 最后更新：**2026-11-12 上午**
> 合并三份来源：昨晚（11-11 夜）改动交接、0.25.0 的服务端/运维手册、今天上午的核对结果。
> App `0.25.0`（commit `a6a6416`，包已出）· 服务端 `461f574`

---

## 0. 先看这三条

| # | 事项 | 影响 |
| --- | --- | --- |
| ⚠️ 1 | **版本号没升**：仍是 `0.25.0` / `versionCode 151`，与 11-11 下午那版完全相同 | 分发时无法区分；安卓覆盖安装看不出新旧 |
| ⚠️ 2 | **DuckDNS token 曾在对话里露出** | 建议去 duckdns.org 重新生成 |
| ⚠️ 3 | **Turnstile 仍是 Cloudflare 测试密钥**（永远通过） | 等于没有防刷 |

---

## 1. 一句话现状

定位是**知道你的日程并提供陪伴的 Personal AI Agent**，不是"完美课表 UI"。

| 项 | 状态 |
| --- | --- |
| App | iOS + Android 双端可出包；**全走服务端模型，用户不需要任何 Key** |
| 后端 | 东京腾讯云轻量，Docker + 复用自有 Caddy；双域名都通 |
| 提示词 | **已全部搬到服务端**（人格、回复协议、技能正文），客户端零提示词文本 |
| 知识库 | 462 条学长经验在线，聊天自动检索并引用 |
| 识图 | 视觉模型可用；课表截图可解析成结构化课程 |
| 记忆 | 抽象大脑（五区 / 节点 / 呼吸动画）+ 三份明文文件 |
| 计划 | 任务 / 作业 / 考试 / 课表；48·12·2 小时分级提醒 |
| 计费 | 未上线，超额 429，手动加额度 |

---

## 2. 仓库与分支

| 仓库 | 地址 | 分支 / commit |
| --- | --- | --- |
| App | `github.com/zhongzec66-boop/WayMuse-v0.12.0-capacitor` | `feat/native-compose` @ `a6a6416`（文档提交 `26b33dd`） |
| 服务端 | `github.com/zhongzec66-boop/waymuse-server` | `master` @ `461f574` |

- `main` 合并过一次（`c51e679`），之后 18 个提交都在 `feat/native-compose`
- **`github.com:443` 经常不通 → 推送走 SSH（22 端口）**
  - 本机：`~/.ssh/gh_app`、`~/.ssh/gh_server`（仓库 deploy key，写权限）
  - 家里另一台：`D:\tools\ssh\gh_waymuse_server`；前端用 HTTPS + PAT `D:\tools\.waymuse-pat`
- 构建走 GitHub Actions：iOS `macos-26`（unsigned IPA）、Android `ubuntu-latest`（已配签名）

---

## 3. 架构

```
App (Capacitor 8 + React 18)
  聊天 / Today / 计划 / 记忆(大脑) / 助理
  本机：聊天记录 · 课表 · 任务 · 记忆 · 备份
        │  HTTPS + 设备令牌（Bearer）
        ▼
WayMuse API (Fastify, 东京)
  /api/auth/*   QQ 邮箱验证码 / 游客 / 刷新
  /api/me*      账号、资料、配额
  /api/ai/chat  SSE 代理 → deepseek-flash
                 · useServerPrompt=true 时服务端拼 system prompt
                 · 检索 kb_entries 注入学长经验
  /api/course/parse-image  课表截图 → JSON
        │
   Postgres 16              Redis 7
   users/devices/login_codes   限流 / 计数
   usage_daily/quota_month
   profiles/kb_entries
```

**四条红线：**

1. 模型 Key **只在服务端**，App 不持有任何密钥
2. 聊天记录**只在本机**，服务器只记 token 用量，不存对话正文
3. 经验库是**脱敏镜像**，学校只用于匹配、不进 prompt
4. 提示词、技能、身份边界**都在服务端**，改话术不用发版

---

## 4. 服务器

| 项 | 值 |
| --- | --- |
| 主机 | `101.32.101.117`（腾讯云轻量，东京，2C4G） |
| 系统 | OpenCloudOS 9.6 · Docker 29 |
| 代码 | `/opt/waymuse-server`（备份 `/opt/waymuse-server.bak.1794398005.tgz`） |
| 域名 | **`https://waymuse.duckdns.org`**（新，客户端默认）<br>**`https://api.101-32-101-117.sslip.io`**（旧，保留给旧包） |
| 监听 | `127.0.0.1:8787`（只绑本机，对外由 Caddy 反代） |
| Caddy | 复用 `/opt/new-api` 的容器；配置 `/opt/new-api/Caddyfile`（备份 `Caddyfile.bak.dsh`） |
| 磁盘 | 60G，约 44% |
| 内存 | 3.5G，我们的栈约 80MB；另有 3G swap |

**同机其他服务（勿动）**：`new-api`、`pineapple-*`、`chuangzuo`、`welfare-quote-admin`、`new-api-caddy`。
`snowluma`（DeepSeek→QQ 桥）已停未删，回滚：`docker update --restart=always snowluma && docker start snowluma`。

### 4.1 环境变量（`/opt/waymuse-server/.env`，600）

| 变量 | 说明 |
| --- | --- |
| `JWT_SECRET` | 令牌签名 |
| `DATABASE_URL` / `REDIS_URL` | 指向 compose 内 `db` / `cache` |
| `DEEPSEEK_API_KEY` | 模型 Key（不进仓库） |
| `DEEPSEEK_MODEL` | `deepseek-flash`（**支持视觉**） |
| `MONTHLY_TOKEN_LIMIT` | `1000000` |
| `DAILY_TOKEN_LIMIT` | `100000` |
| `GLOBAL_DAILY_COST_CENTS` | `1000`（¥10/天全站熔断） |
| `SMTP_*` | QQ 邮箱 + 授权码（登录码 / 告警） |
| `TURNSTILE_SECRET` | **测试密钥，未换真** |

---

## 5. 数据库（`waymuse`）

```sql
users / devices / login_codes      -- 账号与设备（最多 2 台）
profiles                           -- 学校/专业/年级/方向
usage_daily / quota_month          -- 个人用量
global_usage_daily                 -- 全局成本熔断
kb_entries / kb_query_log          -- 经验库与检索日志
sync_state                         -- 预留同步游标
```

迁移：`migrations/001_init.sql`、`002_knowledge.sql`，`npm run migrate`。

---

## 6. API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 存活（监控用） |
| GET | `/ready` | 依赖检查（db / mail） |
| POST | `/api/auth/guest` | 游客登录，60 次/IP/天 |
| POST | `/api/auth/request-code` | 发验证码（Turnstile + 限流） |
| POST | `/api/auth/verify` | 验证码登录/注册 |
| POST | `/api/auth/refresh` | 刷新（轮换） |
| POST | `/api/auth/logout` | 吊销本设备 |
| GET | `/api/me` | 账号 + 设备 + 资料 |
| POST | `/api/me/profile` | 学校/专业/年级/方向 |
| GET | `/api/me/quota` | 配额卡 |
| POST | `/api/ai/chat` | SSE 代理；支持 `useServerPrompt` + `variables` |
| POST | `/api/course/parse-image` | 课表截图 → 课程 JSON（20 次/人/天） |

**`/api/ai/chat` 新协议（向后兼容）：**

```json
{
  "useServerPrompt": true,
  "variables": { "today": "...", "courses": [], "memories": [] },
  "messages": [{ "role": "user", "content": "..." }]
}
```

- 带 `useServerPrompt`：服务端拼 system prompt，**丢弃客户端发来的 system**
- 不带：老逻辑，**旧包不受影响**

**响应头：**

| 头 | 含义 |
| --- | --- |
| `x-waymuse-kb` | 命中的经验条数 |
| `x-waymuse-kb-tags` | 参考方向（URL 编码 JSON） |
| `x-waymuse-skill` / `x-waymuse-skill-name` | 命中的技能 id / 中文名 |

**输出协议块**：`<plans>` `<memories>`（带 `kind`: emotion/normal）`<courses>` `<choices>` `<deadlines>`

---

## 7. 服务端提示词结构（`src/prompts/`，325 行）

| 文件 | 内容 |
| --- | --- |
| `base.ts` | 身份边界、陪伴方式标题 |
| `protocol.ts` | 回复协议：plans / memories / courses / choices / deadlines |
| `skills.ts` | 技能正文，命中才注入 |
| `index.ts` | 组装 + 变量替换（today / courses / memories） |

---

## 8. 配额与成本

| 项 | 值 |
| --- | --- |
| 月额度 | 100 万 token / 人 |
| 日额度 | 10 万 token / 人 |
| 全局熔断 | ¥10/天（≈¥300/月，**超 ¥200 预算**） |
| 成本模型 | 输入 100 分/M、输出 200 分/M ≈ ¥3~5/人/月 |
| 识图 | 约 2000 token/张（按 1500 计入配额） |

> 要压到 ¥200 以内：`GLOBAL_DAILY_COST_CENTS=650`。

---

## 9. 客户端关键文件

| 文件 | 职责 |
| --- | --- |
| `src/WayMuseReference.tsx` | 顶层状态 / 路由 / Dock |
| `src/api.ts` | 服务端客户端（默认 `waymuse.duckdns.org`） |
| `src/useAccount.ts` | 账号 + 静默游客登录 |
| `src/pages/ChatPage.tsx` | 聊天（SSE / 选项气泡 / 代码卡 / 引用条） |
| `src/pages/AccountPanel.tsx` | 账号 / 配额 / 我的信息 |
| `src/pages/SettingsPage.tsx` | 设置（4 大块，无 Key 输入） |
| `src/pages/LoginPage.tsx` | 邮箱验证码登录（**全屏浮层**） |
| `src/pages/CourseImportSheet.tsx` | 课表导入（截图 + 文本） |
| `src/pages/DeviceDataPanel.tsx` | Android 屏幕时间 / 步数授权 |
| `src/pages/MemoryPage.tsx` | 记忆页（大脑 / 文件两子页） |
| `src/brain.ts` + `src/styles/brain.css` | 抽象大脑：五区、节点、巩固 |
| `src/deepseek/CodeBlock.tsx` | 代码卡（高亮 / 复制 / 全屏） |
| `src/nativeCapture.ts` / `nativeInsights.ts` | Android 原生能力 |
| `src/backup.ts` | 导出 / 恢复（合并 = 保留现有、补齐缺失） |
| `src/styles/layout.css` | **底部让位唯一真相**（`--dock-clear`） |

Android 原生（Java）：`NativeCapturePlugin`（拍照降采样）、`NativeInsightsPlugin`（UsageStats + 计步）。

---

## 10. 昨晚（11-11）改了什么

### 后端

| 提交 | 内容 |
| --- | --- |
| `82094fd` | 提示词搬到服务端 |
| `b81bb77` | 修：技能头写进 `writeHead`（`reply.header()` 会被流式绕过） |
| `fd48905` | 技能名由服务端下发 |
| `3157a17` | 身份边界与陪伴标题搬到服务端 |
| `549d84e` | 协议新增 `<deadlines>` |
| `461f574` | 记忆提议带 `kind`（情绪/普通） |

### 前端

| 提交 | 内容 |
| --- | --- |
| `5382cfb` | 主色蓝 → 品牌绿 `#036F3B` |
| `aa5d906` | 背景纸质奶白 + 内联 SVG 纸纹 |
| `b90e1eb` | 用户气泡改绿、宽 78%、行高 1.55 |
| `33e4713` `a6a6416` | 顶栏真毛玻璃 + 悬浮头像胶囊；去掉背板 |
| `61e47d4` | 提醒 48/12/2 分级 |
| `1ab6d9c` | 学期结构化数据；上课前 40 分钟算法 |
| `a59ffb1` | 作业/考试落盘（坏数据整条丢弃） |
| `104f14d` | 计划页作业卡 / 考试卡 / 弹层 |
| `77a2d16` | 模型可提议作业/考试；Today「N 个今天/明天到期」 |
| `e04d1f6` `7e2e97b` `2357ea7` | 大脑记忆页（**149 个单测全过**） |
| `986337d` | 修：登录页被 `overflow:hidden` 挤出 → 全屏浮层 |

---

## 11. 运维手册

### 部署后端

```bash
ssh -i ~/.ssh/waymuse_deploy root@101.32.101.117
cd /opt/waymuse-server
git fetch --depth=1 origin master && git reset --hard FETCH_HEAD
docker compose up -d --build waymuse-api
docker compose exec -T waymuse-api npm run migrate
curl -s localhost:8787/health
```

### 回滚

```bash
# 后端
cd /opt/waymuse-server && git log --oneline -5
git reset --hard <commit> && docker compose up -d --build waymuse-api

# Caddy
cp /opt/new-api/Caddyfile.bak.dsh /opt/new-api/Caddyfile
docker restart new-api-caddy
```

### Caddy 改动流程（重要）

```bash
cp /opt/new-api/Caddyfile /opt/new-api/Caddyfile.bak.$(date +%s)
# 编辑后先校验，别直接重启
docker cp /opt/new-api/Caddyfile new-api-caddy:/tmp/C.tmp
docker exec new-api-caddy caddy validate --config /tmp/C.tmp
docker restart new-api-caddy
```

### 备份 / 告警

```bash
/opt/waymuse-server/backup-db.sh        # 每天 04:10，保留 14 天
ls -lh /opt/backups/db
```

- cron 每 5 分钟查 `/health`，失败发邮件（30 分钟内只发一次）
- 日志：`docker logs waymuse-api --tail 100`

### 出包

```bash
curl -X POST -H "Authorization: Bearer <PAT>" \
  -H "Accept: application/vnd.github+json" \
  -d '{"ref":"feat/native-compose"}' \
  https://api.github.com/repos/zhongzec66-boop/WayMuse-v0.12.0-capacitor/actions/workflows/ios-build.yml/dispatches
```

产物：GitHub Actions artifacts；本机解压到 `H:\ai工作区\_work\waymuse-ipa\`。

### 本地校验

```bash
npm run typecheck && npm run lint && npm test && npm run build   # 149 tests
```

---

## 12. 待办

### 上线前必做

| # | 事项 | 说明 |
| --- | --- | --- |
| 1 | **升版本号** | 现在 0.25.0/151 与旧包同号，建议 0.26.0/152 |
| 2 | 真实 Turnstile | 测试密钥等于没有验证 |
| 3 | 数据导出/删除端点 | PIPL 要求可查可删 |
| 4 | 隐私政策定稿 | App 内已说明"经过服务器"，正式政策要写数据出境 |
| 5 | 异地备份 | 备份与服务器同机，建议传 COS |
| 6 | DuckDNS token 轮换 | 曾在对话里露出 |
| 7 | Android keystore 轮换 | 旧 keystore 曾在共享 zip 泄露 |

### 功能

| # | 事项 | 备注 |
| --- | --- | --- |
| 8 | 复盘当场触发巩固 | 现在只有"打开 App 时补处理" |
| 9 | 上课前 40 分钟提醒接线 | `planClassReminders()` 已写，未接入通知同步 |
| 10 | 其余三种消息卡 | 任务卡 / 来源卡 / 系统卡 |
| 11 | 服务端定时任务 | 夜里跑复盘（A 方案），需 cron + 推送通道 |
| 12 | 多会话 | 列表 / 重命名 / 导出 / 删除 |
| 13 | 文档输出 | 结构化文档 → .md / 长图 |
| 14 | .ics 导入导出 | 解析 VEVENT 写进 App 课表（不碰系统日历） |
| 15 | 课表云同步 | 需服务端课表表（S1） |
| 16 | 管理员加额度接口 | 充值方案定了再做 |
| 17 | 经验库 k-匿名 + 定期同步 | 现在人工导 CSV |

### 待真机验证

- 胶囊 `backdrop-filter`：要让绿色气泡从下面滚过才看得出来
- 三条验收：习惯生成（同类 3 次）、昨天 pending 的巩固、情绪记忆归杏仁区
- 登录页能否正常打开（已改成全屏浮层）
- 大脑页巩固动画只在逻辑层验证过，动画本身没在真机看过

### 明确不做

- 语音输入 / 朗读
- iOS 设备数据（屏幕时间/健康）——需付费账号
- Health Connect（心率/睡眠）

---

## 13. 待决策

1. **充值套餐**：免费额度多少？超额停还是降速？怎么收钱？
2. **全局熔断**：¥10/天（≈¥300/月）还是压到 ¥6.5/天（≈¥200 预算）？
3. **正式域名**：继续用 `waymuse.duckdns.org`，还是接自有域名？
4. **旧域名何时下线**：旧包还依赖 sslip.io，需要先让旧用户升级。

---

## 14. 凭据位置（两套，别混）

| 项 | 本机（工作 Windows） | 家里那台 |
| --- | --- | --- |
| 服务器 SSH | `~/.ssh/waymuse_deploy` | `D:\tools\ssh\waymuse_deploy_agent` |
| 服务端 deploy key | `~/.ssh/gh_server` | `D:\tools\ssh\gh_waymuse_server` |
| 前端推送 | `~/.ssh/gh_app` | PAT `D:\tools\.waymuse-pat`（HTTPS） |
| 模型 / SMTP / JWT | 服务器 `.env`（600） | 同 |

**不要**把 `.env`、keystore、私钥、PAT 提交进仓库。
