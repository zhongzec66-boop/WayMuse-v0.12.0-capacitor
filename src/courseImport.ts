import type { Course } from "./types";
import { expandWeeks } from "./term";

/**
 * 课表文本解析。
 *
 * 目标：把用户从教务系统「复制出来的那一坨」变成课程列表。
 * 只做本地正则，不调模型 —— 粘贴导入的成功率取决于格式覆盖率，
 * 认不出来时应当明确告诉用户怎么整理，而不是假装成功。
 */

export type ParsedCourse = {
  name: string;
  weekday: number;
  start: string;
  end: string;
  place: string;
  /** 第几周上；缺省表示每周 */
  weeks?: number[];
};

const WEEKDAY_CHARS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
  七: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 0,
};

/** 国内高校最常见的作息，用来把「第 1-2 节」换算成时间 */
const PERIODS: Array<[string, string]> = [
  ["08:00", "09:40"],
  ["10:00", "11:40"],
  ["14:00", "15:40"],
  ["16:00", "17:40"],
  ["19:00", "20:40"],
];

function normalizeTime(raw: string): string | null {
  const match = raw.match(/^(\d{1,2})[:：](\d{1,2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function pickWeekday(text: string): { weekday: number; rest: string } | null {
  const match = text.match(/(?:周|星期|礼拜)\s*([一二三四五六日天七1-7])/);
  if (!match) return null;
  const index = match.index ?? 0;
  const weekday = WEEKDAY_CHARS[match[1]];
  if (weekday === undefined) return null;
  return {
    weekday,
    rest: `${text.slice(0, index)} ${text.slice(index + match[0].length)}`,
  };
}

function pickTimeRange(
  text: string,
): { start: string; end: string; rest: string } | null {
  // 08:00-09:40 / 8:00~9:40 / 08:00 至 09:40
  const range = text.match(
    /(\d{1,2}[:：]\d{1,2})\s*[-–—~～至到]\s*(\d{1,2}[:：]\d{1,2})/,
  );
  if (range) {
    const start = normalizeTime(range[1]);
    const end = normalizeTime(range[2]);
    if (start && end) {
      const index = range.index ?? 0;
      return {
        start,
        end,
        rest: `${text.slice(0, index)} ${text.slice(index + range[0].length)}`,
      };
    }
  }

  // 第 1-2 节 / 第3节
  const periods = text.match(/第\s*(\d{1,2})\s*(?:[-–—~～]\s*(\d{1,2})\s*)?节/);
  if (periods) {
    const first = Number(periods[1]);
    const last = Number(periods[2] ?? periods[1]);
    const slot = PERIODS[Math.min(first, last) - 1];
    const slotEnd = PERIODS[Math.max(first, last) - 1];
    if (slot && slotEnd) {
      const index = periods.index ?? 0;
      return {
        start: slot[0],
        end: slotEnd[1],
        rest: `${text.slice(0, index)} ${text.slice(index + periods[0].length)}`,
      };
    }
  }

  return null;
}

function pickPlace(text: string): { place: string; rest: string } {
  // @A302 / （教三-302） / [A302]
  const at = text.match(/[@＠]\s*([^\s,，;；]+)/);
  if (at) {
    const index = at.index ?? 0;
    return {
      place: at[1].trim(),
      rest: `${text.slice(0, index)} ${text.slice(index + at[0].length)}`,
    };
  }
  const bracket = text.match(/[（(【[]\s*([^）)】\]]{1,24})\s*[）)】\]]/);
  if (bracket) {
    const index = bracket.index ?? 0;
    return {
      place: bracket[1].trim(),
      rest: `${text.slice(0, index)} ${text.slice(index + bracket[0].length)}`,
    };
  }
  // 末尾形如「教三-302」「A楼302」「外语楼204」：取最后一个空格分隔的片段，
  // 只要含地点关键字就当地点（「外语楼」前面是中文，不能用字符集限定）
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (last.length <= 24 && /(楼|教|馆|室|中心|校区|场)/.test(last)) {
      return { place: last, rest: parts.slice(0, -1).join(" ") };
    }
  }
  return { place: "", rest: text };
}

function cleanupName(raw: string): string {
  return raw
    .replace(/[,，;；|、]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(课程|课程名称)[:：]?\s*/, "")
    .trim();
}

/**
 * 抽出「第几周」并把它从行里摘掉。
 * 认得的写法：1-16周 / 第1-16周 / 单周 / 双周 / 1-8,10-16周 / 3周
 */
function pickWeeks(text: string): { weeks?: number[]; rest: string } {
  const match = text.match(
    /(第)?\s*((?:\d{1,2}\s*[-–—~]\s*\d{1,2}|\d{1,2})(?:\s*[,，、]\s*(?:\d{1,2}\s*[-–—~]\s*\d{1,2}|\d{1,2}))*)\s*周/,
  );
  if (match && match.index !== undefined) {
    const weeks = expandWeeks(match[2]);
    return {
      weeks: weeks ?? undefined,
      rest: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`,
    };
  }
  const parity = text.match(/(单|双)\s*周/);
  if (parity && parity.index !== undefined) {
    return {
      weeks: expandWeeks(parity[1] === "单" ? "单周" : "双周") ?? undefined,
      rest: `${text.slice(0, parity.index)} ${text.slice(parity.index + parity[0].length)}`,
    };
  }
  return { rest: text };
}

/** 解析单行；认不出来返回 null */
export function parseCourseLine(line: string): ParsedCourse | null {
  const text = line.trim();
  if (!text || text.length < 4) return null;
  if (/^(序号|课程|星期|时间|地点|备注)/.test(text) && text.length < 12) {
    return null; // 表头
  }

  const weekdayPart = pickWeekday(text);
  if (!weekdayPart) return null;

  const timePart = pickTimeRange(weekdayPart.rest);
  if (!timePart) return null;

  const placePart = pickPlace(timePart.rest);
  const weekPart = pickWeeks(placePart.rest);
  const name = cleanupName(weekPart.rest);

  if (!name) return null;
  return {
    name: name.slice(0, 40),
    weekday: weekdayPart.weekday,
    start: timePart.start,
    end: timePart.end,
    place: placePart.place.slice(0, 40),
    weeks: weekPart.weeks,
  };
}

/** 解析整段文本；自动跳过表头和认不出的行 */
export function parseCourseText(text: string): {
  courses: ParsedCourse[];
  failedLines: string[];
} {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;
    // 输入框是单行的：用户可能把好几门课塞进一行，用「周一…周二…」切开
    const pieces = line.split(/(?=(?:周|星期)[一二三四五六日天1-7])/);
    if (pieces.length > 1) {
      for (const piece of pieces) {
        const trimmed = piece.trim();
        if (trimmed) lines.push(trimmed);
      }
    } else {
      lines.push(line);
    }
  }

  const courses: ParsedCourse[] = [];
  const failedLines: string[] = [];

  for (const line of lines) {
    const parsed = parseCourseLine(line);
    if (parsed) courses.push(parsed);
    else if (line.length >= 6) failedLines.push(line);
  }

  // 同一门课同名同天同开始时间只保留一条（教务系统常见重复）
  const seen = new Set<string>();
  const unique = courses.filter((course) => {
    const key = `${course.name}|${course.weekday}|${course.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) =>
    a.weekday === b.weekday
      ? a.start.localeCompare(b.start)
      : a.weekday - b.weekday,
  );

  return { courses: unique, failedLines };
}

/** 把解析结果转成 Course（生成 id），并跳过已有课程 */
export function toCourses(
  parsed: ParsedCourse[],
  existing: Course[],
  makeId: () => string,
): Course[] {
  const existingKeys = new Set(
    existing.map(
      (course) => `${course.name}|${course.weekday}|${course.start}`,
    ),
  );
  return parsed
    .filter(
      (course) =>
        !existingKeys.has(`${course.name}|${course.weekday}|${course.start}`),
    )
    .map((course) => ({
      id: makeId(),
      name: course.name,
      weekday: course.weekday,
      start: course.start,
      end: course.end,
      place: course.place,
      weeks: course.weeks,
    }));
}
