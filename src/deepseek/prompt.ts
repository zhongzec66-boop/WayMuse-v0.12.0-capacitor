import { PLAN_INSTRUCTION } from "../agent";
import { BRAND } from "../brand";
import type { UserProfile } from "../profile";
import type { Course, Memory, Task } from "../types";
import { docDefault, readDoc } from "../docs";
import { academicWeek, isCourseInWeek, readTermStart } from "../term";
import { skillsPrompt } from "../skills";
import { insightsPromptLine } from "../nativeInsights";

export const DEFAULT_SYSTEM_PROMPT = `你是 ${BRAND}，一个陪伴大学生、辅助学习的 AI Agent。以自然的聊天陪伴用户，先理解用户当下的感受和问题，再决定是否需要建议；闲聊不强行转成任务。学习时通过解释、例子和适量追问帮助用户理解，必要时一起拆解下一步。用简体中文回答。不要编造用户没有提供的经历；不确定时直接说明。回答保持具体、简短，必要时用列表。

【关于看图】用户发来图片时，图片内容会直接提供给你（题目截图、笔记、图表、照片都能看）。不要说「我看不到图片」或「请描述图片内容」，直接基于图片回答。只有图片确实没有传过来时，才说明没收到。`;

export type AssistantContext = {
  memories: Memory[];
  courses: Course[];
  tasks: Task[];
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
  // 星期按上海时区重新取，避免跨时区时和日期不匹配
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
  // 带上周次，模型才不会把「单双周」的课当成每周都有
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
    "【陪伴方式】",
    `用户希望被称呼为「${profile.callName.trim() || "同学"}」。`,
    `请以「${profile.companionType}」的方式陪伴：${type}`,
    `语气：${profile.tone}。回复长度：${profile.responseLength}。${length}`,
    `表达温度：${profile.temperature.toFixed(1)}（0 更克制，2 更发散）。`,
    ...(profile.persona.trim()
      ? [`用户自定义的人格偏好：${profile.persona.trim()}`]
      : []),
    "你是 AI 助理，不是真人：不要声称自己有真实身体、真实感情或线下生活；不要制造依赖；亲密表达保持克制，不涉及性内容。遇到心理、医疗、法律等高风险问题，建议用户寻求专业帮助。",
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

export function buildSystemPrompt(
  config: { useContext: boolean },
  profile: UserProfile,
  context: AssistantContext,
  webContext = "",
  userMessage = "",
): string {
  // 三份可编辑文件优先：它们就是用户认可的人格与记忆
  const identity = readDoc("identity").trim();
  const soul = readDoc("soul").trim();
  const memoryDocRaw = readDoc("memory").trim();
  // MEMORY.md 的默认内容本来就是从结构化记忆生成的，
  // 两份同时注入会重复；只有用户真正改过它时才以文件为准。
  const memoryDoc =
    memoryDocRaw && memoryDocRaw !== docDefault("memory").trim()
      ? memoryDocRaw
      : "";

  const sections = [
    DEFAULT_SYSTEM_PROMPT,
    "",
    todayLine(),
    companionInstruction(profile),
    identity ? `【IDENTITY.md】\n${identity}` : "",
    soul ? `【SOUL.md】\n${soul}` : "",
    memoryDoc ? `【MEMORY.md】\n${memoryDoc}` : "",
    // 技能按需加载：命中才把正文塞进来，没命中就只花几十 token
    skillsPrompt(userMessage),
    // 本机读到的状态（屏幕时间/步数），没有授权时返回空串
    insightsPromptLine(),
    PLAN_INSTRUCTION,
  ].filter(Boolean);
  if (!config.useContext) {
    if (webContext) sections.push("", webContext);
    return sections.join("\n");
  }

  // 先按权重排序再截断：否则权重高但排在后面的记忆会被丢掉
  const memories = context.memories
    .slice()
    .sort((a, b) => b.weight - a.weight || b.createdAt - a.createdAt)
    .slice(0, 12);
  const termWeek = academicWeek(readTermStart());
  // 只把「这一周真的要上」的课给模型：单双周 / 前八周的课不该被当成今天有课
  const courses = context.courses
    .filter((course) => isCourseInWeek(course, termWeek))
    .slice(0, 24);
  const tasks = context.tasks.slice(0, 20);
  const lines = [
    "",
    profileSection(profile),
    `【教学周】第 ${termWeek} 周（开学 ${readTermStart()}）`,
  ];

  if (memories.length) {
    // 重要的记忆排前面并标出来，让模型知道哪些是「这个人的底色」。
    const ordered = memories
      .slice()
      .sort((a, b) => b.weight - a.weight || b.createdAt - a.createdAt);
    lines.push(
      `【记忆】${ordered
        .map((m) => (m.weight === 3 ? `${m.text}（重要）` : m.text))
        .join("；")}`,
    );
  }
  if (courses.length) {
    lines.push("【课程】");
    courses.forEach((course) => lines.push(`- ${courseLine(course)}`));
  }
  if (tasks.length) {
    lines.push(
      `【任务】${tasks.map((task) => `${task.done ? "已完成" : "未完成"} ${task.category ? `[${task.category}] ` : ""}${task.text}`).join("；")}`,
    );
  }

  lines.push(
    "这些数据来自本机记录，不是完整用户档案。回答时不要假装知道未列出的信息，也不要声称已经连接学校系统。",
  );
  sections.push(lines.join("\n"));
  if (webContext) sections.push("", webContext);
  return sections.join("\n");
}
