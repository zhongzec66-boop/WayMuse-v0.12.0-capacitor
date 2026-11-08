import { ChevronRight, Clock3, Plus, SlidersHorizontal } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { BRAND } from "../brand";
import type { Course, Kind, Memory, Overlay, Page, Task } from "../types";

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

export default function TodayPage({
  profileName,
  date,
  memories,
  tasks,
  todayCourses,
  setCourses,
  courses,
  setOverlay,
  openIntake,
  nav,
}: {
  profileName: string;
  date: string;
  memories: Memory[];
  tasks: Task[];
  todayCourses: Course[];
  courses: Course[];
  setCourses: Dispatch<SetStateAction<Course[]>>;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
  openIntake: (kind: Kind) => void;
  nav: (page: Page) => void;
}) {
  const { ymd: todayKey, minutes: now, clock } = shanghaiParts();

  const active = tasks.filter((t) => !t.done);
  const dueTasks = active
    .filter((t) => t.deadline && t.deadline <= todayKey)
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));

  const finished = todayCourses.filter((c) => toMinutes(c.end) < now);
  const upcoming = todayCourses.filter((c) => toMinutes(c.end) >= now);
  const focus = upcoming[0];
  const focusLive = focus ? toMinutes(focus.start) <= now : false;

  const weekTotal = tasks.filter((t) => t.deadline).length;
  const weekDone = tasks.filter((t) => t.deadline && t.done).length;
  const percent = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;

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
        {greeting(now)}，{profileName} · {date}
      </p>

      {/* ── 今天进行中 ─────────────────────────────── */}
      <section className="wr-tcard" aria-label="今天进行中">
        <header className="wr-tcard-head">
          <span>
            <Clock3 size={15} /> 今天进行中
          </span>
          <em>更新于 {clock}</em>
        </header>

        {focus ? (
          <div className="wr-focus">
            <div className="wr-focus-top">
              <b>{focus.name}</b>
              <span
                className={
                  focusLive
                    ? "wr-state wr-state-live"
                    : "wr-state wr-state-soon"
                }
              >
                {focusLive ? "进行中" : "即将开始"}
              </span>
            </div>
            <p className="wr-focus-time">
              {focus.start} – {focus.end}
              {focus.place && <span>· {focus.place}</span>}
            </p>
            <button className="wr-focus-action" onClick={() => nav("聊天")}>
              和 {BRAND} 聊聊
            </button>
          </div>
        ) : (
          <p className="wr-tcard-empty">
            {todayCourses.length
              ? "今天的课都结束了，剩下时间归你安排。"
              : "今天没有课。"}
          </p>
        )}

        {finished.length > 0 && (
          <>
            <div className="wr-tcard-divider">已结束</div>
            {finished.map((c) => (
              <div className="wr-ended" key={c.id}>
                <span className="wr-ended-bar" aria-hidden="true" />
                <span className="wr-ended-main">
                  <b>{c.name}</b>
                  <small>
                    {c.start} – {c.end}
                    {c.place ? ` · ${c.place}` : ""}
                  </small>
                </span>
                <button
                  aria-label={`删除课程 ${c.name}`}
                  onClick={() =>
                    setCourses(courses.filter((x) => x.id !== c.id))
                  }
                >
                  移除
                </button>
              </div>
            ))}
          </>
        )}

        {todayCourses.length === 0 && (
          <button className="wr-tcard-cta" onClick={() => openIntake("课表")}>
            添加课表，我就能把一天的节奏排出来
            <ChevronRight size={15} />
          </button>
        )}
      </section>

      {/* ── 今天到期 ───────────────────────────────── */}
      <section className="wr-tcard" aria-label="今天到期">
        <header className="wr-tcard-head">
          <span>今天到期</span>
          <em>{dueTasks.length} 项</em>
        </header>

        {dueTasks.length === 0 ? (
          <p className="wr-tcard-empty">现在没有到期的任务。</p>
        ) : (
          <ul className="wr-due-list">
            {dueTasks.slice(0, 5).map((t) => (
              <li key={t.id}>
                <span className="wr-due-time">{t.time ?? "—"}</span>
                <span className="wr-due-main">
                  <b>{t.text}</b>
                  <small>
                    {t.deadline && t.deadline < todayKey
                      ? `已逾期 · ${t.deadline}`
                      : (t.category ?? "今天")}
                  </small>
                </span>
                <button aria-label="去计划页" onClick={() => nav("任务")}>
                  <ChevronRight size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button className="wr-tcard-link" onClick={() => nav("任务")}>
          查看全部计划 <ChevronRight size={14} />
        </button>
      </section>

      {/* ── 本周 ───────────────────────────────────── */}
      <section className="wr-tcard" aria-label="本周进度">
        <header className="wr-tcard-head">
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
        <p className="wr-tcard-empty">
          {weekTotal
            ? percent === 100
              ? "本周的都完成了。"
              : `还剩 ${weekTotal - weekDone} 项带日期的任务。`
            : "还没有带日期的任务。"}
        </p>
      </section>

      {/* ── 我记得 ─────────────────────────────────── */}
      <section className="wr-tcard" aria-label="我记得">
        <header className="wr-tcard-head">
          <span>我记得</span>
          <button className="wr-tcard-edit" onClick={() => nav("记忆")}>
            管理
          </button>
        </header>
        {memories.length === 0 ? (
          <p className="wr-tcard-empty">还没有记住任何事。聊天时我会先问你。</p>
        ) : (
          <div className="wr-memory-chips">
            {memories.slice(0, 3).map((m) => (
              <span key={m.id}>{m.text}</span>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
