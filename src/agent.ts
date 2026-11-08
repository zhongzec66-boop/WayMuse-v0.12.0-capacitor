import type { Task } from "./types";

export type Plan = { title: string; summary: string; steps: string[] };
export const PLAN_INSTRUCTION = `【简短聊天与方案协议】
无论其他语气设置如何，默认只回复2–4句短句，每段1句，用空行分隔；不写长篇报告，不连续追问。用户要求详细讲解时再展开。
需要制定计划时，先用1–2句回应，然后最多推荐3个可选方案。只建议，不声称已执行。
方案以如下格式放在回复末尾，前端会渲染成卡片，不要在正文重复步骤：
<plans>[{"title":"25分钟起步","summary":"先完成最关键的一小步","steps":["选出一个最不熟悉的知识点","用一道题检验理解"]}]</plans>
每个方案2–4个可执行步骤。标题不超过24字，说明不超过60字，步骤不超过80字。仅在用户有计划需求时输出方案。只有用户点击确认后才会写入计划。已确认计划、完成状态、课程和记忆由上下文提供；不要编造已连接外部应用。`;

export function parseReply(content: string): { text: string; plans: Plan[] } {
  const start = content.indexOf("<plans>");
  if (start < 0)
    return {
      text: content.replace(/<\/?p(?:l(?:a(?:n(?:s)?)?)?)?$/, ""),
      plans: [],
    };
  const text = content.slice(0, start).trim();
  const end = content.indexOf("</plans>", start);
  if (end < 0) return { text, plans: [] };
  try {
    const raw: unknown = JSON.parse(content.slice(start + 7, end));
    if (!Array.isArray(raw)) return { text, plans: [] };
    const plans = raw.slice(0, 3).flatMap((p: unknown): Plan[] => {
      if (!p || typeof p !== "object") return [];
      const v = p as Record<string, unknown>;
      if (
        typeof v.title !== "string" ||
        !v.title.trim() ||
        !Array.isArray(v.steps)
      )
        return [];
      const steps = v.steps
        .filter(
          (s: unknown): s is string => typeof s === "string" && !!s.trim(),
        )
        .slice(0, 4)
        .map((s) => s.trim().slice(0, 80));
      if (!steps.length) return [];
      return [
        {
          title: v.title.trim().slice(0, 24),
          summary: typeof v.summary === "string" ? v.summary.slice(0, 60) : "",
          steps,
        },
      ];
    });
    return { text, plans };
  } catch {
    return { text, plans: [] };
  }
}

export function planTasks(
  messageId: string,
  index: number,
  plan: Plan,
): Task[] {
  return plan.steps.map((text, step) => ({
    id: `plan-${messageId}-${index}-${step}`,
    text,
    category: plan.title,
    done: false,
    priority: "medium",
  }));
}
