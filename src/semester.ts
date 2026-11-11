import type { Course } from "./types";

/**
 * 学期结构化数据（Agent 框架第 1 层 + 第 2 层）。
 *
 * 为什么要有这一层：只靠聊天文本和 MEMORY.md，助理永远只能被动回答。
 * 把「课程 / 作业 / 考试」变成对象，才能算得清「现在该提醒什么」，
 * 也才谈得上主动。
 *
 * 全部是纯函数：
 * - 不碰存储（存哪里由调用方决定）
 * - 不碰系统接口（发不发通知由调用方决定）
 */

/** 作业：比普通任务多「占总成绩多少」和「拆解出来的小步」 */
export type Assignment = {
  id: string;
  title: string;
  /** 关联课程；允许为空（临时作业、非本学期的课） */
  courseId?: string;
  /** ISO8601 精确时刻 */
  dueAt: string;
  /** 占总成绩比例，0–100 */
  weightPercent?: number;
  status: "todo" | "doing" | "done";
  steps?: AssignmentStep[];
};

export type AssignmentStep = {
  label: string;
  /** 估时（分钟），用于按剩余时间判断还来不来得及 */
  minutes: number;
  done: boolean;
};

/** 考试：范围、进度、复习计划 */
export type Exam = {
  id: string;
  courseId?: string;
  at: string;
  scope?: string;
  /** 复习进度 0–100 */
  progressPercent?: number;
  reviewPlan?: ReviewItem[];
};

export type ReviewItem = {
  /** YYYY-MM-DD */
  date: string;
  topic: string;
  done: boolean;
};

/** 上课前多久提醒 */
export const CLASS_REMIND_MINUTES = 40;
/** 考试前几天开始进复习模式 */
export const EXAM_PREP_DAYS = 14;

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function parseClock(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** 这门课在这一天有没有课（含单双周判断） */
export function courseOnDay(
  course: Course,
  date: Date,
  academicWeek?: number,
): boolean {
  if (course.weekday !== date.getDay()) return false;
  if (!course.weeks || course.weeks.length === 0) return true;
  if (academicWeek === undefined) return true;
  return course.weeks.includes(academicWeek);
}

export type UpcomingClass = {
  course: Course;
  /** 上课时刻 */
  startsAt: Date;
  /** 距上课还有几分钟 */
  minutesUntil: number;
  /** 教室 */
  place: string;
};

/**
 * 下一次要上的课，以及还有几分钟。
 *
 * `academicWeek` 由调用方算（app 里走 academicWeek(readTermStart())），
 * 这里不读存储，保证可以单测。
 */
export function nextClass(
  courses: Course[],
  now: Date = new Date(),
  academicWeek?: number,
): UpcomingClass | null {
  let best: UpcomingClass | null = null;

  // 今天剩下的课 + 往后 7 天（覆盖跨周末的情况）
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);

    for (const course of courses) {
      if (!courseOnDay(course, day, academicWeek)) continue;
      const clock = parseClock(course.start);
      if (!clock) continue;

      const startsAt = new Date(day);
      startsAt.setHours(clock.hour, clock.minute, 0, 0);
      if (startsAt.getTime() <= now.getTime()) continue;

      const minutesUntil = Math.round(
        (startsAt.getTime() - now.getTime()) / 60_000,
      );
      if (!best || startsAt.getTime() < best.startsAt.getTime()) {
        best = { course, startsAt, minutesUntil, place: course.place };
      }
    }
  }

  return best;
}

/** 该不该现在提醒「要上课了」——定稿写的是提前 40 分钟 */
export function shouldRemindClass(
  upcoming: UpcomingClass | null,
  now: Date = new Date(),
): boolean {
  if (!upcoming) return false;
  const minutes = (upcoming.startsAt.getTime() - now.getTime()) / 60_000;
  return minutes > 0 && minutes <= CLASS_REMIND_MINUTES;
}

/** 「带什么、教室在哪」——提醒文案要能说清为什么提醒你 */
export function classReminderText(upcoming: UpcomingClass): string {
  const day = WEEKDAY_NAMES[upcoming.startsAt.getDay()] ?? "";
  const time = `${String(upcoming.startsAt.getHours()).padStart(2, "0")}:${String(
    upcoming.startsAt.getMinutes(),
  ).padStart(2, "0")}`;
  const place = upcoming.place ? ` · ${upcoming.place}` : "";
  return `${upcoming.minutesUntil} 分钟后上课：${upcoming.course.name} ${day} ${time}${place}`;
}

