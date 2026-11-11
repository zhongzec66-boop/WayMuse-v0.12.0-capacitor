# WayMuse 交接文档

> 最后更新：2026-11-11 · App `0.25.0` · 服务端 `9b315f3`
> 覆盖上一版 `0.11.0` 的交接内容。
> 定位：**知道你的日程并提供陪伴的 Personal AI Agent**，不是"完美课表 UI"。

---

## 1. 一句话现状

| 项 | 状态 |
| --- | --- |
| App | iOS + Android 双端出包，测试阶段，**全走服务端模型，用户不需要任何 Key** |
| 后端 | 东京腾讯云轻量服务器，Docker + 复用自有 Caddy，HTTPS 正常 |
| 知识库 | 462 条学长经验在线，聊天自动检索并引用 |
| 识图 | 视觉模型可用（图片直接进模型）；课表截图可解析成结构化课程 |
| 计费 | 未上线，配额超额直接 429，手动加额度 |

---

## 2. 仓库与分支

| 仓库 | 地址 | 当前分支 / commit |
| --- | --- | --- |
| App | `github.com/zhongzec66-boop/WayMuse-v0.12.0-capacitor` | `feat/native-compose` @ `70b69b0` |
| 服务端 | `github.com/zhongzec66-boop/waymuse-server` | `master` @ `9b315f3` |

**注意：**
- `main` 已合并过一次（`c51e679`），但之后的功能都在 `feat/native-compose`，合并前要先同步。
- `github.com:443` 在本机经常不通，**推送走 SSH（22 端口）**：
  - App 用 `~/.ssh/gh_app`，服务端用 `~/.ssh/gh_server`
  - 已注册为两个仓库的 **deploy key**（写权限），不是账号级 key
- 构建走 GitHub Actions（本地无法编译 iOS）：
  - iOS：`macos-26`，产出 unsigned IPA
  - Android：`ubuntu-latest`，产出 APK（已配 release 签名）

---

## 3. 架构

```
┌────────────── App (Capacitor 8 + React 18) ──────────────┐
│  聊天 / Today / 计划 / 记忆 / 助理                        │
│  课表(本机) · 任务 · 记忆 · 备份                             │
│  ── 图片/截图 ──┐                                        │
└─────────────────┼────────────────────────────────────────┘
                  │ HTTPS  Bearer(设备令牌)
                  ▼
┌──────── WayMuse API (Fastify, 东京) ─────────────────────┐
│  /api/auth/*      QQ 邮箱验证码 / 游客 / 刷新 / 登出        │
│  /api/me*         账号、资料、配额                          │
│  /api/ai/chat     SSE 代理 → deepseek-flash               │
│  /api/course/parse-image  截图 → JSON 课程                 │
│  ── 注入学长经验(检索 kb_entries)                          │
└───────┬──────────────────┬───────────────────────────────┘
        │                  │
   Postgres 16         Redis 7
   users/devices/      限流/计数器
   usage_daily/quota_month
   profiles/kb_entries
```

**关键设计：**
- 模型 Key **只在服务端**，App 不持有任何密钥
- 聊天记录**只在本机**，服务器只记 token 用量，不存对话正文
- 经验库是**脱敏镜像**，不是原库；学校只用于匹配、不进入 prompt

---

## 4. 服务器

| 项 | 值 |
| --- | --- |
| 主机 | `101.32.101.117`（腾讯云轻量，东京，2C4G） |
| 系统 | OpenCloudOS 9.6，Docker 29 |
| 代码目录 | `/opt/waymuse-server` |
| 对外域名 | `api.101-32-101-117.sslip.io`（临时，Let's Encrypt 自动续） |
| API 监听 | `127.0.0.1:8787`（**只绑本机**，对外由 Caddy 反代） |
| Caddy | 复用 `/opt/new-api` 的 Caddy 容器，配置在 `/opt/new-api/Caddyfile` |
| 磁盘 | 60G，当前约 44%（已清理过 4.5G） |
| 内存 | 3.5G，我们的栈约占 80MB；另有 3G swap |

### 4.1 同机其他服务（勿动）

`new-api`、`pineapple-*`、`chuangzuo`、`welfare-quote-admin`、`new-api-caddy`。
`snowluma`（DeepSeek→QQ 桥）**已停但未删除**，回滚方式：
```bash
docker update --restart=always snowluma && docker start snowluma
```

### 4.2 环境变量（`/opt/waymuse-server/.env`，权限 600）

| 变量 | 说明 |
| --- | --- |
| `JWT_SECRET` | 令牌签名密钥 |
| `DATABASE_URL` / `REDIS_URL` | 指向 compose 内的 `db` / `cache` |
| `DEEPSEEK_API_KEY` | 模型 Key（**不写进任何仓库**） |
| `DEEPSEEK_MODEL` | 当前 `deepseek-flash`（**支持视觉**） |
| `MONTHLY_TOKEN_LIMIT` | `1000000` |
| `DAILY_TOKEN_LIMIT` | `100000` |
| `GLOBAL_DAILY_COST_CENTS` | `1000`（¥10/天全局熔断） |
| `SMTP_*` | QQ 邮箱 + 授权码（登录验证码 & 告警） |
| `TURNSTILE_SECRET` | **目前是 Cloudflare 测试密钥（永远通过）** |

