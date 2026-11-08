import { BRAND } from "./brand";
import { normalizeConfig } from "./deepseek/config";
import type { DeepSeekConfig, DeepSeekMessage } from "./deepseek/types";
import { normalizeProfile } from "./profile";
import type { UserProfile } from "./profile";
import type { Course, Memory, MemoryWeight, Task } from "./types";
import { newId } from "./id";

const PREFIX = "waymuse-demo-";
const SCHEMA_VERSION = 2;
const DEEPSEEK_KEY_NAME = "deepseek-key";
const DEEPSEEK_REMEMBER_NAME = "deepseek-remember";

function readText(name: string, fallback: string): string {
  try {
    return localStorage.getItem(PREFIX + name) || fallback;
  } catch {
    return fallback;
  }
}

function writeText(name: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + name, value);
  } catch {
    // The page remains usable when browser storage is unavailable.
  }
}

function readJson(name: string): unknown {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(name: string, value: unknown): void {
  writeText(name, JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function sanitizeTask(value: unknown): Task | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { id: newId(), text, done: false } : null;
  }
  if (!isRecord(value) || typeof value.text !== "string") return null;
  const text = value.text.trim();
  if (!text) return null;
  const priority =
    value.priority === "high" ||
    value.priority === "medium" ||
    value.priority === "low"
      ? value.priority
      : undefined;
  const deadline =
    typeof value.deadline === "string" && value.deadline.trim()
      ? value.deadline.trim()
      : undefined;
  const category =
    typeof value.category === "string" && value.category.trim()
      ? value.category.trim()
      : undefined;
  const time = isTime(value.time) ? value.time : undefined;
  return {
    id: typeof value.id === "string" && value.id ? value.id : newId(),
    text,
    done: value.done === true,
    priority,
    deadline,
    time,
    category,
  };
}

function sanitizeCourse(value: unknown): Course | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;
  const weekday =
    typeof value.weekday === "number" &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6
      ? value.weekday
      : 1;
  const start = isTime(value.start) ? value.start : "08:00";
  const end = isTime(value.end) ? value.end : "09:40";
  return {
    id: typeof value.id === "string" && value.id ? value.id : newId(),
    name,
    weekday,
    start,
    end,
    place: typeof value.place === "string" ? value.place : "",
  };
}

function readList<T>(
  name: string,
  sanitize: (value: unknown) => T | null,
  fallback: T[],
): T[] {
  const value = readJson(name);
  if (!Array.isArray(value)) return fallback;
  return value.reduce<T[]>((items, entry) => {
    const item = sanitize(entry);
    if (item) items.push(item);
    return items;
  }, []);
}

function readCourses(): Course[] {
  return readList("courses", sanitizeCourse, []);
}

/**
 * 记忆存储。
 *
 * 老版本是 `string[]`，新版本带分量与创建时间。迁移策略：
 * 老字符串转成 `{ weight: 2, createdAt: 递增的固定基准时间 }`，
 * 这样顺序不变、也不会凭空变成「重要」。
 */
const LEGACY_MEMORY_BASE = Date.UTC(2024, 0, 1);

function sanitizeMemory(value: unknown, index: number): Memory | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text
      ? {
          id: newId(),
          text: text.slice(0, 120),
          weight: 2,
          createdAt: LEGACY_MEMORY_BASE + index,
        }
      : null;
  }
  if (!isRecord(value) || typeof value.text !== "string") return null;
  const text = value.text.trim();
  if (!text) return null;
  const weight: MemoryWeight =
    value.weight === 1 || value.weight === 3 ? value.weight : 2;
  return {
    id: typeof value.id === "string" && value.id ? value.id : newId(),
    text: text.slice(0, 120),
    weight,
    createdAt:
      typeof value.createdAt === "number" ? value.createdAt : Date.now(),
  };
}

function readMemoryList(name: string): Memory[] {
  const value = readJson(name);
  if (!Array.isArray(value)) return [];
  return value.reduce<Memory[]>((items, entry) => {
    const item = sanitizeMemory(entry, items.length);
    if (item) items.push(item);
    return items;
  }, []);
}