/** 考试是否已经进入复习窗口（考前 14 天） */
export function inExamPrepWindow(
  exam: Exam,
  now: Date = new Date(),
): boolean {
  const at = new Date(exam.at);
  if (Number.isNaN(at.getTime())) return false;
  const days = (at.getTime() - now.getTime()) / 86_400_000;
  return days > 0 && days <= EXAM_PREP_DAYS;
}

/** 作业的剩余时间（小时），逾期为负 */
export function hoursUntilDue(
  assignment: Assignment,
  now: Date = new Date(),
): number | null {
  const due = new Date(assignment.dueAt);
  if (Number.isNaN(due.getTime())) return null;
  return (due.getTime() - now.getTime()) / 3_600_000;
}

/**
 * 剩下的时间够不够做完拆解出来的小步。
 *
 * 用来回答「还来不来得及」这类问题——直接说「来不及」很打击人，
 * 这里只给事实，怎么说不归这个函数管。
 */
export function fitsInRemainingTime(
  assignment: Assignment,
  now: Date = new Date(),
): boolean | null {
  const hours = hoursUntilDue(assignment, now);
  if (hours === null) return null;
  const remaining = assignment.steps?.filter((step) => !step.done) ?? [];
  const neededMinutes = remaining.reduce((sum, step) => sum + step.minutes, 0);
  return neededMinutes <= hours * 60;
}

/** 作业显示状态：逾期由时间算出来，不靠手填 */
export function assignmentStatus(
  assignment: Assignment,
  now: Date = new Date(),
): Assignment["status"] {
  if (assignment.status === "done") return "done";
  const hours = hoursUntilDue(assignment, now);
  if (hours !== null && hours < 0) return "todo";
  return assignment.status;
}

/** 一节课的上课提醒（供本地通知排程用） */
export type ClassReminder = {
  /** 稳定 id 的种子：课程 + 日期，同一节课每次算同一个值 */
  key: string;
  courseName: string;
  title: string;
  body: string;
  at: Date;
};

/**
 * 把未来几天里每节课排成一条「提前 40 分钟」的提醒。
 *
 * 为什么按天铺开而不是只排下一节：本地通知要在 App 前台时提前排好，
 * App 被杀掉就不会再算。只排下一节的话，一旦没打开 App，后面几天的课
 * 全都不会有提醒。
 *
 * 单双周由 academicWeek 判断：给了本周周次就按 +天数/7 推出每节课的周次。
 */
export function planClassReminders(
  courses: Course[],
  options: { now?: Date; academicWeek?: number; days?: number } = {},
): ClassReminder[] {
  const now = options.now ?? new Date();
  const days = options.days ?? 7;
  const reminders: ClassReminder[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);

    // 第 offset 天属于第几周：以「本周一」为基准，跨周才算加一
    const week =
      options.academicWeek === undefined
        ? undefined
        : options.academicWeek + weekOffset(now, day);

    for (const course of courses) {
      if (!courseOnDay(course, day, week)) continue;
      const clock = parseClock(course.start);
      if (!clock) continue;

      const startsAt = new Date(day);
      startsAt.setHours(clock.hour, clock.minute, 0, 0);
      const at = new Date(startsAt.getTime() - CLASS_REMIND_MINUTES * 60_000);
      if (at.getTime() <= now.getTime()) continue;

      const upcoming: UpcomingClass = {
        course,
        startsAt,
        minutesUntil: CLASS_REMIND_MINUTES,
        place: course.place,
      };
      reminders.push({
        key: `${course.id}@${localDate(day)}`,
        courseName: course.name,
        title: `${CLASS_REMIND_MINUTES} 分钟后上课`,
        body: classReminderText(upcoming),
        at,
      });
    }
  }

  reminders.sort((a, b) => a.at.getTime() - b.at.getTime());
  return reminders;
}

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
/** day 比基准日所在的自然周晚了几周（周一为一周之始） */
function weekOffset(base: Date, day: Date): number {
  const mondayOf = (date: Date): number => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    const shift = (copy.getDay() + 6) % 7; // 周一 = 0
    copy.setDate(copy.getDate() - shift);
    return copy.getTime();
  };
  return Math.round((mondayOf(day) - mondayOf(base)) / (7 * 86_400_000));
}