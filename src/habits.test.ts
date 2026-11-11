import { describe, expect, it } from "vitest";
import { HABIT_MIN_COUNT, inferHabits } from "./habits";
import type { Task } from "./types";

const NOW = new Date("2026-11-11T21:00:00+08:00");

function done(
  id: string,
  category: string,
  dayOffset: number,
  hour: number,
): Task {
  const at = new Date(NOW);
  at.setDate(at.getDate() - dayOffset);
  at.setHours(hour, 0, 0, 0);
  return {
    id,
    text: `${category}相关`,
    done: true,
    category,
    completedAt: at.getTime(),
  };
}

describe("习惯推断", () => {
  it("同类事情 7 天内做 3 次、时段相近 → 生成一条习惯", () => {
    const habits = inferHabits(
      [done("a", "背单词", 1, 7), done("b", "背单词", 2, 8), done("c", "背单词", 3, 7)],
      { now: NOW },
    );
    expect(habits).toHaveLength(1);
    expect(habits[0].label).toBe("背单词");
    expect(habits[0].days).toBe(3);
    expect(habits[0].count).toBe(3);
  });

  it("文案格式：「连续 N 天 · 早上 X 点左右 + 事情」", () => {
    const habits = inferHabits(
      [done("a", "背单词", 1, 7), done("b", "背单词", 2, 7), done("c", "背单词", 3, 7)],
      { now: NOW },
    );
    expect(habits[0].text).toBe("连续 3 天 · 早上 6 点左右背单词");
  });

  it("只做 2 次不算习惯", () => {
    const habits = inferHabits(
      [done("a", "跑步", 1, 7), done("b", "跑步", 2, 7)],
      { now: NOW },
    );
    expect(habits).toHaveLength(0);
  });

  it("时段分散（不在同一个 2 小时窗口）不算同一种习惯", () => {
    const habits = inferHabits(
      [done("a", "读书", 1, 7), done("b", "读书", 2, 13), done("c", "读书", 3, 20)],
      { now: NOW },
    );
    expect(habits).toHaveLength(0);
  });

  it("超过 7 天的记录不计入", () => {
    const habits = inferHabits(
      [done("a", "早起", 10, 7), done("b", "早起", 11, 7), done("c", "早起", 12, 7)],
      { now: NOW },
    );
    expect(habits).toHaveLength(0);
  });

  it("同一天做 3 次也算 3 次，但只算 1 天", () => {
    const habits = inferHabits(
      [done("a", "整理", 1, 20), done("b", "整理", 1, 20), done("c", "整理", 1, 21)],
      { now: NOW },
    );
    expect(habits).toHaveLength(1);
    expect(habits[0].days).toBe(1);
    expect(habits[0].count).toBe(3);
  });

  it("被删过的签名不再生成", () => {
    const tasks = [
      done("a", "背单词", 1, 7),
      done("b", "背单词", 2, 7),
      done("c", "背单词", 3, 7),
    ];
    const first = inferHabits(tasks, { now: NOW });
    expect(first).toHaveLength(1);
    const again = inferHabits(tasks, {
      now: NOW,
      dismissedKeys: [first[0].signature],
    });
    expect(again).toHaveLength(0);
  });

  it("没完成的记录不算", () => {
    const tasks = [
      { ...done("a", "写作", 1, 9), done: false },
      { ...done("b", "写作", 2, 9), done: false },
      { ...done("c", "写作", 3, 9), done: false },
    ];
    expect(inferHabits(tasks, { now: NOW })).toHaveLength(0);
  });

  it("没有完成时间戳的旧任务不参与推断", () => {
    const tasks: Task[] = [
      { id: "a", text: "旧任务", done: true, category: "旧" },
      { id: "b", text: "旧任务", done: true, category: "旧" },
      { id: "c", text: "旧任务", done: true, category: "旧" },
    ];
    expect(inferHabits(tasks, { now: NOW })).toHaveLength(0);
  });

  it("类别为空时退回任务正文，不同正文不混在一起", () => {
    const tasks: Task[] = [
      { id: "a", text: "晨跑三公里", done: true, completedAt: done("x", "", 1, 6).completedAt },
      { id: "b", text: "晨跑三公里", done: true, completedAt: done("x", "", 2, 6).completedAt },
      { id: "c", text: "晨跑三公里", done: true, completedAt: done("x", "", 3, 6).completedAt },
      { id: "d", text: "写周报", done: true, completedAt: done("x", "", 1, 6).completedAt },
    ];
    const habits = inferHabits(tasks, { now: NOW });
    expect(habits).toHaveLength(1);
    expect(habits[0].label).toBe("晨跑三公里");
  });

  it("门槛常量是 3 次", () => {
    expect(HABIT_MIN_COUNT).toBe(3);
  });
});
