import type { Memory } from "./types";

/**
 * 记忆巩固：海马体（pending）→ 皮层（consolidated）。
 *
 * 顺序写死，不能反过来：
 * 1. 先把数据改成已巩固并落盘
 * 2. 再播动画
 *
 * 这样动画失败、被跳过、用户直接杀进程，数据都是对的。
 * 动画只是「看见巩固发生」，不是巩固本身。
 */

export type ConsolidationPlan = {
  /** 需要改成 consolidated 的条目 */
  promote: Memory[];
  /** 这次该不该播动画 */
  shouldAnimate: boolean;
};

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 同一天用同一个数字表示，用来判断「今天播过没有」 */
function dayKey(time: number): number {
  return startOfDay(time);
}

export function planConsolidation(
  memories: Memory[],
  options: { now?: Date; lastConsolidatedAt?: number } = {},
): ConsolidationPlan {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const todayStart = startOfDay(nowMs);

  // 只巩固「昨天及更早」还没沉淀的：当天新记的先留在海马体
  const promote = memories.filter(
    (memory) =>
      memory.status === "pending" &&
      typeof memory.createdAt === "number" &&
      memory.createdAt < todayStart,
  );

  // 动画每天最多一次；但数据巩固不受此限，每次发现 pending 都要处理
  const lastAt = options.lastConsolidatedAt ?? 0;
  const shouldAnimate = promote.length > 0 && dayKey(lastAt) !== dayKey(nowMs);

  return { promote, shouldAnimate };
}

/** 执行第一步：把要巩固的条目改成 consolidated（返回新数组，不改入参） */
export function applyConsolidation(
  memories: Memory[],
  promote: Memory[],
): Memory[] {
  if (!promote.length) return memories;
  const ids = new Set(promote.map((memory) => memory.id));
  return memories.map((memory) =>
    ids.has(memory.id) ? { ...memory, status: "consolidated" } : memory,
  );
}

/** 海马体 / 皮层各自的条数，用来验证巩固前后计数是否对得上 */
export function memoryCounts(memories: Memory[]): {
  pending: number;
  consolidated: number;
} {
  let pending = 0;
  let consolidated = 0;
  for (const memory of memories) {
    if (memory.status === "pending") pending += 1;
    else consolidated += 1;
  }
  return { pending, consolidated };
}
