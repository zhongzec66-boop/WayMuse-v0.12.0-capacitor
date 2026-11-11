import type { Task } from "./types";
import { parseCourseRecord } from "./courseImport";
import type { ParsedCourse } from "./courseImport";

export type Priority = "high" | "medium" | "low";

export type Plan = {
  title: string;
  summary: string;
  steps: string[];
  /** 可选：YYYY-MM-DD，用户提到时间时给出 */
  deadline?: string;
  /** 可选：HH:mm，用户说了具体钟点时给出 */
  time?: string;
  /** 可选：多少秒后提醒。用于「5 秒后 / 20 分钟后提醒我」这种相对时间 */
  remindIn?: number;
  /** 可选：重要程度，影响 Today 排序 */
  priority?: Priority;
};

export type Reply = {
  text: string;
  plans: Plan[];
  /** 值得写入“记忆”的事实，最多 3 条 */
  memories: { text: string; kind?: "emotion" | "normal" }[];
  /** 从课表文本里整理出的课程，等用户确认后写入 */
  courses: ParsedCourse[];
  /** 可点选的选项：渲染成按钮，点了直接作为回答发出 */
  choices: string[];
  /** 提议的作业 / 考试：渲染成确认卡，点「对」才写入 */
  deadlines?: DeadlineProposal[];
};

/** 模型提议的一条作业或考试。日期必须是 YYYY-MM-DD，时间 HH:mm。 */
export type DeadlineProposal = {
  kind: "assignment" | "exam";
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm，可省略（作业默认 23:59，考试默认 09:00） */
  time?: string;
  /** 课程名（文本匹配，不要求 id） */
  course?: string;
  /** 作业占总成绩比例 */
  weight?: number;
  /** 考试范围 */
  scope?: string;
};

/**
 * 输出协议：正文之外，允许两个契约块。
 * 前端会把它们从正文里剥掉，渲染成可确认的卡片。
 */
function parsePriority(value: unknown): Priority | undefined {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : undefined;
}

function parseDeadline(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function parsePlan(value: unknown): Plan | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string" || !record.title.trim()) return null;
  if (!Array.isArray(record.steps)) return null;
  const steps = record.steps
    .filter((step): step is string => typeof step === "string" && !!step.trim())
    .slice(0, 4)
    .map((step) => step.trim().slice(0, 80));
  if (!steps.length) return null;
  const deadlineRaw = parseDeadline(record.deadline);
  const timeRaw =
    typeof record.time === "string" &&
    /^\d{1,2}:\d{2}$/.test(record.time.trim())
      ? record.time.trim().padStart(5, "0")
      : undefined;
  const remindRaw = Number(record.remindIn);
  const remindIn =
    Number.isFinite(remindRaw) && remindRaw > 0 && remindRaw <= 86_400
      ? Math.round(remindRaw)
      : undefined;
  // 早于今天的 deadline 一律丢弃：模型偶尔会沿用训练数据里的旧日期
  const today = localDateKey();
  const deadline =
    deadlineRaw && deadlineRaw >= today ? deadlineRaw : undefined;
  return {
    title: record.title.trim().slice(0, 24),
    summary:
      typeof record.summary === "string" ? record.summary.slice(0, 60) : "",
    steps,
    deadline,
    time: timeRaw,
    remindIn,
    priority: parsePriority(record.priority),
  };
}

function extractBlock(
  content: string,
  tag: string,
): { rest: string; body: string | null } {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = content.indexOf(open);
  if (start < 0) return { rest: content, body: null };
  const end = content.indexOf(close, start);
  if (end < 0) {
    // 流式输出还没闭合：先不把半个 JSON 显示成正文
    return {
      rest: content.slice(0, start),
      body: content.slice(start + open.length),
    };
  }
  const rest = content.slice(0, start) + content.slice(end + close.length);
  return { rest, body: content.slice(start + open.length, end) };
}

