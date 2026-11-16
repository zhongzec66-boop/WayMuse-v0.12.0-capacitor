import type { Task } from "./types";

/**
 * 「今日三件」的选取规则（纯函数，无副作用）。
 *
 * 从 BriefCard 里抽出来，目的有两个：
 * 1. 规则可被复用（今天只给展示用，以后接「开始/完成/回写」时不用再抄一遍）
 * 2. 可单独测边界（空列表、全做完、逾期并列、没有截止日期…）
 *
 * 现在的排序规则（与抽取前完全一致）：
 *   - 只看未完成
 *   - 逾期（deadline < 今天）排最前，按 deadline 升序
 *   - 其次是有截止日期的（deadline >= 今天），按 deadline 升序
 *   - 最后是没有截止日期的，保持原来数组里的顺序
 *
 * `display` 是给当前 UI 用的顺序：第一件是 top，其余保持原数组顺序，
 * 这样抽取前后界面显示一模一样。
 */

export type TaskLike = Pick<
  Task,
  "id" | "text" | "done" | "deadline" | "priority" | "completedAt"
>;

export type TopTasks = {
  /** 当前 UI 认定的「最该做的那件」；没有未完成任务时为 undefined */
  top: TaskLike | undefined;
  /** 排名后的候选（逾期 → 有截止 → 无截止），供后续闭环设计使用 */
  ranked: TaskLike[];
  /** 给当前 UI 用的展示顺序：top 在前，其余保持原数组顺序 */
  display: TaskLike[];
  /** 未完成任务总数 */
  openCount: number;
  overdueCount: number;
  scheduledCount: number;
  unscheduledCount: number;
};

function byDeadline(a: TaskLike, b: TaskLike): number {
  return (a.deadline ?? "").localeCompare(b.deadline ?? "");
}

export function selectTopTasks(
  tasks: readonly TaskLike[],
  todayKey: string,
): TopTasks {
  const open = tasks.filter((task) => !task.done);

  const overdue = open
    .filter((task) => task.deadline && task.deadline < todayKey)
    .sort(byDeadline);

  const scheduled = open
    .filter((task) => task.deadline && task.deadline >= todayKey)
    .sort(byDeadline);

  const unscheduled = open.filter((task) => !task.deadline);

  const ranked = [...overdue, ...scheduled, ...unscheduled];
  const top = ranked[0];
  const display = top
    ? [top, ...open.filter((task) => task.id !== top.id)]
    : [];

  return {
    top,
    ranked,
    display,
    openCount: open.length,
    overdueCount: overdue.length,
    scheduledCount: scheduled.length,
    unscheduledCount: unscheduled.length,
  };
}

/** 「还剩 N 个任务」里的 N：不含最优先那一件 */
export function remainingAfter(topCount: number): number {
  return Math.max(0, topCount - 1);
}
