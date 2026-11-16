import { describe, expect, it } from "vitest";
import {
  applyConsolidation,
  memoryCounts,
  planConsolidation,
} from "./consolidation";
import type { Memory } from "./types";

const NOW = new Date("2026-11-11T21:00:00+08:00");
const YESTERDAY = new Date("2026-11-10T09:00:00+08:00").getTime();
const TODAY = new Date("2026-11-11T09:00:00+08:00").getTime();

function memory(
  id: string,
  createdAt: number,
  status: "pending" | "consolidated" = "pending",
): Memory {
  return { id, text: `记忆 ${id}`, weight: 2, createdAt, status };
}

describe("巩固计划", () => {
  it("昨天的 pending 条目要巩固", () => {
    const plan = planConsolidation([memory("a", YESTERDAY)], { now: NOW });
    expect(plan.promote.map((m) => m.id)).toEqual(["a"]);
    expect(plan.shouldAnimate).toBe(true);
  });

  it("今天新建的 pending 先留在海马体", () => {
    const plan = planConsolidation([memory("a", TODAY)], { now: NOW });
    expect(plan.promote).toEqual([]);
    expect(plan.shouldAnimate).toBe(false);
  });

  it("已巩固的不再处理", () => {
    const plan = planConsolidation([memory("a", YESTERDAY, "consolidated")], {
      now: NOW,
    });
    expect(plan.promote).toEqual([]);
  });

  it("今天已经播过动画：数据照旧巩固，但不再播", () => {
    const plan = planConsolidation([memory("a", YESTERDAY)], {
      now: NOW,
      lastConsolidatedAt: new Date("2026-11-11T08:00:00+08:00").getTime(),
    });
    expect(plan.promote).toHaveLength(1);
    expect(plan.shouldAnimate).toBe(false);
  });

  it("昨天播过的动画，今天可以再播一次", () => {
    const plan = planConsolidation([memory("a", YESTERDAY)], {
      now: NOW,
      lastConsolidatedAt: new Date("2026-11-10T21:00:00+08:00").getTime(),
    });
    expect(plan.shouldAnimate).toBe(true);
  });

  it("没有可巩固的条目就不播动画", () => {
    const plan = planConsolidation([], { now: NOW });
    expect(plan.promote).toEqual([]);
    expect(plan.shouldAnimate).toBe(false);
  });
});

describe("执行巩固", () => {
  it("只改命中的条目，其余不动", () => {
    const list = [
      memory("a", YESTERDAY),
      memory("b", TODAY),
      memory("c", YESTERDAY, "consolidated"),
    ];
    const plan = planConsolidation(list, { now: NOW });
    const next = applyConsolidation(list, plan.promote);
    expect(next.find((m) => m.id === "a")?.status).toBe("consolidated");
    expect(next.find((m) => m.id === "b")?.status).toBe("pending");
    expect(next.find((m) => m.id === "c")?.status).toBe("consolidated");
  });

  it("不改原数组", () => {
    const list = [memory("a", YESTERDAY)];
    applyConsolidation(list, planConsolidation(list, { now: NOW }).promote);
    expect(list[0].status).toBe("pending");
  });

  it("海马体减几条，皮层就加几条", () => {
    const list = [
      memory("a", YESTERDAY),
      memory("b", YESTERDAY),
      memory("c", TODAY),
    ];
    const before = memoryCounts(list);
    const next = applyConsolidation(
      list,
      planConsolidation(list, { now: NOW }).promote,
    );
    const after = memoryCounts(next);
    expect(after.pending).toBe(before.pending - 2);
    expect(after.consolidated).toBe(before.consolidated + 2);
  });

  it("空计划时原样返回", () => {
    const list = [memory("a", TODAY)];
    expect(applyConsolidation(list, [])).toBe(list);
  });
});
