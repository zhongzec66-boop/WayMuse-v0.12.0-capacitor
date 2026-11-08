import { PLAN_INSTRUCTION } from "../agent";
import { BRAND } from "../brand";
import type { UserProfile } from "../profile";
import type { Course, Task } from "../types";

export const DEFAULT_SYSTEM_PROMPT = `你是 ${BRAND}，一个陪伴大学生、辅助学习的 AI Agent。以自然的聊天陪伴用户，先理解用户当下的感受和问题，再决定是否需要建议；闲聊不强行转成任务。学习时通过解释、例子和适量追问帮助用户理解，必要时一起拆解下一步。用简体中文回答。不要编造用户没有提供的经历；不确定时直接说明。回答保持具体、简短，必要时用列表。`;

export type AssistantContext = {
  memories: string[];
  courses: Course[];
  tasks: Task[];
};

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function courseLine(course: Course): string {
  const place = course.place ? ` @${course.place}` : "";
  return `${weekdays[course.weekday] ?? "未知"} ${course.start}-${course.end} ${course.name}${place}`;
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
    "你是 AI 助理，不是真人：不要声称自己有真实身体、真实感情或线下生活；不要制造依赖；亲密表达保持克制，不涉及性内容。遇到心理、医疗、法律等高风险问题，建议用户寻求专业帮助。",
  ].join("\n");
}

function profileSection(profile: UserProfile): string {
  const lines = ["【用户档案（用户在本机填写）】"];
  if (profile.school.trim()) lines.push(`学校：${profile.school.trim()}`);
  if (profile.major.trim()) lines.push(`专业：${profile.major.trim()}`);
  if (profile.grade.trim()) lines.push(`年级：${profile.grade.trim()}`);
  if (profile.courses.trim()) lines.push(`主要课程：${profile.courses.trim()}`);
  return lines.join("\n");
}

export function buildSystemPrompt(
  config: { useContext: boolean; systemPrompt: string },
  profile: UserProfile,
  context: AssistantContext,
): string {
  const base = config.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
  const sections = [base, "", companionInstruction(profile), PLAN_INSTRUCTION];
  if (!config.useContext) return sections.join("\n");

  const memories = context.memories.slice(0, 12);
  const courses = context.courses.slice(0, 24);
  const tasks = context.tasks.slice(0, 20);
  const lines = ["", profileSection(profile)];

  if (memories.length) {
    lines.push(`【记忆】${memories.join("；")}`);
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
    "这些数据来自本地演示，不是完整用户档案。回答时不要假装知道未列出的信息，也不要声称已经连接学校系统。",
  );
  sections.push(lines.join("\n"));
  return sections.join("\n");
}
