import type { UserProfile } from "./profile";
import type { Course, Memory, Task } from "./types";
import { docDefault, readDoc } from "./docs";
import { academicWeek, isCourseInWeek, readTermStart } from "./term";
import { insightsPromptLine } from "./nativeInsights";

/**
 * 把本机数据整理成「提示词变量」交给服务端。
 *
 * 提示词模板（人格、回复协议、四段技能）现在只在服务端，
 * 客户端只负责把**用户的数据**整理好发过去。
 *
 * 为什么这么切：模板是产品里最值钱也最容易被抄走的部分，
 * 数据是按用户变化的、必须由客户端提供。两者混在一起就只能整包泄露。
 */

export type PromptVariables = {
  today: string;
  companion: string;
  identity: string;
  soul: string;
  memory: string;
  profile: string;
  memories: string[];
  courses: string[];
  tasks: string[];
  insights: string;
  web: string;
};

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * 今天的日期与时间。
 *
 * 没有这一段时，模型在输出 `deadline: YYYY-MM-DD` 时只能凭训练数据里的日期瞎编，
 * 「明天」「下周三」也全都会算错。
 */
function todayLine(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hh = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const weekdayIndex = new Date(
    Date.UTC(
      Number(pick("year")),
      Number(pick("month")) - 1,
      Number(pick("day")),
    ),
  ).getUTCDay();
  return `【现在】${pick("year")}-${pick("month")}-${pick("day")} ${weekdays[weekdayIndex]} ${hh}（Asia/Shanghai）。用户说「今天/明天/下周」时按这个时间推算；需要输出日期时用 YYYY-MM-DD，且不能早于今天。`;
}

function courseLine(course: Course): string {
  const place = course.place ? ` @${course.place}` : "";
  const weeks =
    course.weeks && course.weeks.length
      ? `（第 ${course.weeks.join(",")} 周）`
      : "";
  return `${weekdays[course.weekday] ?? "未知"} ${course.start}-${course.end} ${course.name}${place}${weeks}`;
}

function companionInstruction(profile: UserProfile): string {
  const type =
    profile.companionType === "朋友"
      ? "平等、自然的朋友，可以开玩笑，但不说教。"
      : profile.companionType === "导师"
        ? "结构化、直接、以目标和行动为主的导师，必要时指出问题。"
        : "按你自定义的语气和长度来陪伴。";

  const length =
    profile.responseLength === "短"
      ? "优先 3–5 句或一个短清单，能一句说清就不展开。"
      : profile.responseLength === "长"
        ? "可以分节展开，给出步骤、例子和依据；不要为了凑长度重复。"
        : "默认 1–3 段，先结论后理由，必要时用列表。";

  return [
    `用户希望被称呼为「${profile.callName.trim() || "同学"}」。`,
    `请以「${profile.companionType}」的方式陪伴：${type}`,
    `语气：${profile.tone}。回复长度：${profile.responseLength}。${length}`,
    `表达温度：${profile.temperature.toFixed(1)}（0 更克制，2 更发散）。`,
    ...(profile.persona.trim()
      ? [`用户自定义的人格偏好：${profile.persona.trim()}`]
      : []),
  ].join("\n");
}

function profileSection(profile: UserProfile): string {
  const lines = ["【用户档案（用户在本机填写）】"];
  if (profile.identity.trim()) lines.push(`身份：${profile.identity.trim()}`);
  if (profile.school.trim()) lines.push(`学校：${profile.school.trim()}`);
  if (profile.schoolLevel.trim())
    lines.push(`院校层次：${profile.schoolLevel.trim()}`);
  if (profile.major.trim()) lines.push(`专业：${profile.major.trim()}`);
  if (profile.grade.trim()) lines.push(`年级：${profile.grade.trim()}`);
  if (profile.city.trim()) lines.push(`所在城市：${profile.city.trim()}`);
  if (profile.direction.trim())
    lines.push(`目标方向：${profile.direction.trim()}`);
  if (profile.interest.trim())
    lines.push(`兴趣方向：${profile.interest.trim()}`);
  if (profile.courses.trim()) lines.push(`主要课程：${profile.courses.trim()}`);
  return lines.join("\n");
}

export type AssistantContext = {
  memories: Memory[];
  courses: Course[];
  tasks: Task[];
};

export function buildPromptVariables(options: {
  useContext: boolean;
  profile: UserProfile;
  context: AssistantContext;
  webContext?: string;
}): PromptVariables {
  const { useContext, profile, context, webContext = "" } = options;

  const identity = readDoc("identity").trim();
  const soul = readDoc("soul").trim();
  const memoryDocRaw = readDoc("memory").trim();
  // MEMORY.md 的默认内容本来就是从结构化记忆生成的，
  // 两份同时注入会重复；只有用户真正改过它时才以文件为准。
  const memoryDoc =
    memoryDocRaw && memoryDocRaw !== docDefault("memory").trim()
      ? memoryDocRaw
      : "";

  const variables: PromptVariables = {
    today: todayLine(),
    companion: companionInstruction(profile),
    identity,
    soul,
    memory: memoryDoc,
    profile: "",
    memories: [],
    courses: [],
    tasks: [],
    // 本机读到的状态（屏幕时间/步数），没有授权时返回空串
    insights: insightsPromptLine(),
    web: webContext,
  };

  if (!useContext) return variables;

  const termWeek = academicWeek(readTermStart());
  const memories = context.memories
    .slice()
    .sort((a, b) => b.weight - a.weight || b.createdAt - a.createdAt)
    .slice(0, 12);
  // 只把「这一周真的要上」的课给模型：单双周 / 前八周的课不该被当成今天有课
  const courses = context.courses
    .filter((course) => isCourseInWeek(course, termWeek))
    .slice(0, 24);
  const tasks = context.tasks.slice(0, 20);

  variables.profile = [
    profileSection(profile),
    `【教学周】第 ${termWeek} 周（开学 ${readTermStart()}）`,
  ].join("\n");
  variables.memories = memories.map((memory) =>
    memory.weight === 3 ? `${memory.text}（重要）` : memory.text,
  );
  variables.courses = courses.map(courseLine);
  variables.tasks = tasks.map(
    (task) =>
      `${task.done ? "已完成" : "未完成"} ${task.category ? `[${task.category}] ` : ""}${task.text}`,
  );

  return variables;
}
