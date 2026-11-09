import { CalendarClock, ChevronRight, Clock3, ListTodo } from "lucide-react";
import type { Course, Task } from "./types";

/**
 * 今日简报。
 *
 * 只用本机已有的数据（课表、任务），不联网、不调模型：
 * 打开 App 的第一眼应该知道「现在该干什么」，而不是面对一片空白。
 * 没有数据时就直说没有，不编造「今天会是美好的一天」这种话。
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

export default function BriefCard({
  todayCourses,
  tasks,
  nowMinutes,
  todayKey,
}: {
  todayCourses: Course[];
  tasks: Task[];
  nowMinutes: number;
  todayKey: string;
}) {
  const current = todayCourses.find(
    (course) =>
      toMinutes(course.start) <= nowMinutes && toMinutes(course.end) > nowMinutes,
  );
  const next = todayCourses.find((course) => toMinutes(course.start) > nowMinutes);

  const open = tasks.filter((task) => !task.done);
  const overdue = open
    .filter((task) => task.deadline && task.deadline < todayKey)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const scheduled = open
    .filter((task) => task.deadline && task.deadline >= todayKey)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const top =
    overdue[0] ??
    scheduled[0] ??
    open.find((task) => task.priority === "high") ??
    open[0];

  const freeAfternoon =
    todayCourses.length <= 1 && todayCourses.every((c) => toMinutes(c.end) < 12 * 60);

  return (
    <section className="wr-brief" aria-label="今日简报">
      <header>
        <span>今日简报</span>
        <em>{todayCourses.length > 0 ? `${todayCourses.length} 节课` : "没课"}</em>
      </header>

      <ul>
        {current ? (
          <li>
            <Clock3 size={16} />
            <span>
              正在上 <b>{current.name}</b>，到 {current.end} 下课
              {current.place ? `（${current.place}）` : ""}
            </span>
          </li>
        ) : next ? (
          <li>
            <Clock3 size={16} />
            <span>
              下一节 {next.start} <b>{next.name}</b>
              {next.place ? ` · ${next.place}` : ""}
            </span>
          </li>
        ) : (
          <li>
            <CalendarClock size={16} />
            <span>今天没有课了</span>
          </li>
        )}

        {top ? (
          <li>
            <ListTodo size={16} />
            <span>
              最紧的是 <b>{top.text}</b>
              {top.deadline ? ` · ${relative(top.deadline, todayKey)}` : ""}
              {open.length > 1 ? `，另外还有 ${open.length - 1} 件` : ""}
            </span>
          </li>
        ) : (
          <li>
            <ListTodo size={16} />
            <span>没有待办，可以休息</span>
          </li>
        )}

        {freeAfternoon && (
          <li>
            <ChevronRight size={16} />
            <span>下午整段空着，适合推进那件一直拖着的事</span>
          </li>
        )}
      </ul>
    </section>
  );
}
