import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { taskDueAt } from "./taskTime";
import type { Task } from "./types";

/**
 * 计划到期提醒。
 *
 * 为什么要有这一层：灵动岛只在 App 活着的时候管用，App 被杀掉就什么都
 * 不会发生。所以真正的提醒是「本地通知」打底，「上岛」做增强。
 *
 * 结构上刻意把「算」和「发」分开：
 * - planReminders() 是纯函数，给定任务和时间就返回要排的通知，好测；
 * - syncTaskReminders() 负责和系统打交道，失败了静默降级。
 */

/** 最多提前排多少条：iOS 单 App 有 64 条上限，留点余量 */
export const MAX_SCHEDULED = 24;
/** 提前多久提醒 */
export const LEAD_MINUTES = 10;

export type PlannedReminder = {
  id: number;
  title: string;
  body: string;
  at: Date;
};

export function isReminderSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/** 把任务 id 换成稳定的整数通知 id（同一个任务每次都算同一个值） */
export function notificationId(taskId: string): number {
  let hash = 0;
  for (let i = 0; i < taskId.length; i += 1) {
    hash = (hash * 31 + taskId.charCodeAt(i)) % 1_000_000;
  }
  return hash + 1000;
}

/**
 * 纯函数：算出应该排哪些提醒。
 *
 * 规则：
 * - 跳过已完成的、没有截止日期的、以及已经过期的（过期的叫不醒人，
 *   逾期由灵动岛那条负责显摆）
 * - 按到期时间升序，最多 MAX_SCHEDULED 条
 * - 通知时间取「到期前 LEAD_MINUTES 分钟」，如果那个点已经过了就取到期时刻
 */
export function planReminders(
  tasks: Task[],
  now: Date = new Date(),
): PlannedReminder[] {
  const nowMs = now.getTime();
  const planned: PlannedReminder[] = [];

  for (const task of tasks) {
    if (task.done) continue;
    const due = taskDueAt(task);
    if (!due) continue;

    const dueMs = due.getTime();
    // 逾期超过一分钟的就不再补通知了（上岛那条负责显示逾期）
    if (dueMs <= nowMs - 60_000) continue;

    const leadMs = dueMs - LEAD_MINUTES * 60_000;
    // 提前量已经过了（比如「5 秒后提醒我」），就按到期时刻发；
    // 要是连到期时刻都过了，就立刻发一条，别静默丢掉。
    const atMs = leadMs > nowMs ? leadMs : Math.max(dueMs, nowMs + 1000);
    planned.push({
      id: notificationId(task.id),
      title: task.text.slice(0, 60),
      body: atMs - nowMs <= 60_000 ? "现在提醒" : `${LEAD_MINUTES} 分钟后到期`,
      at: new Date(atMs),
    });
  }

  planned.sort((a, b) => a.at.getTime() - b.at.getTime());
  return planned.slice(0, MAX_SCHEDULED);
}

/** 和系统打交道：先全撤再按最新计划重排 */
export async function syncTaskReminders(tasks: Task[]): Promise<void> {
  if (!isReminderSupported()) return;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((item) => ({ id: item.id })),
      });
    }

    const planned = planReminders(tasks);
    // 没有要提醒的就不申请权限：一进 App 就弹系统框很打扰
    if (planned.length === 0) return;

    const granted = await ensureReminderPermission();
    if (!granted) return;

    await LocalNotifications.schedule({
      notifications: planned.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        schedule: { at: item.at, allowWhileIdle: true },
      })),
    });
  } catch {
    // 通知不是主流程，失败也不该让聊天崩掉
  }
}

export async function ensureReminderPermission(): Promise<boolean> {
  if (!isReminderSupported()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === "granted";
  } catch {
    return false;
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!isReminderSupported()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (!pending.notifications.length) return;
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((item) => ({ id: item.id })),
    });
  } catch {
    // 忽略
  }
}
