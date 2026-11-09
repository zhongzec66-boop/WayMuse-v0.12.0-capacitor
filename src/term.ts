import type { Course } from "./types";

/**
 * 教学周计算。
 *
 * 高校课表几乎都按「第 N 周」排，单双周、前八周、1-16 周这种写法很常见。
 * 没有开学日期就没法把日历日期换算成教学周，所以这里统一处理：
 * 用户没设过就按常见学期起点猜一个，并允许在导入课表时改成真实日期。
 */

const TERM_KEY = "term-start";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 没有设置时的猜测：9 月开学，或 2 月底开学 */
export function guessTermStart(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 8) return `${year}-09-01`;
  if (month >= 2) return `${year}-02-24`;
  return `${year - 1}-09-01`;
}

export function readTermStart(): string {
  try {
    const raw = localStorage.getItem(`${TERM_KEY}`);
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  } catch {
    // 读不到就用猜测值
  }
  return guessTermStart();
}

export function writeTermStart(value: string): void {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      localStorage.setItem(TERM_KEY, value.trim());
    }
  } catch {
    // 存储不可用时忽略：下周次计算会退回猜测值
  }
}

/** 当前是开学后的第几周（第一周 = 1）。早于开学日期时返回 0。 */
export function academicWeek(termStart: string, now = new Date()): number {
  const start = new Date(`${termStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 1;
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const diff = Math.floor(
    (today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  return diff < 0 ? 0 : Math.floor(diff / 7) + 1;
}

/** 这门课在指定周是否要上 */
export function isCourseInWeek(course: Course, week: number | null): boolean {
  if (!course.weeks || course.weeks.length === 0) return true; // 每周都上
  if (!week || week <= 0) return true; // 周次未知时不误伤
  return course.weeks.includes(week);
}

/** 「1-16周」「单周」「1-8,10-16周」→ 具体周次列表 */
export function expandWeeks(spec: string): number[] | null {
  const text = spec.replace(/\s+/g, "");
  if (!text) return null;

  if (/单周/.test(text)) return Array.from({ length: 30 }, (_, i) => i + 1).filter((w) => w % 2 === 1);
  if (/双周/.test(text)) return Array.from({ length: 30 }, (_, i) => i + 1).filter((w) => w % 2 === 0);

  const weeks = new Set<number>();
  for (const part of text.split(/[,，、]/)) {
    const range = part.match(/^(\d{1,2})\s*[-–—~]\s*(\d{1,2})$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      for (let w = Math.min(from, to); w <= Math.max(from, to); w += 1) {
        if (w >= 1 && w <= 30) weeks.add(w);
      }
      continue;
    }
    const single = part.match(/^(\d{1,2})$/);
    if (single) {
      const w = Number(single[1]);
      if (w >= 1 && w <= 30) weeks.add(w);
    }
  }

  return weeks.size ? [...weeks].sort((a, b) => a - b) : null;
}

export { toKey };
