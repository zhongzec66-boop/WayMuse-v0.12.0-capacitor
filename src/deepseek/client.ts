import type {
  ChatRequestMessage,
  DeepSeekConfig,
  DeepSeekUsage,
} from "./types";

export class DeepSeekError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(
    message: string,
    options: { status?: number; code?: string } = {},
  ) {
    super(message);
    this.name = "DeepSeekError";
    this.status = options.status;
    this.code = options.code;
  }
}

export type StreamResult = {
  content: string;
  reasoning: string;
  usage: DeepSeekUsage | null;
  model: string;
  finishReason: string | null;
};

export type StreamHandlers = {
  onDelta?: (text: string) => void;
  onReasoning?: (text: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function chatEndpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    throw new DeepSeekError("Base URL 必须以 http:// 或 https:// 开头");
  }
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

export function modelsEndpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    throw new DeepSeekError("Base URL 必须以 http:// 或 https:// 开头");
  }
  return base.endsWith("/chat/completions")
    ? base.replace(/\/chat\/completions$/, "/models")
    : `${base}/models`;
}

function authHeaders(apiKey: string): Record<string, string> {
  if (!apiKey.trim()) throw new DeepSeekError("缺少 API Key");
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };
}

function parseUsage(value: unknown): DeepSeekUsage | null {
  if (!isRecord(value)) return null;
  const { prompt_tokens, completion_tokens, total_tokens } = value;
  if (
    typeof prompt_tokens !== "number" ||
    typeof completion_tokens !== "number" ||
    typeof total_tokens !== "number"
  ) {
    return null;
  }
  return { prompt_tokens, completion_tokens, total_tokens };
}

async function responseError(response: Response): Promise<DeepSeekError> {
  let message = `请求失败（HTTP ${response.status}）`;
  let code: string | undefined;
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.error)) {
      if (typeof body.error.message === "string") message = body.error.message;
      if (typeof body.error.code === "string") code = body.error.code;
      else if (typeof body.error.type === "string") code = body.error.type;
    }
  } catch {
    // Keep the HTTP status message when the body is not JSON.
  }
  return new DeepSeekError(message, { status: response.status, code });
}

function timeoutSignal(
  external: AbortSignal | undefined,
  milliseconds: number,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort(new DOMException("请求超时", "TimeoutError"));
  }, milliseconds);
  const onAbort = () => controller.abort(external?.reason);
  external?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    clear: () => {
      window.clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
  };
}

export async function listDeepSeekModels({
  baseUrl,
  apiKey,
  signal,
}: {
  baseUrl: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<string[]> {
  const timeout = timeoutSignal(signal, 15000);
  try {
    const response = await fetch(modelsEndpoint(baseUrl), {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: timeout.signal,
    });
    if (!response.ok) throw await responseError(response);
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.data)) {
      throw new DeepSeekError("模型列表格式不正确");
    }
    const ids = body.data
      .map((item) =>
        isRecord(item) && typeof item.id === "string" ? item.id : null,
      )
      .filter((id): id is string => Boolean(id));
    return Array.from(new Set(ids)).sort();
  } finally {
    timeout.clear();
  }
}

export async function streamDeepSeekChat({
  config,
  apiKey,
  messages,
  signal,
  onDelta,
  onReasoning,
}: {
  config: DeepSeekConfig;
  apiKey: string;
  messages: ChatRequestMessage[];
  signal?: AbortSignal;
  onDelta?: StreamHandlers["onDelta"];
  onReasoning?: StreamHandlers["onReasoning"];
}): Promise<StreamResult> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    thinking: { type: config.thinking ? "enabled" : "disabled" },
  };
  if (config.thinking) body.reasoning_effort = config.reasoningEffort;

  const response = await fetch(chatEndpoint(config.baseUrl), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new DeepSeekError("响应没有可读取的数据流");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let usage: DeepSeekUsage | null = null;
  let model = config.model;
  let finishReason: string | null = null;

  const consume = (chunk: string): boolean => {
    buffer += chunk;
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!data) continue;
      if (data === "[DONE]") return true;

      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (!isRecord(parsed)) continue;
      if (isRecord(parsed.error)) {
        const message =
          typeof parsed.error.message === "string"
            ? parsed.error.message
            : "流式响应返回错误";
        throw new DeepSeekError(message, {
          code:
            typeof parsed.error.code === "string"
              ? parsed.error.code
              : undefined,
        });
      }
      if (typeof parsed.model === "string") model = parsed.model;
      const nextUsage = parseUsage(parsed.usage);
      if (nextUsage) usage = nextUsage;
      if (!Array.isArray(parsed.choices) || parsed.choices.length === 0)
        continue;
      const choice = parsed.choices[0];
      if (!isRecord(choice)) continue;
      if (typeof choice.finish_reason === "string") {
        finishReason = choice.finish_reason;
      }
      const delta = choice.delta;
      if (!isRecord(delta)) continue;
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        onDelta?.(delta.content);
      }
      if (
        typeof delta.reasoning_content === "string" &&
        delta.reasoning_content
      ) {
        reasoning += delta.reasoning_content;
        onReasoning?.(delta.reasoning_content);
      }
    }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (consume(decoder.decode(value, { stream: true }))) {
      reader.cancel().catch(() => undefined);
      break;
    }
  }
  if (buffer.trim()) consume("\n\n");

  return { content, reasoning, usage, model, finishReason };
}
