/**
 * 服务端 API 客户端。
 *
 * 目标：App 不再持有任何 API Key，聊天走后端代理；
 * 游客态先能用，登录后跨设备同步（后续）。
 */

import { Capacitor } from "@capacitor/core";

/** 线上地址；本地调试可用 localStorage 覆盖 */
const DEFAULT_BASE = "https://waymuse.duckdns.org";

const TOKEN_KEY = "waymuse-auth";
const DEVICE_KEY = "waymuse-device-id";

export type AuthUser = {
  id: string;
  email: string | null;
  plan: "free" | "paid";
  is_guest: boolean;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  deviceId: string;
  user: AuthUser;
};

export type Quota = {
  monthlyLimit: number;
  monthlyUsed: number;
  dailyLimit: number;
  dailyUsed: number;
  resetDailyAt: string;
  resetMonthlyAt: string;
  plan: string;
};

export type AccountInfo = {
  user: AuthUser | null;
  devices: Array<{ device_id: string; name: string; last_seen_at: string }>;
  profile: {
    school: string;
    major: string;
    grade: string;
    direction: string;
  } | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function apiBase(): string {
  try {
    const override = localStorage.getItem("waymuse-api-base");
    if (override && /^https?:\/\//.test(override))
      return override.replace(/\/$/, "");
  } catch {
    // 忽略
  }
  return DEFAULT_BASE;
}

/** 设备 id：首次生成后长期保存，卸载重装会变（符合「一台设备一个账号」的设计） */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = `wm-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return `wm-${crypto.randomUUID()}`;
  }
}

function deviceName(): string {
  const platform = Capacitor.getPlatform();
  return platform === "ios"
    ? "iPhone"
    : platform === "android"
      ? "Android"
      : "浏览器";
}

/* ── 会话存储 ─────────────────────────────────────────── */

export function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession | null): void {
  try {
    if (session) localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 存储不可用时忽略
  }
}

/* ── 请求封装 ─────────────────────────────────────────── */

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    token?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const response = await fetch(apiBase() + path, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as Record<string, unknown>).error)
        : `HTTP ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

/* ── 账号 ─────────────────────────────────────────────── */

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  accessTtlSec: number;
  user: AuthUser;
};

function toSession(payload: TokenResponse): AuthSession {
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    accessExpiresAt: Date.now() + payload.accessTtlSec * 1000,
    deviceId: deviceId(),
    user: payload.user,
  };
}

export async function guestLogin(): Promise<AuthSession> {
  const payload = await request<TokenResponse>("/api/auth/guest", {
    method: "POST",
    body: { deviceId: deviceId(), deviceName: deviceName() },
  });
  const session = toSession(payload);
  writeSession(session);
  return session;
}

export async function requestCode(
  email: string,
  turnstileToken: string,
): Promise<void> {
  await request("/api/auth/request-code", {
    method: "POST",
    body: { email, deviceId: deviceId(), turnstileToken },
  });
}

export async function verifyCode(
  email: string,
  code: string,
): Promise<AuthSession> {
  const payload = await request<TokenResponse>("/api/auth/verify", {
    method: "POST",
    body: { email, code, deviceId: deviceId(), deviceName: deviceName() },
  });
  const session = toSession(payload);
  writeSession(session);
  return session;
}

export async function refreshSession(
  session: AuthSession,
): Promise<AuthSession> {
  const payload = await request<{
    accessToken: string;
    refreshToken: string;
    accessTtlSec: number;
  }>("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken: session.refreshToken, deviceId: session.deviceId },
  });
  const next: AuthSession = {
    ...session,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    accessExpiresAt: Date.now() + payload.accessTtlSec * 1000,
  };
  writeSession(next);
  return next;
}

/** 带自动续期的请求：401 时刷新一次再重试 */
export async function authedRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  let session = readSession();
  if (!session) session = await guestLogin();
  try {
    return await request<T>(path, { ...options, token: session.accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const next = await refreshSession(session);
      return await request<T>(path, { ...options, token: next.accessToken });
    }
    throw error;
  }
}