export function parseReply(content: string): Reply {
  const plansBlock = extractBlock(content, "plans");
  const memoriesBlock = extractBlock(plansBlock.rest, "memories");
  const coursesBlock = extractBlock(memoriesBlock.rest, "courses");
  const choicesBlock = extractBlock(coursesBlock.rest, "choices");
  const deadlinesBlock = extractBlock(choicesBlock.rest, "deadlines");
  const text = deadlinesBlock.rest.trim();

  let plans: Plan[] = [];
  if (plansBlock.body) {
    try {
      const raw: unknown = JSON.parse(plansBlock.body);
      if (Array.isArray(raw)) {
        plans = raw
          .slice(0, 3)
          .map(parsePlan)
          .filter((plan): plan is Plan => plan !== null);
      }
    } catch {
      plans = [];
    }
  }

  let memories: { text: string; kind?: "emotion" | "normal" }[] = [];
  if (memoriesBlock.body) {
    try {
      const raw: unknown = JSON.parse(memoriesBlock.body);
      if (Array.isArray(raw)) {
        // 兼容两种形状：纯字符串（老协议）和 {text, kind}（新协议）
      memories = raw
        .map((item) => {
          if (typeof item === "string") return { text: item.trim().slice(0, 60) };
          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            if (typeof record.text !== "string") return null;
            return {
              text: record.text.trim().slice(0, 60),
              kind:
                record.kind === "emotion"
                  ? ("emotion" as const)
                  : ("normal" as const),
            };
          }
          return null;
        })
        .filter(
          (item): item is { text: string; kind?: "emotion" | "normal" } =>
            !!item && !!item.text,
        )
        .slice(0, 3);
      }
    } catch {
      memories = [];
    }
  }

  let courses: ParsedCourse[] = [];
  if (coursesBlock.body) {
    try {
      const raw: unknown = JSON.parse(coursesBlock.body);
      if (Array.isArray(raw)) {
        courses = raw
          .slice(0, 40)
          .map(parseCourseRecord)
          .filter((item): item is ParsedCourse => item !== null);
      }
    } catch {
      courses = [];
    }
  }

  let choices: string[] = [];
  if (choicesBlock.body) {
    try {
      const raw: unknown = JSON.parse(choicesBlock.body);
      if (Array.isArray(raw)) {
        choices = raw
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, 24))
          .filter(Boolean)
          .slice(0, 4);
      }
    } catch {
      choices = [];
    }
  }

  let deadlines: DeadlineProposal[] = [];
  if (deadlinesBlock.body) {
    try {
      const raw: unknown = JSON.parse(deadlinesBlock.body);
      if (Array.isArray(raw)) {
        deadlines = raw
          .slice(0, 5)
          .map(parseDeadlineProposal)
          .filter((item): item is DeadlineProposal => item !== null);
      }
    } catch {
      deadlines = [];
    }
  }

  return { text, plans, memories, courses, choices, deadlines };
}

export function planTasks(
  messageId: string,
  index: number,
  plan: Plan,
  now: Date = new Date(),
): Task[] {
  // 「30 秒后提醒我」这种用日期表达不了，换算成精确时刻存进 dueAt
  const exact =
    plan.remindIn && plan.remindIn > 0
      ? new Date(now.getTime() + plan.remindIn * 1000)
      : null;

  return plan.steps.map((text, step) => ({
    id: `plan-${messageId}-${index}-${step}`,
    text,
    category: plan.title,
    done: false,
    priority: plan.priority ?? "medium",
    deadline: exact ? localDateKey(exact) : plan.deadline,
    time: exact
      ? `${String(exact.getHours()).padStart(2, "0")}:${String(exact.getMinutes()).padStart(2, "0")}`
      : plan.time,
    dueAt: exact ? exact.toISOString() : undefined,
  }));
}

/** 本地时区的 YYYY-MM-DD。用 toISOString 会按 UTC 算，北京时间 0–8 点会差一天。 */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return localDateKey(date);
}

/**
 * 没有 API Key 时的本地兜底：按关键词给出一套能落地的建议，
 * 让用户在配置模型之前也能走完「确认 → 写入」的闭环。
 *
 * 两条自我约束：
 * 1. 不写任何「推断性记忆」——用户没说的事，不能替他记住（那比答错更伤信任）
 * 2. 关键词要具体：「累」「烦」这类单字会误命中「积累」「麻烦」
 */
