import { describe, expect, it } from "vitest";
import type { Course } from "./types";
import {
  CLASS_REMIND_MINUTES,
  EXAM_PREP_DAYS,
  classReminderText,
  courseOnDay,
  fitsInRemainingTime,
  hoursUntilDue,
  inExamPrepWindow,
  nextClass,
  planClassReminders,
  shouldRemindClass,
} from "./semester";
import type { Assignment, Exam } from "./semester";

// 2026-11-11 是周三
const NOW = new Date("2026-11-11T09:00:00+08:00");

function course(partial: Partial<Course> & { id: string }): Course {
  return {
    name: "高等数学",
    weekday: 3,
    start: "10:00",
    end: "11:40",
    place: "教三-201",
    ...partial,
  } as Course;
}

describe("courseOnDay", () => {
  it("周三的课在周三出现", () => {
    expect(courseOnDay(course({ id: "a" }), NOW)).toBe(true);
  });

  it("周四不出现", () => {
    const thursday = new Date("2026-11-12T09:00:00+08:00");
    expect(courseOnDay(course({ id: "a" }), thursday)).toBe(false);
  });

  it("单双周：不在这一周就不出现", () => {
    const odd = course({ id: "a", weeks: [1, 3, 5, 7] });
    expect(courseOnDay(odd, NOW, 2)).toBe(false);
    expect(courseOnDay(odd, NOW, 3)).toBe(true);
  });

  it("没写周次 = 每周都上（兼容旧数据）", () => {
    expect(courseOnDay(course({ id: "a" }), NOW, 99)).toBe(true);
  });
});

describe("nextClass", () => {
  it("今天还没到的课就是下一节", () => {
    const next = nextClass([course({ id: "a" })], NOW);
    expect(next?.course.name).toBe("高等数学");
    expect(next?.startsAt.getHours()).toBe(10);
    expect(next?.minutesUntil).toBe(60);
  });

  it("已经开始的课跳过，找下一门", () => {
    const morning = course({ id: "a", start: "08:00", end: "09:40" });
    const next = nextClass([morning], NOW);
    // 周三这节已经过去，下一节是下周三
    expect(next?.startsAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next?.minutesUntil).toBeGreaterThan(60);
  });

  it("没有课的时候返回 null", () => {
    expect(nextClass([], NOW)).toBeNull();
  });

  it("时间写坏了的课直接跳过", () => {
    expect(nextClass([course({ id: "a", start: "十点" })], NOW)).toBeNull();
  });

  it("多门课时取最近的一节", () => {
    const a = course({ id: "a", start: "11:00" });
    const b = course({ id: "b", start: "10:00", name: "线性代数" });
    expect(nextClass([a, b], NOW)?.course.name).toBe("线性代数");
  });
});

describe("上课提醒", () => {
  it("40 分钟内才提醒", () => {
    const soon = nextClass([course({ id: "a" })], NOW); // 60 分钟后
    expect(shouldRemindClass(soon, NOW)).toBe(false);

    const at = new Date("2026-11-11T09:25:00+08:00"); // 35 分钟后
    expect(shouldRemindClass(nextClass([course({ id: "a" })], at), at)).toBe(true);
  });

  it("提醒文案带上教室和分钟数", () => {
    const at = new Date("2026-11-11T09:25:00+08:00");
    const next = nextClass([course({ id: "a" })], at)!;
    const text = classReminderText(next);
    expect(text).toContain("教三-201");
    expect(text).toContain("35 分钟");
    expect(text).toContain("高等数学");
  });

  it("门槛是 40 分钟", () => {
    expect(CLASS_REMIND_MINUTES).toBe(40);
  });

  it("没有下一节课时一律不提醒", () => {
    expect(shouldRemindClass(null, NOW)).toBe(false);
  });
});

describe("考试复习窗口", () => {
  const exam = (daysFromNow: number): Exam => ({
    id: "e1",
    at: new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString(),
  });

  it("考前 14 天内进入复习模式", () => {
    expect(inExamPrepWindow(exam(10), NOW)).toBe(true);
    expect(inExamPrepWindow(exam(14), NOW)).toBe(true);
  });

  it("超过 14 天不进入", () => {
    expect(inExamPrepWindow(exam(20), NOW)).toBe(false);
  });

  it("已经考完的不进入", () => {
    expect(inExamPrepWindow(exam(-1), NOW)).toBe(false);
  });

  it("窗口是 14 天", () => {
    expect(EXAM_PREP_DAYS).toBe(14);
  });
});

describe("作业剩余时间", () => {
  const assignment = (hours: number, steps?: Assignment["steps"]): Assignment => ({
    id: "a1",
    title: "数据结构作业",
    dueAt: new Date(NOW.getTime() + hours * 3_600_000).toISOString(),
    status: "todo",
    steps,
  });

  it("算出剩余小时", () => {
    expect(hoursUntilDue(assignment(5), NOW)).toBeCloseTo(5, 5);
  });

  it("逾期为负数", () => {
    expect(hoursUntilDue(assignment(-3), NOW)).toBeCloseTo(-3, 5);
  });

  it("小步总时长放得下就是来得及", () => {
    const steps = [
      { label: "读题", minutes: 20, done: false },
      { label: "写代码", minutes: 60, done: false },
    ];
    expect(fitsInRemainingTime(assignment(5, steps), NOW)).toBe(true);
    expect(fitsInRemainingTime(assignment(1, steps), NOW)).toBe(false);
  });

  it("已完成的小步不计入", () => {
    const steps = [
      { label: "读题", minutes: 60, done: true },
      { label: "写代码", minutes: 30, done: false },
    ];
    expect(fitsInRemainingTime(assignment(1, steps), NOW)).toBe(true);
  });
});

describe("上课提醒排程", () => {
  it("未来 7 天里每节课排一条，且都在课前 40 分钟", () => {
    const reminders = planClassReminders([course({ id: "a" })], {
      now: NOW,
      academicWeek: 11,
      days: 7,
    });
    // 今天周三 10:00 的课 → 09:20 提醒；往后 6 天没有同一门课
    expect(reminders.length).toBe(1);
    const gapMinutes = (reminders[0].at.getTime() - NOW.getTime()) / 60_000;
    expect(gapMinutes).toBe(20); // 09:00 → 09:20
    // 提醒点必须正好在课前 40 分钟
    const start = new Date(NOW);
    start.setHours(10, 0, 0, 0);
    expect((start.getTime() - reminders[0].at.getTime()) / 60_000).toBe(40);
  });

  it("时间已过的课不排", () => {
    const reminders = planClassReminders([course({ id: "a", start: "08:00" })], {
      now: NOW,
      academicWeek: 11,
      days: 1,
    });
    expect(reminders).toEqual([]);
  });

  it("单双周：不在本周的课不排", () => {
    const odd = course({ id: "a", weeks: [11, 13] });
    const reminders = planClassReminders([odd], {
      now: NOW,
      academicWeek: 12, // 双周，跳过
      days: 7,
    });
    expect(reminders).toEqual([]);
  });

  it("同一节课的 key 稳定", () => {
    const first = planClassReminders([course({ id: "a" })], { now: NOW, days: 7 });
    const second = planClassReminders([course({ id: "a" })], { now: NOW, days: 7 });
    expect(first[0].key).toBe(second[0].key);
    expect(first[0].key).toContain("a@");
  });

  it("文案说明为什么提醒", () => {
    const [reminder] = planClassReminders([course({ id: "a" })], { now: NOW, days: 7 });
    expect(reminder.body).toContain("高等数学");
    expect(reminder.body).toContain("教三-201");
  });
});