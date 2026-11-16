import { describe, expect, it } from "vitest";
import { remainingAfter, selectTopTasks } from "./todayTop3";
import type { TaskLike } from "./todayTop3";

const TODAY = "2026-11-16";

function task(over: Partial<TaskLike> & { id: string }): TaskLike {
  return {
    text: over.id,
    done: false,
    ...over,
  } as TaskLike;
}

describe("selectTopTasks", () => {
  it("空列表：没有 top，计数全 0", () => {
    const result = selectTopTasks([], TODAY);
    expect(result.top).toBeUndefined();
    expect(result.display).toEqual([]);
    expect(result.openCount).toBe(0);
  });

  it("全部完成：没有 top", () => {
    const result = selectTopTasks(
      [task({ id: "a", done: true }), task({ id: "b", done: true })],
      TODAY,
    );
    expect(result.top).toBeUndefined();
    expect(result.openCount).toBe(0);
  });

  it("逾期优先于今天到期", () => {
    const result = selectTopTasks(
      [
        task({ id: "today", deadline: TODAY }),
        task({ id: "late", deadline: "2026-11-10" }),
      ],
      TODAY,
    );
    expect(result.top?.id).toBe("late");
    expect(result.overdueCount).toBe(1);
    expect(result.scheduledCount).toBe(1);
  });

  it("多个逾期：按截止日期从早到晚", () => {
    const result = selectTopTasks(
      [
        task({ id: "c", deadline: "2026-11-12" }),
        task({ id: "a", deadline: "2026-11-01" }),
        task({ id: "b", deadline: "2026-11-08" }),
      ],
      TODAY,
    );
    expect(result.ranked.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("同一天截止：保持原数组相对顺序（稳定排序）", () => {
    const result = selectTopTasks(
      [
        task({ id: "first", deadline: TODAY }),
        task({ id: "second", deadline: TODAY }),
      ],
      TODAY,
    );
    expect(result.ranked.map((t) => t.id)).toEqual(["first", "second"]);
  });

  it("有截止日期的排在没截止日期之前", () => {
    const result = selectTopTasks(
      [task({ id: "no-date" }), task({ id: "has-date", deadline: "2026-12-01" })],
      TODAY,
    );
    expect(result.top?.id).toBe("has-date");
    expect(result.unscheduledCount).toBe(1);
  });

  it("没有截止日期时，取原数组第一个（与抽取前一致）", () => {
    const result = selectTopTasks(
      [task({ id: "x" }), task({ id: "y" }), task({ id: "z" })],
      TODAY,
    );
    expect(result.top?.id).toBe("x");
  });

  it("display 的第一项一定是 top，其余保持原顺序", () => {
    const result = selectTopTasks(
      [
        task({ id: "a" }),
        task({ id: "b", deadline: "2026-11-01" }),
        task({ id: "c" }),
      ],
      TODAY,
    );
    expect(result.display.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("已完成的不会出现在候选里", () => {
    const result = selectTopTasks(
      [
        task({ id: "done", done: true, deadline: "2026-11-01" }),
        task({ id: "open", deadline: TODAY }),
      ],
      TODAY,
    );
    expect(result.ranked.map((t) => t.id)).toEqual(["open"]);
  });

  it("截止日期正好是今天：不算逾期", () => {
    const result = selectTopTasks([task({ id: "a", deadline: TODAY })], TODAY);
    expect(result.overdueCount).toBe(0);
    expect(result.scheduledCount).toBe(1);
  });

  it("不改动传入的数组（无副作用）", () => {
    const input = [task({ id: "b", deadline: "2026-11-20" }), task({ id: "a" })];
    const snapshot = input.map((t) => t.id);
    selectTopTasks(input, TODAY);
    expect(input.map((t) => t.id)).toEqual(snapshot);
  });

  it("大量任务也稳定：100 条随机截止日期，top 是最早的逾期", () => {
    const many: TaskLike[] = Array.from({ length: 100 }, (_, i) =>
      task({
        id: `t${i}`,
        deadline: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
      }),
    );
    const result = selectTopTasks(many, TODAY);
    expect(result.top?.deadline).toBe("2026-11-01");
    expect(result.openCount).toBe(100);
  });
});

describe("remainingAfter", () => {
  it("只剩一件时是 0，不会出现负数", () => {
    expect(remainingAfter(1)).toBe(0);
    expect(remainingAfter(0)).toBe(0);
    expect(remainingAfter(3)).toBe(2);
  });
});
