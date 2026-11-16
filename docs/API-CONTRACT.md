# API 契约（Swift 端唯一依据）

> 来源：`src/api.ts` 与 `waymuse-server/src/`。Swift 端按本文实现，不要再从 JS 代码里猜。
> 基础地址：`https://waymuse.duckdns.org`（客户端默认；可覆盖）。
> 鉴权：`Authorization: Bearer <device token>`。令牌 15 分钟过期，用 refresh 续。

---

## 0. 通用约定

| 项 | 约定 |
| --- | --- |
| Content-Type | `application/json`（语音接口也是 JSON 请求） |
| 错误体 | `{ "error": "<code>", "reason"?: string }`，HTTP 状态码为准 |
| 401 | 用 refresh 换新令牌后重试一次；失败则重新游客登录 |
| 429 | 配额或限流；前端只提示，不重试 |
| 5xx | 可重试一次（退避 400ms） |

---

## 1. 认证

### POST /api/auth/guest
```json
{ "deviceId": "<string>", "deviceName": "<string>" }
→ 200 { "accessToken": "...", "refreshToken": "...", "user": { "id": "...", "email": null } }
```
同一个 `deviceId` 重复调用会复用账号（最多 2 台设备）。

### POST /api/auth/request-code
```json
{ "email": "a@b.com", "turnstileToken": "...", "deviceId": "..." }
→ 200 { "ok": true }
```

### POST /api/auth/verify
```json
{ "email": "...", "code": "123456", "deviceId": "...", "deviceName": "..." }
→ 200 { accessToken, refreshToken, user }
```

### POST /api/auth/refresh
```json
{ "refreshToken": "..." } → 200 { accessToken, refreshToken }
```

### POST /api/auth/logout
`Bearer` + `{ "deviceId": "..." }` → 200。吊销当前设备令牌。

---

## 2. 账号与配额

### GET /api/me
```json
→ 200 {
  "user": { "id", "email", "createdAt" },
  "devices": [{ "id", "name", "lastSeenAt" }],
  "profile": { "school", "major", "grade", "direction" }
}
```

### GET /api/me/quota
```json
→ 200 { "monthly": { "used", "limit" }, "daily": { "used", "limit" } }
```

### POST /api/me/profile
```json
{ "school": "...", "major": "...", "grade": "...", "direction": "..." } → 200
```

---

## 3. 聊天（SSE）

### POST /api/ai/chat
请求：
```json
{
  "messages": [{ "role": "user|assistant", "content": "<string 或 content part 数组>" }],
  "useServerPrompt": true,
  "variables": { "today": "...", "courses": [], "memories": [] },
  "temperature": 0.7,
  "maxTokens": 2048,
  "model": "deepseek-flash"
}
```
图片消息的 content 用块数组：
```json
[{ "type": "text", "text": "..." },
 { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }]
```

响应：`text/event-stream`，逐行 `data: {...}`，遇到 `[DONE]` 结束。每个 chunk 形如：
```json
{ "choices": [{ "delta": { "content": "…" }, "finish_reason": null }] }
```
模型若先吐 reasoning，会带 `delta.reasoning_content`（客户端不必展示）。

响应头（Swift 端应读取）：
| 头 | 含义 |
| --- | --- |
| `x-waymuse-kb` | 命中的学长经验条数 |
| `x-waymuse-kb-tags` | 参考方向（URL 编码 JSON 数组） |
| `x-waymuse-skill` / `x-waymuse-skill-name` | 命中的技能 id / 中文名 |

回复正文里可能含协议块：`<plans>` `<memories>` `<courses>` `<choices>` `<deadlines>`，解析规则见 `src/agent.ts`（Swift 端需照此实现，用例见 `docs/contract/`）。

---

## 4. 课表截图识别

### POST /api/course/parse-image
```json
{ "image": "data:image/jpeg;base64,..." }
→ 200 { "courses": [{ "name", "weekday", "start", "end", "place", "weeks"? }], "usage": { "used", "limit" } }
```
单个用户 20 次/天。

---

## 5. 语音合成

### POST /api/voice/tts
```json
{ "text": "…", "voiceId"?: "…", "instruction"?: "…" }
→ 200 audio/mpeg（流式字节）
```
响应头：
| 头 | 含义 |
| --- | --- |
| `x-waymuse-cache` | `hit` / `miss` |
| `x-waymuse-chars` | 本次计入配额的字符数 |
| `x-waymuse-voice` | 实际使用的音色 |

错误：`429 quota_exceeded`（附带 `dailyUsed`/`monthlyUsed`）、`502 audio_unavailable`、`400 text_too_long`（>600 字）。
单用户限流 60 次/分钟；客户端每轮最多合成 6 段。

---

## 6. 健康检查

`GET /health` → `{ "ok": true, "now": "<ISO>" }`
`GET /ready` → 依赖（db / mail）状态。

---

## 7. 已知不存在 / 不要实现的接口

- `/api/device/raw`：历史实验接口，服务端从未实现（实测 404），客户端也没有调用。Swift 端不要接。
- 跨设备同步：尚未设计，不要自行约定。

---

写于 2026-11-16，来源为现有实现。若与代码不一致，以代码为准并回头修正本文。
