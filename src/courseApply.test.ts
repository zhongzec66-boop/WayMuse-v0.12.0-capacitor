import { describe, expect, it } from "vitest";
import { dedupeCourses, prepareCourses, validateCourses } from "./courseApply";
import type { ParsedCourse } from "./courseImport";
import type { Course } from "./types";

function parsed(over: Partial<ParsedCourse> = {}): ParsedCourse {
  return {
    name: "高等数学",
    weekday: 3,
    start: "08:00",
    end: "09:40",
    place: "一教 302",
    ...over,
  } as ParsedCourse;
}

function existing(over: Partial<Course> = {}): Course {
  return {
    id: "c1",
    name: "高等数学",
    weekday: 3,
    start: "08:00",
    end: "09:40",
    place: "一教 302",
    ...over,
  } as Course;
}

describe("validateCourses", () => {
  it("正常课程通过", () => {
    const { valid, issues } = validateCourses([parsed()]);
    expect(valid).toHaveLength(1);
    expect(issues).toHaveLength(0);
  });

  it("空名字被拒", () => {
    const { valid, issues } = validateCourses([parsed({ name: "  " })]);
    expect(valid).toHaveLength(0);
    expect(issues[0].reason).toBe("name");
  });

  it("周几越界被拒（0 和 8）", () => {
    const { issues } = validateCourses([
      parsed({ weekday: 0 }),
      parsed({ weekday: 8 }),
    ]);
    expect(issues.map((i) => i.reason)).toEqual(["weekday", "weekday"]);
  });

  it("时间格式不对被拒", () => {
    const { issues } = validateCourses([parsed({ start: "8点" })]);
    expect(issues[0].reason).toBe("time");
  });

  it("下课早于上课被拒", () => {
    const { issues } = validateCourses([
      parsed({ start: "10:00", end: "09:00" }),
    ]);
    expect(issues[0].message).toContain("下课时间早于上课时间");
  });

  it("下课等于上课被拒（零长度课程）", () => {
    const { issues } = validateCourses([
      parsed({ start: "10:00", end: "10:00" }),
    ]);
    expect(issues).toHaveLength(1);
  });

  it("问题项保留下标，方便界面定位", () => {
    const { issues } = validateCourses([
      parsed({ name: "好课" }),
      parsed({ weekday: 9 }),
    ]);
    expect(issues[0].index).toBe(1);
  });

  it("混合输入：好的留下、坏的报出来", () => {
    const { valid, issues } = validateCourses([
      parsed({ name: "A" }),
      parsed({ name: "B", weekday: 0 }),
      parsed({ name: "C" }),
    ]);
    expect(valid.map((c) => c.name)).toEqual(["A", "C"]);
    expect(issues).toHaveLength(1);
  });

  it("名称两端空格会被 trim", () => {
    const { valid } = validateCourses([parsed({ name: "  线性代数  " })]);
    expect(valid[0].name).toBe("线性代数");
  });
});

describe("dedupeCourses", () => {
  it("同一份导入里的重复会被去掉", () => {
    const { kept, removed } = dedupeCourses([parsed(), parsed()]);
    expect(kept).toHaveLength(1);
    expect(removed).toBe(1);
  });

  it("与已有课程重复会被去掉", () => {
    const { kept, removed } = dedupeCourses([parsed()], [existing()]);
    expect(kept).toHaveLength(0);
    expect(removed).toBe(1);
  });

  it("名称差一个字不算重复", () => {
    const { kept } = dedupeCourses([parsed({ name: "高等数学A" })], [existing()]);
    expect(kept).toHaveLength(1);
  });

  it("同课不同时间不算重复", () => {
    const { kept } = dedupeCourses([parsed({ start: "10:00", end: "11:40" })], [existing()]);
    expect(kept).toHaveLength(1);
  });

  it("同课不同周几不算重复", () => {
    const { kept } = dedupeCourses([parsed({ weekday: 4 })], [existing()]);
    expect(kept).toHaveLength(1);
  });

  it("不同周次不算重复（weeks 不参与键）", () => {
    const { kept } = dedupeCourses([parsed({ weeks: [2, 4] })], [existing({ weeks: [1, 3] })]);
    expect(kept).toHaveLength(0);
  });
});

describe("prepareCourses", () => {
  it("先校验后去重：非法项不参与去重计数", () => {
    const result = prepareCourses(
      [parsed({ weekday: 0 }), parsed(), parsed()],
      [],
    );
    expect(result.issues).toHaveLength(1);
    expect(result.ready).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  it("空输入返回空结果", () => {
    const result = prepareCourses([], [existing()]);
    expect(result.ready).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.duplicates).toBe(0);
  });
});
