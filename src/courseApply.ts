import type { Course } from "./types";
import type { ParsedCourse } from "./courseImport";

/**
 * 导入管线的最后两步：校验 + 去重。
 *
 * 抽成纯函数的原因：现在有四个入口（Today / 计划页批量 / 计划页单节 / 聊天），
 * 每个入口自己判一遍，行为就会漂移。统一到这里之后，任何入口都只负责
 * 「拿到 ParsedCourse[]」，剩下的交给我。
 */

export type CourseIssue = {
  /** 在输入数组里的下标 */
  index: number;
  reason: "name" | "weekday" | "time";
  /** 给用户看的一句话 */
  message: string;
};

function toMinutes(time: string): number {
  const [hour, minute] = (time ?? "").split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function isTime(value: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test((value ?? "").trim());
}

/** 只留下能用的课程；问题项按原顺序回传，供界面逐条提示 */
export function validateCourses(input: ParsedCourse[]): {
  valid: ParsedCourse[];
  issues: CourseIssue[];
} {
  const valid: ParsedCourse[] = [];
  const issues: CourseIssue[] = [];

  input.forEach((course, index) => {
    const name = (course.name ?? "").trim();
    if (!name) {
      issues.push({ index, reason: "name", message: "课程名是空的" });
      return;
    }
    if (
      !Number.isInteger(course.weekday) ||
      course.weekday < 1 ||
      course.weekday > 7
    ) {
      issues.push({ index, reason: "weekday", message: "周几不在 1–7 之间" });
      return;
    }
    if (!isTime(course.start) || !isTime(course.end)) {
      issues.push({ index, reason: "time", message: "上课或下课时间格式不对" });
      return;
    }
    if (toMinutes(course.end) <= toMinutes(course.start)) {
      issues.push({ index, reason: "time", message: "下课时间早于上课时间" });
      return;
    }
    valid.push({ ...course, name });
  });

  return { valid, issues };
}

/** 同一份导入里 + 与已有课程之间，按 名称+周几+开始时间 去重 */
export function dedupeCourses(
  input: ParsedCourse[],
  existing: Course[] = [],
): { kept: ParsedCourse[]; removed: number } {
  const seen = new Set(
    existing.map((course) => `${course.name}|${course.weekday}|${course.start}`),
  );
  const kept: ParsedCourse[] = [];
  let removed = 0;

  for (const course of input) {
    const key = `${course.name}|${course.weekday}|${course.start}`;
    if (seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    kept.push(course);
  }

  return { kept, removed };
}

/** 校验 + 去重一次做完，入口层只需要调这一个 */
export function prepareCourses(
  input: ParsedCourse[],
  existing: Course[] = [],
): { ready: ParsedCourse[]; issues: CourseIssue[]; duplicates: number } {
  const { valid, issues } = validateCourses(input);
  const { kept, removed } = dedupeCourses(valid, existing);
  return { ready: kept, issues, duplicates: removed };
}