---

## 5. 数据库（`waymuse`）

```sql
users              -- 账号（email 可空 = 游客）
devices            -- 设备令牌，最多 2 台
login_codes        -- 邮箱验证码（只存哈希）
profiles           -- 学校/专业/年级/方向（经验匹配用）
usage_daily        -- 每日 token 用量
quota_month        -- 月度用量
global_usage_daily -- 全局成本熔断
kb_entries         -- 经验库（脱敏镜像，462 条）
kb_query_log       -- 检索日志（命中条数）
sync_state         -- 预留：增量同步游标
```

迁移：`migrations/001_init.sql`、`002_knowledge.sql`，执行 `npm run migrate`。

---

## 6. API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 存活（**监控用这个**） |
| GET | `/ready` | 依赖检查（db / mail） |
| POST | `/api/auth/guest` | 游客登录（设备号），60 次/IP/天 |
| POST | `/api/auth/request-code` | 发验证码（Turnstile + 邮箱限流） |
| POST | `/api/auth/verify` | 验证码登录/注册 |
| POST | `/api/auth/refresh` | 刷新令牌（轮换） |
| POST | `/api/auth/logout` | 吊销本设备 |
| GET | `/api/me` | 账号 + 设备 + 资料 |
| POST | `/api/me/profile` | 学校/专业/年级/方向 |
| GET | `/api/me/quota` | 配额卡数据 |
| POST | `/api/ai/chat` | SSE 流式代理（支持 `image_url` 块） |
| POST | `/api/course/parse-image` | 课表截图 → 课程 JSON（20 次/人/天） |

**响应头约定：**
- `x-waymuse-kb`：命中的经验条数
- `x-waymuse-kb-tags`：参考方向（URL 编码 JSON），客户端展开"看看"用

---

## 7. 配额与成本

| 项 | 值 | 备注 |
| --- | --- | --- |
| 月额度 | 100 万 token | 单人 |
| 日额度 | 10 万 token | 单人 |
| 全局熔断 | ¥10/天 | **预算闸门**，超了全站 503 |
| 成本模型 | 输入 100 分/M、输出 200 分/M | 约 ¥3~5/人/月 |
| 识图 | 约 2000 token/张 | 图片按 1500 token 计入配额 |

> ⚠️ 最坏情况：¥10/天 ≈ ¥300/月，**超过 ¥200 预算**。要压预算就把 `GLOBAL_DAILY_COST_CENTS` 调到 650。

---

## 8. 客户端关键文件

| 文件 | 职责 |
| --- | --- |
| `src/WayMuseReference.tsx` | 顶层状态、页面路由、Dock 装配 |
| `src/api.ts` | 服务端客户端（游客登录、刷新、配额、SSE、识图） |
| `src/useAccount.ts` | 账号状态 + 静默游客登录 |
| `src/pages/ChatPage.tsx` | 聊天（服务端流式、选项气泡、代码卡、引用条） |
| `src/pages/AccountPanel.tsx` | 设置页顶部：账号 / 配额 / 我的信息 |
| `src/pages/SettingsPage.tsx` | 设置（4 大块，无 Key 输入） |
| `src/pages/LoginPage.tsx` | QQ 邮箱验证码登录 |
| `src/pages/CourseImportSheet.tsx` | 课表导入（截图识别 + 文本） |
| `src/pages/DeviceDataPanel.tsx` | Android 屏幕时间/步数授权 |
| `src/deepseek/prompt.ts` | 系统提示词（含看图、人话化规则） |
| `src/deepseek/CodeBlock.tsx` | 代码卡（高亮/复制/全屏） |
| `src/nativeCapture.ts` | Android 原生拍照（降采样，防 OOM） |
| `src/nativeInsights.ts` | Android 屏幕时间 / 步数 |
| `src/backup.ts` | 导出/恢复（合并 = 保留现有、补齐缺失） |
| `src/styles/layout.css` | **底部让位唯一真相**（`--dock-clear`） |

Android 原生插件（Java）：
- `NativeCapturePlugin` — 拍照/选图，长边压到 1600px
- `NativeInsightsPlugin` — `UsageStatsManager` + 计步传感器

---

## 9. 已上线功能（0.25.0）

- [x] 游客静默登录 / QQ 邮箱验证码登录 / 最多 2 台设备
- [x] 服务端代理聊天（SSE），带心跳、配额、熔断
- [x] 学长经验检索 + 引用条（可展开看参考方向）
- [x] 识图（图片直接进视觉模型，带缩略图）
- [x] 课表截图 → 结构化课程（7/7 实测命中）
- [x] 选项气泡（点选即答，刷题场景）
- [x] 代码卡（语法高亮 / 复制 / 全屏）
- [x] 计划卡 / 记忆 / 今日简报
- [x] Android 屏幕使用时间 + 步数（授权后进提示词）
- [x] 数据导出 / 恢复（合并模式，不丢数据）
- [x] 设置页 4 大块，字号紧凑，无冗余项

