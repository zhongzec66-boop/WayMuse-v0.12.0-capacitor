import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { planTaskReminders } from "./deadlines";
import type { Task } from "./types";

/**
 * 计划到期提醒。
 *
 * 为什么要有这一层：灵动岛只在 App 活着的时候管用，App 被杀掉就什么都
 * 不会发生。所以真正的提醒是「本地通知」打底，「上岛」做增强。
 *
 * 分几档、什么时候响，全部交给 deadlines.ts 决定（纯函数、可测）；
 * 这里只负责和系统打交道，失败静默降级。
 */

/** 最多提前排多少条：iOS 单 App 有 64 条上限，留点余量 */
export const MAX_SCHEDULED = 24;

export type PlannedReminder = {
  id: number;
  title: string;
  body: string;
  at: Date;
};

export function isReminderSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/** 把字符串换成稳定的整数通知 id（同样的输入每次算同一个值） */
export function notificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 1_000_000;
  }
  return hash + 1000;
}

/**
 * 纯函数：算出应该排哪些提醒。
 *
 * 同一条任务的分级档位各占一条通知，所以 id 用「任务 id + 档位」生成，
 * 否则三个档位会互相覆盖，最后只剩一条。
 */
export function planReminders(
  tasks: Task[],
  now: Date = new Date(),
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];

  for (const task of tasks) {
    for (const reminder of planTaskReminders(task, now)) {
      planned.push({
        id: notificationId(`${reminder.taskId}#${reminder.slot}`),
        title: reminder.title,
        body: reminder.reason,
        at: reminder.at,
      });
    }
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