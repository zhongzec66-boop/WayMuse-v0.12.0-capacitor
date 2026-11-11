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
  memories: string[];
  /** 从课表文本里整理出的课程，等用户确认后写入 */
  courses: ParsedCourse[];
  /** 可点选的选项：渲染成按钮，点了直接作为回答发出 */
  choices: string[];
};

/**
 * 输出协议：正文之外，允许两个契约块。
 * 前端会把它们从正文里剥掉，渲染成可确认的卡片。
 */
export const PLAN_INSTRUCTION = `【回复协议】
默认只回 2–3 句短话，每段一行，不写长篇报告，不连续追问。

需要制定计划时，先给一句回应，再在回复末尾附上方案块（前端会渲染成卡片，
不要在正文里重复步骤）：

<plans>[{"title":"标题（≤24字）","summary":"一句话说明（≤40字）","steps":["步骤1","步骤2"],"deadline":"YYYY-MM-DD","time":"HH:mm","remindIn":秒数,"priority":"high|medium|low"}]</plans>

- 每个方案 2–4 个步骤，步骤 ≤30 字。
- 标题和步骤都写成「人话」：像同学之间说话，不要书面语。
  例如写「今天最该做的三件事」，不要写「列出现在还欠的三件事」。
  标题不超过 12 字。
- 只有用户提到具体时间（明天考试、周五截止）时才写 deadline，否则省略。
- 用户说了具体钟点（下午三点、21:30）就写 time（24 小时制 HH:mm）。
- 用户说的是相对时间（5 秒后、20 分钟后提醒我）就用 remindIn（整数秒），
  这时不要再猜 deadline，前端会按当前时间换算。这种请求必须给方案卡，
  不要只在正文里答应。
- priority 仅在明显紧急时给 high，其余可省略。
- 步骤的 category（显示成小标签）要短：≤4 字，用「复盘」「今晚」「优先」「睡前」这种，
  不要写「期中后复盘一次」这种长句。

如果对话里出现了值得长期记住的用户事实（专业、目标、偏好、重要日程），
再附一个记忆块（最多 2 条，每条 ≤40 字）：

<memories>["明年暑假想找第一份实习","周三下午在图书馆"]</memories>

只建议，不声称已执行。用户点确认后才会写入计划或记忆。

如果用户发来的是课表文字，并且希望存进课表，就在回复末尾附上课表块
（前端会渲染成「要不要加入课表」的确认卡，你不需要说自己没有工具）：

<courses>[{"name":"高等数学","weekday":1,"start":"08:00","end":"09:40","place":"教三-302","weeks":[1,3,5,7]}]</courses>

- weekday：1-7 表示周一到周日。
- start / end 用 HH:mm；只有节次时按常见作息换算（1-2 节 08:00-09:40，3-4 节 10:00-11:40，5-6 节 14:00-15:40，7-8 节 16:00-17:40，9-10 节 19:00-20:40）。
- weeks 是可选的周次数组；用户没说就不要猜。
- 正文里只说明你整理出了几门课、哪几处不确定，不要列出全部课程。

【什么时候给选项】
当用户需要做选择、或者你在出题（刷题/自测/选择题），不要让他打字，
在正文末尾附一个选项块，前端会渲染成可点的按钮：

<choices>["A. 2_student","B. int","C. _name","D. my-var"]</choices>

- 2–4 个选项，每个 ≤14 字，按 A/B/C/D 或「先做数学」「先背单词」这种顺序写。
- 如果是在做题，正文里只问题目，**不要在正文里重复选项**。
- 只在你确实需要用户选一个的时候给；普通聊天追问不要用。
- 用户点了按钮，就等于把该选项作为回答发给你，所以选项要能独立成立。`;

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
  const text = choicesBlock.rest.trim();

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

  let memories: string[] = [];
  if (memoriesBlock.body) {
    try {
      const raw: unknown = JSON.parse(memoriesBlock.body);
      if (Array.isArray(raw)) {
        memories = raw
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, 60))
          .filter(Boolean)
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

  return { text, plans, memories, courses, choices };
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
      memories: [],
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
      memories: [],
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
      memories: [],
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
      memories: [],
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
    memories: [],
    courses: [],
    choices: [],
  };
}
