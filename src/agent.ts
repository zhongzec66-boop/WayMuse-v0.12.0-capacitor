import type { Course, Task } from "./types";

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

export function demoReply(
  text: string,
  tasks: Task[],
  memories: string[] = [],
  courses: Course[] = [],
): string {
  const open = tasks.filter((t) => !t.done);
  if (/进度|完成了|还有什么|查看计划|我的计划/.test(text))
    return open.length
      ? `目前还有 ${open.length} 项没完成。\n\n先从「${open[0].text}」开始，怎么样？`
      : "现在没有未完成的计划。\n\n想休息一下，还是一起定一个小目标？";
  if (/课程|课表/.test(text) && courses.length)
    return `课表里有「${courses[0].name}」，从 ${courses[0].start} 到 ${courses[0].end}。\n\n想围绕这门课安排一次复习吗？`;
  if (/记得|记忆|资料|健康|睡眠/.test(text) && memories.length) {
    const relevant = /健康|睡眠/.test(text)
      ? memories.find((m) => /健康|睡眠/.test(m))
      : /资料/.test(text)
        ? memories.find((m) => /资料/.test(m))
        : memories[0];
    return relevant
      ? `本机记录里有：${relevant}\n\n你想围绕这个聊聊，还是安排一个小计划？`
      : "本机还没有这类记录。\n\n可以先在设置的 App 连接里添加模拟样例。";
  }
  if (/计划|安排|复习|考试|学习|方案|实习|作业/.test(text)) {
    const goal = /实习/.test(text)
      ? "实习准备"
      : /作业/.test(text)
        ? "完成作业"
        : "复习";
    return `先不用一下子把所有事做完。\n\n${open.length ? `你还有 ${open.length} 项计划没完成，我们先留一点余量。` : "从一小步开始就好。"}\n\n这两个节奏，你更想试哪个？\n<plans>${JSON.stringify(
      [
        {
          title: `轻量${goal} · 25分钟`,
          summary: "适合现在有点累，先找回节奏。",
          steps: [
            `用5分钟列出${goal}最卡住的一个问题`,
            "专注15分钟，完成一道题或一个小步骤",
            "用5分钟记下收获和下一处疑问",
          ],
        },
        {
          title: `专注${goal} · 50分钟`,
          summary: "适合有一点精力，想推进得更完整。",
          steps: [
            "用10分钟梳理重点和薄弱处",
            "专注25分钟处理最重要的一项",
            "休息5分钟，再用10分钟自测或检查",
          ],
        },
      ],
    )}</plans>`;
  }
  if (/计划|任务|完成|进度/.test(text))
    return open.length
      ? `目前还有 ${open.length} 项没完成。\n\n先从「${open[0].text}」开始，怎么样？`
      : "现在没有未完成的计划。\n\n想休息一下，还是一起定一个小目标？";
  return "我在，慢慢说。\n\n你现在更想聊聊，还是想让我陪你把一件事理清楚？";
}
