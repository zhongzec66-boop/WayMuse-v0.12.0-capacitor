import type { Task } from "./types";
import { taskDueAt } from "./taskTime";

/**
 * 截止分级提醒。
 *
 * 为什么分级：只在「提前 10 分钟」提醒一次，学生要么没空、要么已经放弃了。
 * 48 / 12 / 2 小时三档的意义是——48 小时是「还来得及好好做」，
 * 12 小时是「今天必须动」，2 小时是「再不动就砸了」。
 *
 * 全部是纯函数，好测；排不排得下由调用方决定。
 */

/** 分级档位：距到期还有几小时提醒 */
export const DEADLINE_TIERS_HOURS = [48, 12, 2] as const;

/** 两小时内、但还够不上一档的，用这个提前量兜底 */
export const NEAR_LEAD_MINUTES = 10;

export type DeadlinePlan = {
  /** 距到期还有多少小时（分级档位）；兜底那条为 undefined */
  hoursBefore?: number;
  at: Date;
  /** 为什么提醒你——学生最烦没理由的唠叨 */
  reason: string;
};

function hoursLabel(hours: number): string {
  return hours >= 24 ? `${Math.round(hours / 24)} 天` : `${hours} 小时`;
}

/**
 * 算出这一条任务该在哪些时刻提醒。
 *
 * 只返回**还没发生**的档位；已经过去的档位不再补发——补发等于一次性
 * 弹三条，那是最招人烦的做法。
 */
export function planDeadline(
  due: Date,
  now: Date = new Date(),
): DeadlinePlan[] {
  const dueMs = due.getTime();
  const nowMs = now.getTime();
  const plans: DeadlinePlan[] = [];

  for (const hours of DEADLINE_TIERS_HOURS) {
    const at = dueMs - hours * 3_600_000;
    if (at <= nowMs) continue;
    plans.push({
      hoursBefore: hours,
      at: new Date(at),
      reason: `还有 ${hoursLabel(hours)}到期`,
    });
  }

  if (plans.length) return plans;

  // 已经进不到任何一档：两小时内用「提前 10 分钟」兜底
  const nearLead = dueMs - NEAR_LEAD_MINUTES * 60_000;
  if (nearLead > nowMs) {
    return [
      {
        at: new Date(nearLead),
        reason: `${NEAR_LEAD_MINUTES} 分钟后到期`,
      },
    ];
  }

  // 连兜底点都过了：到期时刻还在就按到期发；刚过期一分钟内立刻发一条
  if (dueMs > nowMs) {
    return [{ at: due, reason: "现在到期" }];
  }
  if (dueMs > nowMs - 60_000) {
    return [{ at: new Date(nowMs + 1_000), reason: "已经到期" }];
  }

  // 逾期超过一分钟：不再补通知，逾期由上岛那一条负责显示
  return [];
}

/** 一条任务的所有提醒（每条带唯一 id，避免互相覆盖） */
export type TaskReminder = DeadlinePlan & {
  taskId: string;
  slot: string;
  title: string;
};

export function planTaskReminders(
  task: Task,
  now: Date = new Date(),
): TaskReminder[] {
  if (task.done) return [];
  const due = taskDueAt(task);
  if (!due) return [];

  return planDeadline(due, now).map((plan) => ({
    ...plan,
    taskId: task.id,
    // 同一条任务的三个档位要能各自独立存在
    slot: plan.hoursBefore ? `${plan.hoursBefore}h` : "near",
    title: task.text.slice(0, 60),
  }));
}
