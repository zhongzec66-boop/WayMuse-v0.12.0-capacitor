import {
  AlarmClock,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock3,
  ListTodo,
  Sparkles,
} from "lucide-react";
import type { Course, Task } from "./types";

/**
 * 今日简报卡。
 *
 * 参考「状态卡」的写法：先给分类和状态（观察/跟踪/今天到期），
 * 再给结论，最后给一个具体动作 —— 而不是一堆没有主次的条目。
 *
 * 只用本机数据（课表、任务），不联网、不调模型：
 * 打开 App 第一眼要能回答「现在该干什么」。
 */

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function relative(deadline: string, todayKey: string): string {
  const today = new Date(`${todayKey}T00:00:00`);
  const target = new Date(`${deadline}T00:00:00`);
  const days = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  if (days === 1) return "明天到期";
  if (days <= 7) return `${days} 天后`;
  return `${deadline.slice(5)} 到期`;
}

type Step = {
  text: string;
  meta?: string;
  state: "done" | "live" | "next";
};

export default function BriefCard({
  todayCourses,
  tasks,
  nowMinutes,
  todayKey,
  onOpenTasks,
  onOpenTimeline,
}: {
  todayCourses: Course[];
  tasks: Task[];
  nowMinutes: number;
  todayKey: string;
  onOpenTasks: () => void;
  onOpenTimeline: () => void;
}) {
  const current = todayCourses.find(
    (course) =>
      toMinutes(course.start) <= nowMinutes &&
      toMinutes(course.end) > nowMinutes,
  );
  const next = todayCourses.find(
    (course) => toMinutes(course.start) > nowMinutes,
  );

  const open = tasks.filter((task) => !task.done);
  const overdue = open
    .filter((task) => task.deadline && task.deadline < todayKey)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const scheduled = open
    .filter((task) => task.deadline && task.deadline >= todayKey)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const top = overdue[0] ?? scheduled[0] ?? open[0];

  let chip = { icon: Sparkles, label: "今天 · 空档" };
  let title = "今天没有硬安排";
  let lead = "没有课，也没有到期的事。适合推进那件一直拖着的事。";
  let steps: Step[] = [];
  let cta = { label: "看看任务", action: onOpenTasks };

  if (current) {
    chip = { icon: AlarmClock, label: "上课中 · 现在" };
    title = current.name;
    lead = `到 ${current.end} 下课${current.place ? ` · ${current.place}` : ""}`;
    steps = [
      {
        text: "正在上课",
        meta: `${current.start}–${current.end}`,
        state: "live",
      },
      ...(next
        ? [
            {
              text: next.name,
              meta: `下一节 ${next.start}${next.place ? ` · ${next.place}` : ""}`,
              state: "next" as const,
            },
          ]
        : []),
    ];
    cta = { label: "看今天的时间轴", action: onOpenTimeline };
  } else if (next) {
    const minutes = toMinutes(next.start) - nowMinutes;
    chip = { icon: Clock3, label: `接下来 · ${next.start}` };
    title = next.name;
    lead = `${minutes} 分钟后开始${next.place ? ` · ${next.place}` : ""}`;
    steps = [
      { text: "还没到时间", meta: `${next.start}–${next.end}`, state: "next" },
      ...(top
        ? [
            {
              text: top.text,
              meta: top.deadline
                ? relative(top.deadline, todayKey)
                : "未设截止",
              state: "next" as const,
            },
          ]
        : []),
    ];
    cta = { label: "看今天的时间轴", action: onOpenTimeline };
  } else if (top) {
    chip = {
      icon: ListTodo,
      label: `最高优先级 · ${top.deadline ? relative(top.deadline, todayKey) : "这周内"}`,
    };
    title = top.text;
    lead =
      open.length > 1
        ? `还剩 ${open.length - 1} 个任务，咱们先专注搞定这件。`
        : "只剩这一件，做完就清空。";
    steps = [
      { text: top.text, meta: "最优先", state: "live" },
      ...open
        .filter((task) => task.id !== top.id)
        .slice(0, 2)
        .map<Step>((task) => ({
          text: task.text,
          meta: task.deadline ? relative(task.deadline, todayKey) : "未设截止",
          state: "next",
        })),
    ];
    cta = { label: "去任务页", action: onOpenTasks };
  }

  return (
    <section className="wr-brief" aria-label="今日简报">
      <header className="wr-brief-chip">
        <chip.icon size={15} />
        <span>{chip.label}</span>
      </header>

      <h3 className="wr-brief-title">{title}</h3>
      <p className="wr-brief-lead">{lead}</p>

      {steps.length > 0 && (
        <ol className="wr-brief-steps">
          {steps.map((step, index) => (
            <li key={`${step.text}-${index}`} data-state={step.state}>
              {step.state === "done" ? (
                <CircleCheck size={15} />
              ) : (
                <Circle size={15} />
              )}
              <span className="wr-brief-step-text">{step.text}</span>
              {step.meta && <em>{step.meta}</em>}
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="wr-brief-cta" onClick={cta.action}>
        {cta.label}
        <ChevronRight size={16} />
      </button>
    </section>
  );
}
