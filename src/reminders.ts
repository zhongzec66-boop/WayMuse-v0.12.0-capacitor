import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Task } from "./types";

/**
 * 计划到期提醒。
 *
 * 为什么要有这一层：灵动岛只在 App 活着的时候管用，App 被杀掉就什么都
 * 不会发生。所以真正的提醒是「本地通知」打底，「上岛」做增强：
 *
 *   本地通知 —— App 完全不运行也会响（系统级调度）
 *   灵动岛   —— App 在后台/前台时，抬眼就能看见还剩多久
 *
 * 这里只负责通知这一半。两条通道都指向同一份任务数据，不会打架。
 */

/** 最多提前排多少条：iOS 单 App 有 64 条上限，留点余量 */
const MAX_SCHEDULED = 24;
/** 提前多久提醒 */
const LEAD_MINUTES = 10;

export function isReminderSupported(): boolean {
  return Capacitor.isNativePlatform();
}

function dueDate(task: Task): Date | null {
  if (!task.deadline) return null;
  const time = task.time?.trim() || "20:00";
  const parsed = new Date(`${task.deadline}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 把任务 id 换成稳定的整数通知 id（同一个任务每次都算同一个值） */
function notificationId(taskId: string): number {
  let hash = 0;
  for (let i = 0; i < taskId.length; i += 1) {
    hash = (hash * 31 + taskId.charCodeAt(i)) % 1_000_000;
  }
  return hash + 1000;
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

/**
 * 按当前任务重新安排所有提醒。
 * 每次任务变化都整体重排：先全撤再排，避免残留旧通知。
 */
export async function syncTaskReminders(tasks: Task[]): Promise<void> {
  if (!isReminderSupported()) return;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((item) => ({ id: item.id })),
      });
    }

    const now = Date.now();
    const upcoming = tasks
      .filter((task) => !task.done)
      .map((task) => ({ task, due: dueDate(task) }))
      .filter((item): item is { task: Task; due: Date } => item.due !== null)
      .filter((item) => item.due.getTime() > now)
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, MAX_SCHEDULED);

    if (upcoming.length === 0) return;

    // 只有确实有要提醒的任务时才申请权限：没任务时弹系统框很打扰
    const granted = await ensureReminderPermission();
    if (!granted) return;

    await LocalNotifications.schedule({
      notifications: upcoming.map(({ task, due }) => {
        const at = new Date(due.getTime() - LEAD_MINUTES * 60_000);
        return {
          id: notificationId(task.id),
          title: task.text.slice(0, 60),
          body: `${LEAD_MINUTES} 分钟后到期`,
          schedule: {
            at: at.getTime() > now ? at : due,
            allowWhileIdle: true,
          },
        };
      }),
    });
  } catch {
    // 通知不是主流程，失败也不该让聊天崩掉
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