---

## 10. 运维手册

### 部署（服务端）

```bash
ssh -i ~/.ssh/waymuse_deploy root@101.32.101.117
cd /opt/waymuse-server
git fetch --depth=1 origin master && git reset --hard origin/master
docker compose up -d --build waymuse-api
docker compose exec -T waymuse-api npm run migrate
curl -s localhost:8787/health
```

### 回滚

```bash
cd /opt/waymuse-server && git log --oneline -5
git reset --hard <上一个 commit> && docker compose up -d --build waymuse-api
```

### 备份 / 恢复

```bash
# 每天 04:10 自动，保留 14 天
/opt/waymuse-server/backup-db.sh
ls -lh /opt/backups/db

# 恢复演练（建临时库验证，之后删除）
gunzip -c /opt/backups/db/<file>.sql.gz | \
  docker exec -i waymuse-db psql -U waymuse -d restore_test
```

### 监控 / 告警

- cron 每 5 分钟 `curl /health`，失败调 `/opt/waymuse-server/alert.py` 发邮件
- 同一故障 30 分钟内只发一次
- 日志：`docker logs waymuse-api --tail 100`

### Caddy（重要）

- 站点已写进 `/opt/new-api/Caddyfile`，**重启不会丢**
- 改动前先备份，用容器自带 caddy 校验：
  ```bash
  docker cp /opt/new-api/Caddyfile new-api-caddy:/tmp/C.tmp
  docker exec new-api-caddy caddy validate --config /tmp/C.tmp
  docker restart new-api-caddy
  ```

---

## 11. 已知问题 / 待办

### 上线前必做

| # | 事项 | 说明 |
| --- | --- | --- |
| 1 | **真实 Turnstile** | 现在是测试密钥，等于没有验证 |
| 2 | **数据导出/删除端点** | PIPL 要求用户可查可删 |
| 3 | **隐私政策更新** | App 内说明已改，正式政策要写"数据出境到东京" |
| 4 | **异地备份** | 备份与服务器同机，建议传 COS |
| 5 | **Android keystore 轮换** | 旧 keystore 曾在共享 zip 泄露，影响升级 |

### 功能待做

| # | 事项 | 备注 |
| --- | --- | --- |
| 6 | 多会话 | 会话列表 / 重命名 / 导出 / 删除 |
| 7 | 文档输出 | 结构化文档 → 导出 .md / 长图 |
| 8 | .ics 导入导出 | 解析 VEVENT 写进 App 课表（不碰系统日历） |
| 9 | 课表云同步 | 需要服务端课表表（S1），现只在本机 |
| 10 | 管理员加额度接口 | 充值方案定了再做 |
| 11 | 经验库 k-匿名 | 同组 ≥3 条才允许引用；用户单独同意开关 |
| 12 | 经验库定期同步 | 现在靠人工导出 CSV 再导入 |

### 明确不做

- 语音输入 / 朗读（用户决定暂缓）
- iOS 设备数据（屏幕时间/健康）——需付费账号
- Health Connect（心率/睡眠）——依赖重、国内 ROM 支持差

---

## 12. 待决策

1. **充值与套餐**：免费额度多少？超额停还是降速？怎么收钱？
2. **全局熔断**：维持 ¥10/天（≈¥300/月）还是压到 ¥6.5/天（≈¥200 预算）？
3. **正式域名**：现在用 sslip.io 临时域名，接正式域名需改 Caddy 站点。
4. **正式 Turnstile**：需要去 Cloudflare 建站点拿 Sitekey + Secret。

---

## 13. 本地测试脚本

都在 `H:\ai工作区\_work\server\`（Windows 侧，不进仓库）：

| 脚本 | 用途 |
| --- | --- |
| `smoke.mjs` | 接口冒烟（游客/me/quota/401） |
| `ai-test.mjs` | AI 流式对话 |
| `vision-e2e.mjs` | 识图端到端 |
| `course-e2e.mjs` | 课表截图解析 |
| `kb-cases.mjs` | 经验库三种问题命中 |
| `*-check.cjs` / `*-shot.cjs` | CDP 界面验证（需 `serve.cjs` + headless Chrome） |

构建产物：`H:\ai工作区\_work\waymuse-ipa\<版本>\`。

---

## 14. 账号与密钥存放

| 项 | 位置 |
| --- | --- |
| 服务器 SSH 私钥 | `~/.ssh/waymuse_deploy`（本机） |
| GitHub deploy key | `~/.ssh/gh_app`、`~/.ssh/gh_server` |
| GitHub PAT | 本机 git credential（Actions 触发、API） |
| 模型 Key / SMTP / JWT | 服务器 `/opt/waymuse-server/.env`（600） |
| Apple 免费账号 | 7 天重签，无 CloudKit / App Attest |

**不要**把 `.env`、keystore、私钥提交进仓库。
