import { describe, expect, it } from "vitest";
import top3 from "../docs/contract/top3-cases.json";
import courseParse from "../docs/contract/course-parse-cases.json";
import { selectTopTasks } from "./todayTop3";
import type { TaskLike } from "./todayTop3";
import { parseCourseText } from "./courseImport";

/**
 * 契约用例的"执行者"。
 *
 * docs/contract/*.json 是给 Swift 端照抄的语言无关用例；这里用现有 TS 实现
 * 跑一遍，证明用例与当前行为一致。任何一边改动导致不一致，这个测试会先红。
 */

describe("契约：今日三件", () => {
  for (const item of top3.cases) {
    it(item.name, () => {
      const result = selectTopTasks(
        item.tasks as unknown as TaskLike[],
        top3.today,
      );
      const expectAny = item.expect as Record<string, unknown>;

      if ("top" in expectAny) {
        expect(result.top?.id ?? null).toBe(expectAny.top);
      }
      if ("ranked" in expectAny) {
        expect(result.ranked.map((t) => t.id)).toEqual(expectAny.ranked);
      }
      if ("display" in expectAny) {
        expect(result.display.map((t) => t.id)).toEqual(expectAny.display);
      }
      if ("openCount" in expectAny) {
        expect(result.openCount).toBe(expectAny.openCount);
      }
      if ("overdueCount" in expectAny) {
        expect(result.overdueCount).toBe(expectAny.overdueCount);
      }
      if ("scheduledCount" in expectAny) {
        expect(result.scheduledCount).toBe(expectAny.scheduledCount);
      }
    });
  }
});

describe("契约：课表文字解析", () => {
  for (const item of courseParse.cases) {
    it(item.name, () => {
      const result = parseCourseText(item.input);
      const actual = result.courses.map((c) => ({
        name: c.name,
        weekday: c.weekday,
        start: c.start,
        end: c.end,
        place: c.place ?? "",
      }));
      expect(actual).toEqual(item.expected);
      expect(result.failedLines.length).toBe(item.expectedFailed);
    });
  }
});
