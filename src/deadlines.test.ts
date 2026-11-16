import { describe, expect, it } from "vitest";
import {
  DEADLINE_TIERS_HOURS,
  NEAR_LEAD_MINUTES,
  planDeadline,
  planTaskReminders,
} from "./deadlines";
import type { Task } from "./types";

const NOW = new Date("2026-11-11T20:00:00+08:00");
const HOUR = 3_600_000;

function due(hoursFromNow: number): Date {
  return new Date(NOW.getTime() + hoursFromNow * HOUR);
}

function task(partial: Partial<Task> & { id: string }): Task {
  return { text: "写作业", done: false, ...partial } as Task;
}

describe("planDeadline 分级", () => {
  it("离到期 72 小时：三档全排（48/12/2）", () => {
    const plans = planDeadline(due(72), NOW);
    expect(plans.map((p) => p.hoursBefore)).toEqual([...DEADLINE_TIERS_HOURS]);
  });

  it("三档的时间点确实落在到期前 48/12/2 小时", () => {
    const d = due(72);
    const plans = planDeadline(d, NOW);
    for (const plan of plans) {
      const gapHours = (d.getTime() - plan.at.getTime()) / HOUR;
      expect(gapHours).toBe(plan.hoursBefore);
    }
  });

  it("只剩 20 小时：已经过去的 48 小时档不再补发", () => {
    const plans = planDeadline(due(20), NOW);
    expect(plans.map((p) => p.hoursBefore)).toEqual([12, 2]);
  });

  it("只剩 5 小时：只排 2 小时档", () => {
    const plans = planDeadline(due(5), NOW);
    expect(plans.map((p) => p.hoursBefore)).toEqual([2]);
  });

  it("两小时内：改用提前 10 分钟兜底", () => {
    const plans = planDeadline(due(1), NOW);
    expect(plans).toHaveLength(1);
    expect(plans[0].hoursBefore).toBeUndefined();
    expect(plans[0].reason).toContain(String(NEAR_LEAD_MINUTES));
  });

  it("只剩 5 分钟：按到期时刻发", () => {
    const d = due(5 / 60);
    const plans = planDeadline(d, NOW);
    expect(plans).toHaveLength(1);
    expect(plans[0].at.getTime()).toBe(d.getTime());
  });

  it("刚过期 10 秒：立刻补发一条", () => {
    const d = new Date(NOW.getTime() - 10_000);
    const plans = planDeadline(d, NOW);
    expect(plans).toHaveLength(1);
    expect(plans[0].at.getTime()).toBe(NOW.getTime() + 1000);
  });

  it("逾期超过一分钟：不再补发", () => {
    expect(planDeadline(new Date(NOW.getTime() - 5 * 60_000), NOW)).toEqual([]);
  });

  it("每条都带一句「为什么提醒你」", () => {
    for (const plan of planDeadline(due(72), NOW)) {
      expect(plan.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("planTaskReminders", () => {
  it("已完成的任务不排", () => {
    expect(
      planTaskReminders(
        task({ id: "a", dueAt: due(72).toISOString(), done: true }),
        NOW,
      ),
    ).toEqual([]);
  });

  it("没有截止时间的不排", () => {
    expect(planTaskReminders(task({ id: "a" }), NOW)).toEqual([]);
  });

  it("三档的 slot 各不相同，便于各自独立排通知", () => {
    const reminders = planTaskReminders(
      task({ id: "a", dueAt: due(72).toISOString() }),
      NOW,
    );
    const slots = reminders.map((r) => r.slot);
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots).toEqual(["48h", "12h", "2h"]);
  });

  it("标题取任务正文并截断", () => {
    const long = "写".repeat(200);
    const reminders = planTaskReminders(
      task({ id: "a", text: long, dueAt: due(72).toISOString() }),
      NOW,
    );
    expect(reminders[0].title.length).toBe(60);
  });
});