function readMemories(): Memory[] {
  const current = readMemoryList("memories");
  if (current.length) return current;

  // 旧 PersonalShell 把结构化记忆存在 memory-entries，一次性搬过来。
  const legacy = readMemoryList("memory-entries");
  if (legacy.length) {
    writeJson("memories", legacy);
    try {
      localStorage.removeItem(PREFIX + "memory-entries");
    } catch {
      // 已经写入新键，删旧键失败也不影响使用。
    }
    return legacy;
  }

  return current;
}

export function createMemory(text: string, weight: MemoryWeight = 2): Memory {
  return {
    id: newId(),
    text: text.trim().slice(0, 120),
    weight,
    createdAt: Date.now(),
  };
}

function readTasks(fallback: Task[]): Task[] {
  return readList("tasks", sanitizeTask, fallback);
}

function readSessionText(name: string): string {
  try {
    return sessionStorage.getItem(PREFIX + name) || "";
  } catch {
    return "";
  }
}

function writeKey(key: string, remember: boolean): void {
  try {
    localStorage.removeItem(PREFIX + DEEPSEEK_KEY_NAME);
    sessionStorage.removeItem(PREFIX + DEEPSEEK_KEY_NAME);
    if (!key) {
      localStorage.removeItem(PREFIX + DEEPSEEK_REMEMBER_NAME);
      return;
    }
    const target = remember ? localStorage : sessionStorage;
    target.setItem(PREFIX + DEEPSEEK_KEY_NAME, key);
    if (remember) localStorage.setItem(PREFIX + DEEPSEEK_REMEMBER_NAME, "1");
    else localStorage.removeItem(PREFIX + DEEPSEEK_REMEMBER_NAME);
  } catch {
    // Keep the key in component state if storage is blocked.
  }
}

function sanitizeDeepSeekUsage(value: unknown) {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.prompt_tokens !== "number" ||
    typeof value.completion_tokens !== "number" ||
    typeof value.total_tokens !== "number"
  ) {
    return undefined;
  }
  return {
    prompt_tokens: value.prompt_tokens,
    completion_tokens: value.completion_tokens,
    total_tokens: value.total_tokens,
  };
}

function sanitizeDeepSeekMessage(value: unknown): DeepSeekMessage | null {
  if (!isRecord(value)) return null;
  if (value.role !== "user" && value.role !== "assistant") return null;
  if (typeof value.content !== "string") return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : newId(),
    role: value.role,
    content: value.content,
    reasoning:
      typeof value.reasoning === "string" ? value.reasoning : undefined,
    createdAt:
      typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    model: typeof value.model === "string" ? value.model : undefined,
    usage: sanitizeDeepSeekUsage(value.usage),
    latencyMs:
      typeof value.latencyMs === "number" ? value.latencyMs : undefined,
    finishReason:
      typeof value.finishReason === "string" ? value.finishReason : undefined,
    stopped: value.stopped === true,
    error: value.error === true,
  };
}

function readDeepSeekMessages(): DeepSeekMessage[] {
  const value = readJson("deepseek-messages");
  if (!Array.isArray(value)) return [];
  const messages = value
    .map(sanitizeDeepSeekMessage)
    .filter((message): message is DeepSeekMessage => message !== null);
  return messages
    .filter(
      (message) =>
        message.role === "user" ||
        message.content.trim() !== "" ||
        Boolean(message.reasoning?.trim()),
    )
    .slice(-120);
}