export function localSuggestions(input: string): Reply {
  const text = input.toLowerCase();
  const has = (...words: string[]) => words.some((word) => text.includes(word));

  if (has("考试", "复习", "期末", "测验", "挂科", "补考")) {
    return {
      text: "考试前慌是正常的。先别想着全复习完，把范围缩小到今天能动手的三件事。",
      plans: [
        {
          title: "今晚 90 分钟复习",
          summary: "先保重点，再补细节",
          steps: [
            "列出这次会考的三类题型",
            "每类挑两道题限时做完",
            "把错的题记进一个错题清单",
          ],
          deadline: isoDate(1),
          priority: "high",
        },
      ],
      memories: [] as { text: string }[],
      courses: [],
      choices: [],
    };
  }

  if (has("实习", "简历", "面试", "求职", "投递")) {
    return {
      text: "先别急着海投。第一份实习更看重讲得清的一段经历，而不是投递数量。",
      plans: [
        {
          title: "本周简历起步",
          summary: "先把一段经历写扎实",
          steps: [
            "选一个最拿得出手的课程项目",
            "按背景-做法-结果写三行",
            "找一个人帮你看一遍",
          ],
          priority: "high",
        },
      ],
      memories: [] as { text: string }[],
      courses: [],
      choices: [],
    };
  }

  if (
    has(
      "好累",
      "很累",
      "太累",
      "累死",
      "好烦",
      "烦死",
      "焦虑",
      "难受",
      "压力",
      "emo",
      "摆烂",
      "不想动",
      "撑不住",
    )
  ) {
    return {
      text: "听起来今天状态不好，这很正常。现在不适合加任务，先把门槛降到最低。",
      plans: [
        {
          title: "15 分钟最小重启",
          summary: "只做一件很小的事",
          steps: ["起身喝水，离开屏幕两分钟", "回来只做一件 5 分钟能完成的事"],
          priority: "low",
        },
      ],
      memories: [] as { text: string }[],
      courses: [],
      choices: [],
    };
  }

  if (has("论文", "作业", "报告", "ddl", "截止")) {
    return {
      text: "有明确截止的事，先把它拆成今天能结束的一段，剩下的明天再说。",
      plans: [
        {
          title: "推进一段就够",
          summary: "今天只求有产出",
          steps: [
            "写下要交付的最小版本",
            "只完成其中一段（约 25 分钟）",
            "把剩下的列成明天的清单",
          ],
          priority: "medium",
        },
      ],
      memories: [] as { text: string }[],
      courses: [],
      choices: [],
    };
  }

  return {
    text: "我还没连上模型，但可以先给你一个通用起步方案。连上 DeepSeek 后我能更具体。",
    plans: [
      {
        title: "把这件事拆小",
        summary: "先动起来，再谈优化",
        steps: [
          "用一句话写下你真正想达成的结果",
          "找出今天能做的最小一步",
          "完成后回来告诉我进展",
        ],
        priority: "medium",
      },
    ],
    memories: [] as { text: string }[],
    courses: [],
    choices: [],
  };
}

/**
 * 解析一条作业/考试提议。
 *
 * 只认显式日期：模型给「下周三」这种相对说法时，解析层没有「今天」的上下文，
 * 硬猜一定会错。宁可丢掉，让正文去问。
 */
function parseDeadlineProposal(value: unknown): DeadlineProposal | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const kind =
    record.kind === "exam" || record.kind === "考试"
      ? "exam"
      : record.kind === "assignment" || record.kind === "作业"
        ? "assignment"
        : null;
  if (!title || !kind) return null;
  const date =
    typeof record.date === "string" ? record.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time =
    typeof record.time === "string" && /^\d{1,2}:\d{2}$/.test(record.time.trim())
      ? record.time.trim().padStart(5, "0")
      : undefined;
  const weightRaw = Number(record.weight);
  const weight =
    kind === "assignment" && Number.isFinite(weightRaw) && weightRaw > 0
      ? Math.min(100, Math.round(weightRaw))
      : undefined;
  return {
    kind,
    title: title.slice(0, 80),
    date,
    ...(time ? { time } : {}),
    ...(typeof record.course === "string" && record.course.trim()
      ? { course: record.course.trim().slice(0, 40) }
      : {}),
    ...(weight !== undefined ? { weight } : {}),
    ...(kind === "exam" &&
    typeof record.scope === "string" &&
    record.scope.trim()
      ? { scope: record.scope.trim().slice(0, 100) }
      : {}),
  };
}

/** 把提议换成精确时刻；作业默认当天 23:59，考试默认 09:00 */
export function proposalDueAt(proposal: DeadlineProposal): string {
  const time =
    proposal.time ?? (proposal.kind === "exam" ? "09:00" : "23:59");
  return new Date(`${proposal.date}T${time}:00`).toISOString();
}