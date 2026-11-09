import { describe, expect, it } from "vitest";
import { parseCourseLine, parseCourseTableLine, parseCourseText } from "./courseImport";

describe("parseCourseLine（一行一门课）", () => {
  it("认得「周几 + 时间 + 课名 + @地点」", () => {
    const result = parseCourseLine("周一 08:00-09:40 高等数学 @教三-201");
    expect(result).not.toBeNull();
    expect(result?.weekday).toBe(1);
    expect(result?.start).toBe("08:00");
    expect(result?.end).toBe("09:40");
    expect(result?.name).toContain("高等数学");
    expect(result?.place).toContain("教三");
  });

  it("周日映射成 0（和课表列一致）", () => {
    expect(parseCourseLine("周日 10:00-11:40 选修 @图书馆")?.weekday).toBe(0);
  });

  it("认「第 3-4 节」并换算成时间", () => {
    const result = parseCourseLine("周三 第3-4节 大学物理");
    expect(result?.start).toBe("10:00");
    expect(result?.end).toBe("11:40");
  });

  it("「第 5-6 节」是下午第一节", () => {
    const result = parseCourseLine("周二 第5-6节 线性代数");
    expect(result?.start).toBe("14:00");
    expect(result?.end).toBe("15:40");
  });

  it("单节也落在对应时段", () => {
    expect(parseCourseLine("周一 第1节 早读")?.start).toBe("08:00");
  });

  it("单周展开成奇数周", () => {
    const weeks = parseCourseLine("周四 08:00-09:40 体育 单周")?.weeks ?? [];
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks.every((week) => week % 2 === 1)).toBe(true);
    expect(weeks[0]).toBe(1);
  });

  it("双周展开成偶数周", () => {
    const weeks = parseCourseLine("周四 08:00-09:40 体育 双周")?.weeks ?? [];
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks.every((week) => week % 2 === 0)).toBe(true);
  });

  it("表头不当作课程", () => {
    expect(parseCourseLine("序号 课程 星期 时间")).toBeNull();
  });

  it("没有周几的行解析不出来", () => {
    expect(parseCourseLine("高等数学 08:00-09:40")).toBeNull();
  });
});

describe("parseCourseTableLine（一行一个节次的表格）", () => {
  const row =
    "5-6节 (14:00-15:40) 概率论与数理 数据结构实验 毛概 体育（网球） 大学英语 算法竞赛培训 无";

  it("按列切成 7 门课（「无」跳过）", () => {
    const courses = parseCourseTableLine(row);
    expect(courses).toHaveLength(6);
    expect(courses.map((c) => c.name)).toEqual([
      "概率论与数理",
      "数据结构实验",
      "毛概",
      "体育（网球）",
      "大学英语",
      "算法竞赛培训",
    ]);
  });

  it("列顺序映射到周一到周日", () => {
    const courses = parseCourseTableLine(row);
    expect(courses.map((c) => c.weekday)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("用括号里的时间，不用节次换算", () => {
    const courses = parseCourseTableLine(row);
    expect(courses[0].start).toBe("14:00");
    expect(courses[0].end).toBe("15:40");
  });

  it("没有钟点时按节次换算", () => {
    const courses = parseCourseTableLine(
      "7-8节 职业生涯规划 离散数学 计算机组成原理 大学物理实验 无 算法竞赛培训 无",
    );
    expect(courses[0].start).toBe("16:00");
  });

  it("列数不足 7 时不硬猜", () => {
    expect(parseCourseTableLine("5-6节 (14:00-15:40) 概率论 数据结构")).toEqual([]);
  });
});

describe("parseCourseText（整段文本）", () => {
  it("混合格式也能一起解析", () => {
    const text = [
      "周一 08:00-09:40 高等数学 @教三-201",
      "5-6节 (14:00-15:40) 概率论与数理 数据结构实验 毛概 体育（网球） 大学英语 算法竞赛培训 无",
    ].join("\n");
    const result = parseCourseText(text);
    expect(result.courses.length).toBe(7);
    expect(result.failedLines).toHaveLength(0);
  });

  it("认不出的行进入 failedLines（方便提示用户）", () => {
    const result = parseCourseText("这是一段随便写的话");
    expect(result.courses).toHaveLength(0);
    expect(result.failedLines.length).toBeGreaterThan(0);
  });
});
