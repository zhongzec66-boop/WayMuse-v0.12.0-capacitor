import { BRAND } from "./brand";

/**
 * 备份与恢复。
 *
 * 测试阶段用户要反复覆盖安装，所以这份逻辑的目标是：
 * **任何一次导出，都能在重装后把数据原样带回来。**
 *
 * 三条原则：
 * 1. 备份是「原始键值快照」，不依赖各模块的读取逻辑（改结构也不会漏字段）
 * 2. 导入默认「合并」，同 id 取新的，绝不整份覆盖
 * 3. 写入前先全量校验，写失败用快照回滚
 */

const PREFIX = "waymuse-demo-";
/** 不在 PREFIX 下、但要一起备份的键 */
const EXTRA_KEYS = ["term-start"];
/** 默认不导出：属于凭证，丢了可以重填，泄露了很麻烦 */
// 客户端不再存模型 key；搜索 key 仍然只在本机，备份时排除
const SECRET_KEYS = ["search-key"];

export const BACKUP_SCHEMA = 3;

export type BackupFile = {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  secretsIncluded: boolean;
  /** 原始键（含前缀）→ 原始字符串 */
  entries: Record<string, string>;
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  localStorage.setItem(key, value);
}

function safeRemove(key: string): void {
  localStorage.removeItem(key);
}

/** 收集所有需要备份的键（含前缀，以及 term-start 这类无前缀键） */
function collectKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
  } catch {
    // 存储不可用时返回空
  }
  for (const extra of EXTRA_KEYS) {
    if (!keys.includes(extra) && safeGet(extra) !== null) keys.push(extra);
  }
  return keys;
}

export function createBackup(options?: {
  includeSecrets?: boolean;
}): BackupFile {
  const includeSecrets = Boolean(options?.includeSecrets);
  const entries: Record<string, string> = {};

  for (const key of collectKeys()) {
    const shortName = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
    if (!includeSecrets && SECRET_KEYS.includes(shortName)) continue;
    const value = safeGet(key);
    if (value !== null) entries[key] = value;
  }

  return {
    app: BRAND,
    schemaVersion: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    secretsIncluded: includeSecrets,
    entries,
  };
}

export type ImportResult = {
  ok: boolean;
  mode: "merge" | "replace";
  imported: number;
  message: string;
};

function parseEntries(input: unknown): Record<string, string> | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;
  const entries = record.entries;
  if (typeof entries !== "object" || entries === null) return null;

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    entries as Record<string, unknown>,
  )) {
    if (typeof value !== "string") continue;
    // 只接受本项目自己的键，避免误写别人的数据
    if (!key.startsWith(PREFIX) && !EXTRA_KEYS.includes(key)) continue;
    result[key] = value;
  }
  return result;
}

function idsOf(list: unknown[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const item of list) {
    if (typeof item === "object" && item !== null) {
      const id = (item as Record<string, unknown>).id;
      if (typeof id === "string" && id) map.set(id, item);
    }
  }
  return map;
}

/**
 * 列表按键合并：只补缺失的 id，冲突时保留本机。
 *
 * 为什么不用"取更新的"：Task/Course 没有可靠的时间戳（sanitize 时会丢），
 * 靠时间判断会误把本机数据覆盖成备份里的旧值。宁可少导入，也不能覆盖。
 */
function mergeList(currentRaw: string | null, incomingRaw: string): string {
  if (!currentRaw) return incomingRaw;
  try {
    const current = JSON.parse(currentRaw);
    const incoming = JSON.parse(incomingRaw);
    if (!Array.isArray(current) || !Array.isArray(incoming)) {
      return currentRaw;
    }
    const merged = new Map(idsOf(current));
    for (const [id, item] of idsOf(incoming)) {
      if (!merged.has(id)) merged.set(id, item);
    }
    return JSON.stringify([...merged.values()]);
  } catch {
    return currentRaw;
  }
}

const LIST_KEYS = ["tasks", "courses", "memories", "deepseek-messages"];

/** 把备份写回存储；mode=merge 时按 id 合并，replace 时直接覆盖 */
export function restoreBackup(
  input: unknown,
  mode: "merge" | "replace" = "merge",
): ImportResult {
  const entries = parseEntries(input);
  if (!entries) {
    return { ok: false, mode, imported: 0, message: "不是有效的备份文件" };
  }

  const version =
    typeof (input as Record<string, unknown>)?.schemaVersion === "number"
      ? Number((input as Record<string, unknown>).schemaVersion)
      : 0;
  if (version > BACKUP_SCHEMA) {
    return {
      ok: false,
      mode,
      imported: 0,
      message: "备份来自更新的版本，请升级 App 后再导入",
    };
  }

  // 写之前先算好每个键的最终值；同时留一份旧值用于回滚
  const plan = new Map<string, string>();
  const previous = new Map<string, string | null>();

  for (const [key, incoming] of Object.entries(entries)) {
    const current = safeGet(key);
    previous.set(key, current);

    const shortName = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
    if (mode === "replace" || current === null) {
      plan.set(key, incoming);
      continue;
    }
    if (LIST_KEYS.includes(shortName)) {
      plan.set(key, mergeList(current, incoming));
      continue;
    }
    // 其它键：现有值优先，避免覆盖用户新填的资料
    plan.set(key, current);
  }

  try {
    for (const [key, value] of plan) safeSet(key, value);
    return {
      ok: true,
      mode,
      imported: plan.size,
      message:
        mode === "merge"
          ? `已合并 ${plan.size} 项数据，重复项已去重`
          : `已覆盖 ${plan.size} 项数据`,
    };
  } catch (error) {
    // 回滚：把动过的键恢复原状
    for (const [key, value] of previous) {
      try {
        if (value === null) safeRemove(key);
        else safeSet(key, value);
      } catch {
        // 回滚也失败时只能放弃这一项
      }
    }
    return {
      ok: false,
      mode,
      imported: 0,
      message:
        error instanceof Error
          ? `导入失败，已回滚：${error.message.slice(0, 60)}`
          : "导入失败，已回滚",
    };
  }
}

/** 生成可下载的备份文件名 */
export function backupFileName(): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `waymuse-backup-${stamp}.json`;
}
