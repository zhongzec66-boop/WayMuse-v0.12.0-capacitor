import { describe, expect, it } from "vitest";
import { notificationId, planReminders } from "./reminders";
import { taskDueAt } from "./taskTime";
import { nextDueTask } from "./upnext";
import type { Task } from "./types";

function task(overrides: Partial<Task> & { id: string }): Task {
  return { text: "任务", done: false, ...overrides };
}

/** 固定「现在」，避免测试依赖真实时钟 */
const NOW = new Date("2026-11-09T20:00:00");

describe("taskDueAt（岛上和通知共用）", () => {
  it("截止日期 + 钟点", () => {
    const value = taskDueAt(
      task({ id: "a", deadline: "2026-11-09", time: "21:30" }),
    );
    expect(value?.getHours()).toBe(21);
    expect(value?.getMinutes()).toBe(30);
  });

  it("没写钟点按 20:00", () => {
    const value = taskDueAt(task({ id: "a", deadline: "2026-11-09" }));
    expect(value?.getHours()).toBe(20);
  });

  it("没有截止日期返回 null", () => {
    expect(taskDueAt(task({ id: "a" }))).toBeNull();
  });
});

describe("两条通道的一致性", () => {
  it("没写钟点时，岛上和通知算的是同一个时刻", () => {
    const one = task({ id: "a", deadline: "2026-11-09" });
    // 通知：提前 10 分钟 -> 19:50
    const planned = planReminders([one], new Date("2026-11-09T08:00:00"));
    expect(planned[0].at.getHours()).toBe(19);
    expect(planned[0].at.getMinutes()).toBe(50);
    // 上岛：同一个到期时刻 20:00
    expect(taskDueAt(one)?.getHours()).toBe(20);
  });
});

describe("notificationId", () => {
  it("同一个任务 id 每次得到同一个通知 id", () => {
    expect(notificationId("task-1")).toBe(notificationId("task-1"));
  });

  it("不同任务得到不同 id", () => {
    expect(notificationId("task-1")).not.toBe(notificationId("task-2"));
  });
});

describe("planReminders", () => {
  it("只排未完成、且未来到期的任务", () => {
    const planned = planReminders(
      [
        task({
          id: "a",
          text: "写作业",
          deadline: "2026-11-09",
          time: "22:00",
        }),
        task({
          id: "b",
          text: "已完成",
          done: true,
          deadline: "2026-11-09",
          time: "22:00",
        }),
        task({ id: "c", text: "没日期" }),
        task({
          id: "d",
          text: "已过期",
          deadline: "2026-11-01",
          time: "10:00",
        }),
      ],
      NOW,
    );
    expect(planned).toHaveLength(1);
    expect(planned[0].title).toBe("写作业");
  });

  it("提前 10 分钟提醒", () => {
    const planned = planReminders(
      [task({ id: "a", deadline: "2026-11-09", time: "21:00" })],
      NOW,
    );
    expect(planned[0].at.getHours()).toBe(20);
    expect(planned[0].at.getMinutes()).toBe(50);
  });

  it("提前量已经过了就改在到期时刻提醒", () => {
    const planned = planReminders(
      [task({ id: "a", deadline: "2026-11-09", time: "20:05" })],
      NOW,
    );
    expect(planned[0].at.getMinutes()).toBe(5);
  });

  it("按到期时间升序排列", () => {
    const planned = planReminders(
      [
        task({ id: "late", deadline: "2026-11-09", time: "23:00" }),
        task({ id: "soon", deadline: "2026-11-09", time: "21:00" }),
      ],
      NOW,
    );
    expect(planned[0].title).toBe("任务");
    expect(planned[0].at.getTime()).toBeLessThan(planned[1].at.getTime());
  });

  it("最多排 24 条", () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      task({
        id: `t${index}`,
        deadline: "2026-11-10",
        time: `${String(8 + (index % 12)).padStart(2, "0")}:00`,
      }),
    );
    expect(planReminders(many, NOW).length).toBeLessThanOrEqual(24);
  });
});

describe("nextDueTask（上岛用）", () => {
  it("选最近的一件", () => {
    const next = nextDueTask(
      [
        task({ id: "a", text: "晚点", deadline: "2026-11-09", time: "21:20" }),
        task({ id: "b", text: "马上", deadline: "2026-11-09", time: "20:30" }),
      ],
      NOW,
    );
    expect(next?.task.text).toBe("马上");
  });

  it("超过 90 分钟的不上岛", () => {
    const next = nextDueTask(
      [task({ id: "a", deadline: "2026-11-09", time: "23:00" })],
      NOW,
    );
    expect(next).toBeNull();
  });

  it("逾期的仍然上岛提醒", () => {
    const next = nextDueTask(
      [task({ id: "a", text: "逾期", deadline: "2026-11-09", time: "19:00" })],
      NOW,
    );
    expect(next?.task.text).toBe("逾期");
  });

  it("完成的不上岛", () => {
    const next = nextDueTask(
      [
        task({
          id: "a",
          done: true,
          deadline: "2026-11-09",
          time: "20:30",
        }),
      ],
      NOW,
    );
    expect(next).toBeNull();
  });
});
