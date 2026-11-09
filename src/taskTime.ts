import type { Task } from "./types";

/**
 * 任务的到期时刻——只在这里算一次。
 *
 * 为什么单独抽出来：灵动岛和本地通知是两条通道，但如果各自算一遍，
 * 同一条任务就会有两个不同的「到期时间」，互相打脸
 * （岛上倒数到 23:59，通知却在 20:00 响）。
 *
 * 所以约定：没写具体钟点就按 DEFAULT_DUE_TIME 算，两边共用。
 */

/** 只写了日期没写钟点时，按这个时间当到期 */
export const DEFAULT_DUE_TIME = "20:00";

export function taskDueAt(task: Task): Date | null {
  // 有精确时刻就用它：「30 秒后提醒我」这种需求用日期表达不了
  if (task.dueAt) {
    const exact = new Date(task.dueAt);
    if (!Number.isNaN(exact.getTime())) return exact;
  }
  if (!task.deadline) return null;
  const time = task.time?.trim() || DEFAULT_DUE_TIME;
  const parsed = new Date(`${task.deadline}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