export const storage = {
  getEntered: () => readText("entered", "") === "1",
  setEntered: (entered: boolean) => {
    try {
      if (entered) localStorage.setItem(PREFIX + "entered", "1");
      else localStorage.removeItem(PREFIX + "entered");
    } catch {
      // Continue in memory if storage is blocked.
    }
  },
  getName: () => readText("name", "同学"),
  setName: (name: string) => writeText("name", name),
  getAgentName: () => readText("agent", BRAND),
  setAgentName: (name: string) => writeText("agent", name),
  getAgentAvatar: () => readText("agent-avatar", ""),
  setAgentAvatar: (avatar: string) => writeText("agent-avatar", avatar),
  getCourses: readCourses,
  setCourses: (courses: Course[]) => writeJson("courses", courses),
  getMemories: readMemories,
  setMemories: (memories: Memory[]) => writeJson("memories", memories),
  getTasks: readTasks,
  setTasks: (tasks: Task[]) => writeJson("tasks", tasks),
  getProfile: (): UserProfile => {
    const profile = normalizeProfile(readJson("profile"));
    if (!profile.callName) {
      const legacy = readText("name", "");
      if (legacy && legacy !== "同学") profile.callName = legacy;
    }
    return profile;
  },
  setProfile: (profile: UserProfile) => {
    writeJson("profile", profile);
    writeText("name", profile.callName);
  },
  getDeepSeekConfig: (): DeepSeekConfig =>
    normalizeConfig(readJson("deepseek-config")),
  setDeepSeekConfig: (config: DeepSeekConfig) =>
    writeJson("deepseek-config", config),
  getDeepSeekKey: () =>
    readSessionText(DEEPSEEK_KEY_NAME) || readText(DEEPSEEK_KEY_NAME, ""),
  getDeepSeekRemember: () => readText(DEEPSEEK_REMEMBER_NAME, "") === "1",
  setDeepSeekKey: writeKey,
  /* ── 联网搜索（用户自带 key）── */
  getSearchProvider: () => readText("search-provider", "serper"),
  setSearchProvider: (provider: string) =>
    writeText("search-provider", provider.trim() || "serper"),
  getSearchKey: () => readText("search-key", ""),
  setSearchKey: (key: string) => writeText("search-key", key.trim()),
  getSearchEnabled: () => readText("search-enabled", "1") !== "0",
  setSearchEnabled: (on: boolean) => writeText("search-enabled", on ? "1" : ""),

  /* ── 语音（Breeze TTS）── 只存本机，和 DeepSeek key 一样不设默认值 */
  /* ── 三份可编辑的人格/记忆文件 ── */
  getDoc: (id: string) => readText(`doc-${id}`, ""),
  setDoc: (id: string, text: string) => writeText(`doc-${id}`, text),

  getBreezeKey: () => readText("breeze-key", ""),
  setBreezeKey: (key: string) => writeText("breeze-key", key.trim()),
  getBreezeVoice: () =>
    readText("breeze-voice", "voc_xeh3w54cqvnp") || "voc_xeh3w54cqvnp",
  setBreezeVoice: (voice: string) =>
    writeText("breeze-voice", voice.trim() || "voc_xeh3w54cqvnp"),
  getDeepSeekMessages: readDeepSeekMessages,
  setDeepSeekMessages: (messages: DeepSeekMessage[]) =>
    writeJson("deepseek-messages", messages.slice(-120)),
  clearDeepSeekData: (): void => {
    try {
      localStorage.removeItem(PREFIX + "deepseek-config");
      localStorage.removeItem(PREFIX + "deepseek-messages");
      writeKey("", false);
    } catch {
      // Nothing else to clear when storage is unavailable.
    }
  },
  clearAll: (): void => {
    const clearStore = (store: Storage) => {
      try {
        const keys: string[] = [];
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index);
          if (key?.startsWith(PREFIX)) keys.push(key);
        }
        keys.forEach((key) => store.removeItem(key));
      } catch {
        // Nothing else to clear when storage is unavailable.
      }
    };
    try {
      clearStore(localStorage);
    } catch {
      // Storage can be blocked entirely.
    }
    try {
      clearStore(sessionStorage);
    } catch {
      // Storage can be blocked entirely.
    }
  },
  exportData: () => ({
    app: BRAND,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      name: readText("name", "同学"),
      agentName: readText("agent", BRAND),
      entered: readText("entered", "") === "1",
    },
    userProfile: normalizeProfile(readJson("profile")),
    courses: readCourses(),
    memories: readMemories(),
    tasks: readTasks([]),
  }),
};
