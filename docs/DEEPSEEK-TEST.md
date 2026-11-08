# DeepSeek 真实接入说明

更新：2026-11-06
入口：聊天页 → 左上角连接设置 / 设置 → AI 连接

## 1. 这是什么

聊天页可以接入真实 DeepSeek。填入自己的 API Key 后可以直接验证：

- 真实的多轮对话；
- SSE 流式输出；
- 思考模式（`reasoning_content`）；
- token 用量、延迟；
- 模型列表与连接错误；
- 停止生成。

对话保存在 `waymuse-demo-deepseek-messages`；任务/记忆/档案按手机端自己的存储持久化。

## 2. 使用步骤

1. 到 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建 API Key。
2. 打开底部“聊天”，点左上角连接设置；也可以从 **设置 → AI 连接** 进入。
3. 填 API Key；Base URL 默认 `https://api.deepseek.com`。
4. 模型默认 `deepseek-flash`，也可以填 `deepseek-v4-pro` 或 `/models` 返回的其他模型。
5. 点“测试连接”，成功后保存。
6. 在底部输入框发消息。

## 3. 密钥与隐私

- 默认只写 `sessionStorage`：关闭标签页即失效。
- 密钥只发往你填写的 Base URL；默认就是 `api.deepseek.com`。
- 发送时会带入学业档案、称呼、记忆和任务（配置里默认开启上下文）。
- 连接设置里的“清除密钥”只清除 Key；“新对话”清空本地对话。

**不要在正式 App 里内置长期 Key。** 浏览器/客户端的 Key 可以被提取；正式版应通过自己的后端代理调用 DeepSeek，并做额度、频率、内容治理。

## 4. 实际请求

请求：

```http
POST https://api.deepseek.com/chat/completions
Authorization: Bearer <key>
Content-Type: application/json
```

Body 关键字段：

```json
{
  "model": "deepseek-flash",
  "messages": [{ "role": "system", "content": "..." }],
  "stream": true,
  "stream_options": { "include_usage": true },
  "temperature": 1.3,
  "max_tokens": 2600,
  "thinking": { "type": "disabled" }
}
```

`temperature` 和 `max_tokens` 由“设置 → 陪伴风格”决定：

- 短回复：700 tokens
- 中回复：1400 tokens
- 长回复：2600 tokens
- 温度使用陪伴风格里的 0–2 值；深度思考模式下 API 会忽略温度。

system prompt 还会带入学业档案（学校/专业/年级/主要课程）、称呼、陪伴类型、语气和回复长度。

开启深度思考时：

```json
{
  "thinking": { "type": "enabled" },
  "reasoning_effort": "high"
}
```

响应是 SSE：每行 `data: {...}`，最后 `data: [DONE]`。流式增量在 `choices[0].delta.content`，思考过程在 `choices[0].delta.reasoning_content`，用量在最后一个 chunk 的 `usage`。

## 5. CORS

已在 2026-11-06 实测：

- `OPTIONS https://api.deepseek.com/chat/completions` 返回 200；
- `Access-Control-Allow-Origin` 会回显 `http://127.0.0.1:5174`；
- 允许 `POST` 和 `authorization,content-type` 请求头；
- 401 响应也带 `Access-Control-Allow-Origin`。

因此 localhost 个人测试可以直连，不需要代理。正式版如果换域名/换后端，仍需重新验证 CORS。

## 6. 错误排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 401 | Key 无效/过期 | 重新生成 Key |
| 402 | 余额不足 | 到 DeepSeek 平台充值 |
| 429 | 频率限制 | 降低频率，稍后重试 |
| 400 | 模型名/参数不支持 | 检查模型、`thinking`、`max_tokens` |
| `Failed to fetch` | 网络/CORS/Base URL | 检查网络与 Base URL；localhost 直连已支持 |
| 没有返回内容 | 模型只返回思考/被截断 | 调大 max_tokens，或关闭思考模式重试 |

## 7. 移植到 iOS 时

当前实现分三层，移植时尽量保留前两层：

| 文件 | 作用 | 移植方式 |
| --- | --- | --- |
| `src/deepseek/types.ts` | 配置、消息、用量类型 | 直接复用 |
| `src/deepseek/client.ts` | fetch + SSE 解析 | 换成 URLSession/原生流，或继续用 WKWebView fetch |
| `src/deepseek/prompt.ts` | 系统提示词 + 本地上下文 | 直接复用 |
| `src/pages/ChatPage.tsx` | 聊天页（连接设置 + 对话 UI） | SwiftUI 重写，或 Capacitor 里继续用 |
| `src/storage.ts` 的 DeepSeek 方法 | Key/对话存储 | Keychain + 沙盒文件 |

正式版建议：

1. 后端代理：App 只拿短期会话 token，不持有 DeepSeek 长期 Key；
2. App Privacy 声明“用户内容”；
3. 加内容过滤、举报、屏蔽（Guideline 1.2）；
4. 做额度/频率限制，避免用户 Key 或你的 Key 被刷；
5. 记录请求 ID 和错误码，但不要记录完整对话与 Key。

## 8. 已知限制

- 没有真正的 Markdown 表格/链接渲染，只做段落、列表、代码块、粗体、行内代码；
- 没有语音输入、图片输入、文件上传到模型；
- 没有多会话管理，只有一条本地对话；
- 没有成本估算（DeepSeek 价格会变）；
- 没有后端代理、内容审核、账号额度；
- 直接暴露 API Key 只适合个人本机测试。
