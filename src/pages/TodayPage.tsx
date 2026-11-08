import { CalendarPlus, Plus, SlidersHorizontal } from "lucide-react";
import { addEventToCalendar, haptic } from "../nativeExtras";
import type { CalendarEvent } from "../nativeExtras";
import type { Dispatch, SetStateAction } from "react";
import type { Course, Kind, Overlay, Page, Task } from "../types";

/** 全站统一 Asia/Shanghai。 */
function shanghaiParts() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date())) map[p.type] = p.value;
  return {
    ymd: `${map.year}-${map.month}-${map.day}`,
    minutes: (Number(map.hour) % 24) * 60 + Number(map.minute),
    clock: `${map.hour}:${map.minute}`,
  };
}

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function greeting(minutes: number): string {
  if (minutes < 6 * 60) return "凌晨好";
  if (minutes < 11 * 60) return "早上好";
  if (minutes < 13 * 60) return "中午好";
  if (minutes < 18 * 60) return "下午好";
  return "晚上好";
}

/** 一年中的第几周，用来给「第 N 周」一个真实的数字。 */
function weekOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor(
    (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.ceil((days + start.getDay() + 1) / 7);
}

type EntryState = "done" | "live" | "next" | "due" | "overdue";

type Entry = {
  key: string;
  minutes: number;
  clock: string;
  title: string;
  meta: string;
  state: EntryState;
  kind: "course" | "task" | "calendar";
  courseId?: string;
  taskId?: string;
};

const STATE_LABEL: Record<EntryState, string> = {
  done: "已结束",
  live: "进行中",
  next: "待开始",
  due: "今天到期",
  overdue: "逾期",
};

export default function TodayPage({
  profileName,
  date,
  tasks,
  todayCourses,
  calendarEvents,
  courses,
  setCourses,
  setOverlay,
  openIntake,
  nav,
}: {
  profileName: string;
  date: string;
  tasks: Task[];
  todayCourses: Course[];
  calendarEvents: CalendarEvent[];
  courses: Course[];
  setCourses: Dispatch<SetStateAction<Course[]>>;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
  openIntake: (kind: Kind) => void;
  nav: (page: Page) => void;
}) {
  const { ymd: todayKey, minutes: now, clock } = shanghaiParts();

  const active = tasks.filter((t) => !t.done);
  const dueTasks = active.filter((t) => t.deadline && t.deadline <= todayKey);

  const entries: Entry[] = [
    ...todayCourses.map<Entry>((c) => {
      const start = toMinutes(c.start);
      const end = toMinutes(c.end);
      return {
        key: `c-${c.id}`,
        minutes: start,
        clock: c.start,
        title: c.name,
        meta: [c.start + "–" + c.end, c.place].filter(Boolean).join(" · "),
        state: end < now ? "done" : start <= now ? "live" : "next",
        kind: "course",
        courseId: c.id,
      };
    }),
    ...calendarEvents.map<Entry>((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const minutes = start.getHours() * 60 + start.getMinutes();
      const clock = `${String(start.getHours()).padStart(2, "0")}:${String(
        start.getMinutes(),
      ).padStart(2, "0")}`;
      const endClock = `${String(end.getHours()).padStart(2, "0")}:${String(
        end.getMinutes(),
      ).padStart(2, "0")}`;
      return {
        key: `cal-${event.id}`,
        minutes,
        clock,
        title: event.title,
        meta: [clock + "–" + endClock, event.location, event.calendar]
          .filter(Boolean)
          .join(" · "),
        state:
          end.getTime() < Date.now()
            ? "done"
            : start.getTime() <= Date.now()
              ? "live"
              : "next",
        kind: "calendar" as const,
      };
    }),
    ...dueTasks.map<Entry>((t) => ({
      key: `t-${t.id}`,
      minutes: t.time ? toMinutes(t.time) : 23 * 60 + 59,
      clock: t.time ?? "23:59",
      title: t.text,
      meta:
        t.deadline && t.deadline < todayKey
          ? `应完成于 ${t.deadline}`
          : (t.category ?? "今天到期"),
      state: t.deadline && t.deadline < todayKey ? "overdue" : "due",
      kind: "task",
      taskId: t.id,
    })),
  ].sort((a, b) => a.minutes - b.minutes);

  const weekTotal = tasks.filter((t) => t.deadline).length;
  const weekDone = tasks.filter((t) => t.deadline && t.done).length;
  const percent = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;

  // 只把「还没开始的课」算成接下来；已过点但没做的事不算
  const nextEntry = entries.find((e) => e.state === "next");

  return (
    <>
      <div className="wr-head">
        <h1>今天</h1>
        <div className="wr-head-actions">
          <button
            className="wr-round"
            aria-label="设置"
            onClick={() => setOverlay("设置")}
          >
            <SlidersHorizontal />
          </button>
          <button
            className="wr-round wr-round-solid"
            aria-label="新增任务"
            onClick={() => setOverlay("新增任务")}
          >
            <Plus />
          </button>
        </div>
      </div>

      <p className="wr-today-sub">
        {greeting(now)}，{profileName} · {date} · 第 {weekOfYear()} 周
      </p>

      {/* ── 今天的时间轴 ───────────────────────────── */}
      <section className="wr-dayline" aria-label="今天的时间轴">
        <header className="wr-dayline-head">
          <span>时间轴</span>
          <em>
            现在 {clock}
            {nextEntry ? ` · 接下来 ${nextEntry.clock}` : ""}
          </em>
        </header>

        {entries.length === 0 ? (
          <p className="wr-dayline-empty">
            今天没有课，也没有到期的事。要不要说说你现在想做什么？
          </p>
        ) : (
          <ol className="wr-timeline">
            {entries.map((e) => (
              <li key={e.key} data-state={e.state} data-kind={e.kind}>
                <span className="wr-timeline-time">{e.clock}</span>
                <span className="wr-timeline-dot" aria-hidden="true" />
                <span className="wr-timeline-body">
                  <b>{e.title}</b>
                  {e.meta && <small>{e.meta}</small>}
                </span>
                <span className="wr-timeline-state">
                  {STATE_LABEL[e.state]}
                </span>
                {e.kind === "task" && e.taskId && (
                  <button
                    className="wr-timeline-act"
                    aria-label={`把「${e.title}」加到系统日历`}
                    onClick={() => {
                      const task = tasks.find((x) => x.id === e.taskId);
                      if (!task) return;
                      const day = task.deadline ?? todayKey;
                      const time = task.time ?? "09:00";
                      const start = new Date(`${day}T${time}:00`).toISOString();
                      void addEventToCalendar({
                        title: task.text,
                        start,
                        notes: task.category,
                      }).then((ok) => haptic(ok ? "light" : "heavy"));
                    }}
                  >
                    <CalendarPlus size={13} />
                  </button>
                )}
                {e.kind === "course" && e.courseId && (
                  <button
                    className="wr-timeline-x"
                    aria-label={`移除课程 ${e.title}`}
                    onClick={() =>
                      setCourses(courses.filter((c) => c.id !== e.courseId))
                    }
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}

        {todayCourses.length === 0 && (
          <button className="wr-dayline-cta" onClick={() => openIntake("课表")}>
            还没有课表，加一份我就能把一天的节奏排出来
          </button>
        )}
      </section>

      {/* ── 本周 ───────────────────────────────────── */}
      <section className="wr-weekline" aria-label="本周进度">
        <header>
          <span>本周</span>
          <em>
            {weekDone}/{weekTotal}
          </em>
        </header>
        <div
          className="wr-progress-track"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <button className="wr-weekline-link" onClick={() => nav("任务")}>
          看全部计划
        </button>
      </section>
    </>
  );
}
