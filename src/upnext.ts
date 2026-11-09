import type { Task } from "./types";

/**
 * 判断「哪件事值得上岛」。
 *
 * 规则很简单：只把**有时间点、还没完成、并且在未来 90 分钟内（或已经逾期）**
 * 的那一件放到灵动岛上。不列清单、不报总数——岛上空间只够一个焦点。
 */

/** 提前多久开始提醒 */
export const UPCOMING_WINDOW_MINUTES = 90;
/** 逾期后还最多留在岛上多久，避免几周前的旧任务一直挂着 */
const OVERDUE_KEEP_MINUTES = 6 * 60;

export type UpNext = {
  task: Task;
  dueAt: Date;
};

function dueDate(task: Task): Date | null {
  if (!task.deadline) return null;
  // 没写具体钟点就按当天结束算，和「今天到期」的语义一致
  const time = task.time?.trim() || "23:59";
  const parsed = new Date(`${task.deadline}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function nextDueTask(tasks: Task[], now = new Date()): UpNext | null {
  const candidates: UpNext[] = [];
  for (const task of tasks) {
    if (task.done) continue;
    const due = dueDate(task);
    if (!due) continue;
    const deltaMinutes = (due.getTime() - now.getTime()) / 60000;
    if (deltaMinutes > UPCOMING_WINDOW_MINUTES) continue;
    if (deltaMinutes < -OVERDUE_KEEP_MINUTES) continue;
    candidates.push({ task, dueAt: due });
  }
  candidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return candidates[0] ?? null;
}

export function dueLabel(next: UpNext, now = new Date()): string {
  const minutes = Math.round((next.dueAt.getTime() - now.getTime()) / 60000);
  if (minutes < 0) return `已逾期 ${Math.abs(minutes)} 分钟`;
  if (minutes === 0) return "现在到期";
  if (minutes < 60) return `${minutes} 分钟后到期`;
  return `${Math.floor(minutes / 60)} 小时后到期`;
}