export async function fetchMe(): Promise<AccountInfo> {
  return authedRequest<AccountInfo>("/api/me");
}

export async function fetchQuota(): Promise<Quota> {
  return authedRequest<Quota>("/api/me/quota");
}

export async function saveProfile(profile: {
  school: string;
  major: string;
  grade: string;
  direction: string;
}): Promise<void> {
  await authedRequest("/api/me/profile", { method: "POST", body: profile });
}

/* ── 课表截图识别 ──────────────────────────────────────── */

export type ParsedCourseFromImage = {
  name: string;
  weekday: number;
  start: string;
  end: string;
  place?: string;
  weeks?: number[];
};

/**
 * 课表截图 → 结构化课程。
 *
 * 和服务端聊天不同：这里要的是 JSON，不是聊天回复，
 * 所以单独走 /api/course/parse-image（服务端用视觉模型抽字段）。
 */
export async function parseCourseImage(
  imageDataUrl: string,
): Promise<ParsedCourseFromImage[]> {
  const result = await authedRequest<{
    courses: ParsedCourseFromImage[];
    usage?: number;
  }>("/api/course/parse-image", {
    method: "POST",
    body: { imageDataUrl },
  });
  return result.courses ?? [];
}

/* ── 聊天（SSE 代理）───────────────────────────────────── */

export type ServerContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ServerChatMessage = {
  role: "system" | "user" | "assistant";
  /** 纯文本用字符串；带图片时用 OpenAI 兼容的块数组 */
  content: string | ServerContentPart[];
};

export async function streamServerChat(options: {
  /** 只包含 user / assistant；system 由服务端按变量拼，客户端不再发模板 */
  messages: ServerChatMessage[];
  /** 提示词变量：本机数据（档案、记忆、课程、任务…） */
  variables?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  /** 服务端透出的元信息：经验命中、以及命中的技能名 */
  onMeta?: (meta: {
    kbCount: number;
    kbTags?: string[];
    skillName?: string;
  }) => void;
}): Promise<void> {
  let session = readSession();
  if (!session) session = await guestLogin();

  const run = async (token: string) =>
    fetch(apiBase() + "/api/ai/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        // 提示词模板在服务端，这里只带开关和变量
        ...(options.variables ? { useServerPrompt: true } : {}),
        ...(options.variables ? { variables: options.variables } : {}),
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      }),
      signal: options.signal,
    });

  let response = await run(session.accessToken);
  if (response.status === 401) {
    const next = await refreshSession(session);
    response = await run(next.accessToken);
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    let code = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string; reason?: string };
      code = parsed.reason
        ? `${parsed.error}:${parsed.reason}`
        : (parsed.error ?? code);
    } catch {
      // 保持默认
    }
    throw new ApiError(response.status, code);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // 服务端拼提示词时会把命中的技能名放在响应头里，客户端不需要内置清单
  const skillHeader = response.headers.get("x-waymuse-skill-name");
  if (skillHeader && options.onMeta) {
    let skillName: string | undefined;
    try {
      skillName = decodeURIComponent(skillHeader).trim();
    } catch {
      skillName = skillHeader.trim();
    }
    if (skillName) options.onMeta({ kbCount: 0, skillName });
  }

  // 命中条数通过响应头传过来（流开始前就能读到）
  const kbHeader = response.headers.get("x-waymuse-kb");
  if (kbHeader !== null && options.onMeta) {
    const count = Number(kbHeader);
    let kbTags: string[] | undefined;
    const tagsHeader = response.headers.get("x-waymuse-kb-tags");
    if (tagsHeader) {
      try {
        const parsed: unknown = JSON.parse(decodeURIComponent(tagsHeader));
        if (Array.isArray(parsed)) {
          kbTags = parsed.filter(
            (item): item is string => typeof item === "string",
          );
        }
      } catch {
        // 头里的 JSON 坏了就当作没有
      }
    }
    if (Number.isFinite(count)) options.onMeta({ kbCount: count, kbTags });
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";

    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) options.onDelta(delta);
      } catch {
        // 分块不完整，跳过
      }
    }
  }
}
