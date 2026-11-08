import {
  AlertTriangle,
  Check,
  Clock3,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Course, Overlay, Task } from "../types";

export type TaskMode = "任务" | "课表";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** 课程 weekday 用 0=周日 … 6=周六（与 storage.sanitizeCourse 一致），
 *  界面按「周一开头」排列。 */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** 全站统一 Asia/Shanghai，避免跨时区/跨午夜时日期不一致。 */
function todayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** 0 = 周一 … 6 = 周日 */
function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function formatDay(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}月${d}日`;
}

function priorityLabel(p: NonNullable<Task["priority"]>): string {
  return p === "high" ? "高" : p === "medium" ? "中" : "低";
}

export default function TaskPage({
  taskMode,
  setTaskMode,
  tasks,
  setTasks,
  courses,
  setOverlay,
}: {
  taskMode: TaskMode;
  setTaskMode: Dispatch<SetStateAction<TaskMode>>;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  courses: Course[];
  setOverlay: Dispatch<SetStateAction<Overlay>>;
}) {
  const today = todayYmd();
  const weekStart = shiftYmd(today, -weekdayIndex(today));
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftYmd(weekStart, i));

  const activeTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  const weekTasks = tasks.filter(
    (t) => t.deadline && t.deadline >= weekStart && t.deadline <= weekDates[6],
  );
  const weekDone = weekTasks.filter((t) => t.done).length;
  const weekPercent = weekTasks.length
    ? Math.round((weekDone / weekTasks.length) * 100)
    : 0;

  const overdue = activeTasks.filter((t) => t.deadline && t.deadline < today);
  const dueToday = activeTasks.filter((t) => t.deadline === today);
  const later = activeTasks.filter((t) => t.deadline && t.deadline > today);
  const undated = activeTasks.filter((t) => !t.deadline);

  const toggle = (id: string) =>
    setTasks(
      tasks.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    );
  const remove = (id: string) =>
    setTasks(tasks.filter((item) => item.id !== id));

  const courseDays = WEEK_ORDER.map((weekday, i) => ({
    weekday,
    label: WEEK_LABELS[i],
    date: weekDates[i],
    courses: courses
      .filter((c) => c.weekday === weekday)
      .sort((a, b) => a.start.localeCompare(b.start)),
  }));

  const renderTask = (t: Task) => (
    <div key={t.id} className="wr-task-line">
      <button
        className="wr-check"
        aria-label={`${t.done ? "标记未完成" : "完成"}：${t.text}`}
        onClick={() => toggle(t.id)}
      >
        {t.done && <Check size={15} />}
      </button>
      <span className="wr-task-content">
        <span className="wr-task-title">
          {t.time && (
            <span className="wr-task-time">
              <Clock3 size={12} />
              {t.time}
            </span>
          )}
          <span>{t.text}</span>
        </span>
        <span className="wr-task-tags">
          {t.category && <small className="wr-task-tag">{t.category}</small>}
          {t.priority && (
            <small className={`wr-task-tag wr-priority-${t.priority}`}>
              {priorityLabel(t.priority)}优先
            </small>
          )}
          {t.deadline && (
            <small className="wr-task-tag">
              {t.deadline === today ? "今天" : formatDay(t.deadline)}
            </small>
          )}
        </span>
      </span>
      <button aria-label="删除" onClick={() => remove(t.id)}>
        <Trash2 size={16} />
      </button>
    </div>
  );

  return (
    <>
      <div className="wr-head">
        <h1>计划</h1>
        <button
          className="wr-round"
          aria-label="新增任务"
          onClick={() => setOverlay("新增任务")}
        >
          <Plus />
        </button>
      </div>

      <div className="wr-segment">
        <button
          className={taskMode === "任务" ? "selected" : ""}
          onClick={() => setTaskMode("任务")}
        >
          任务
        </button>
        <button
          className={taskMode === "课表" ? "selected" : ""}
          onClick={() => setTaskMode("课表")}
        >
          课表
        </button>
      </div>

      {taskMode === "任务" ? (
        <>
          <section className="wr-progress-card" aria-label="本周进度">
            <div className="wr-progress-head">
              <span>本周进度</span>
              <b>
                {weekDone}/{weekTasks.length}
              </b>
            </div>
            <div
              className="wr-progress-track"
              role="progressbar"
              aria-valuenow={weekPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${weekPercent}%` }} />
            </div>
            <p className="wr-progress-note">
              {weekTasks.length
                ? weekPercent === 100
                  ? "本周的都完成了"
                  : `还剩 ${weekTasks.length - weekDone} 项，按时间顺序排好了`
                : "本周还没有带日期的任务，加一个截止时间就能排进这里"}
            </p>
          </section>

          <div className="wr-week-strip" aria-label="本周日期">
            {WEEK_LABELS.map((label, i) => {
              const date = weekDates[i];
              const isToday = date === today;
              const count =
                tasks.filter((t) => t.deadline === date && !t.done).length +
                courses.filter((c) => c.weekday === WEEK_ORDER[i]).length;
              return (
                <div
                  key={date}
                  className={"wr-week-day" + (isToday ? " is-today" : "")}
                >
                  <small>{label}</small>
                  <b>{Number(date.slice(8))}</b>
                  <i data-empty={count === 0} />
                </div>
              );
            })}
          </div>

          {overdue.length > 0 && (
            <>
              <h3 className="wr-section-title wr-section-danger">
                <AlertTriangle size={16} /> 逾期 {overdue.length} 项
              </h3>
              <div className="wr-task-card">{overdue.map(renderTask)}</div>
            </>
          )}

          {dueToday.length > 0 && (
            <>
              <h3 className="wr-section-title">今天</h3>
              <div className="wr-task-card">{dueToday.map(renderTask)}</div>
            </>
          )}

          {later.length > 0 && (
            <>
              <h3 className="wr-section-title">接下来</h3>
              <div className="wr-task-card">
                {later
                  .slice()
                  .sort((a, b) =>
                    (a.deadline ?? "").localeCompare(b.deadline ?? ""),
                  )
                  .map(renderTask)}
              </div>
            </>
          )}

          {undated.length > 0 && (
            <>
              <h3 className="wr-section-title">没定时间</h3>
              <div className="wr-task-card">{undated.map(renderTask)}</div>
            </>
          )}

          {doneTasks.length > 0 && (
            <>
              <h3 className="wr-section-title">已完成 {doneTasks.length}</h3>
              <div className="wr-task-card wr-task-card-done">
                {doneTasks.map((t) => (
                  <div key={t.id} className="wr-task-line">
                    <button
                      className="wr-check done"
                      aria-label={`标记未完成：${t.text}`}
                      onClick={() => toggle(t.id)}
                    >
                      <Check size={15} />
                    </button>
                    <span className="wr-task-content wr-done-text">
                      <span>{t.text}</span>
                    </span>
                    <button aria-label="删除" onClick={() => remove(t.id)}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tasks.length === 0 && (
            <p className="wr-empty-hint">
              还没有任务。在聊天里说一句「明天考试」，{""}
              确认方案后就会自动排进来。
            </p>
          )}
        </>
      ) : (
        <>
          <section className="wr-progress-card" aria-label="本周课程">
            <div className="wr-progress-head">
              <span>本周课程</span>
              <b>{courses.length} 节</b>
            </div>
            <p className="wr-progress-note">
              {courses.length
                ? "按周一到周日排列，点某一天看当天的课"
                : "还没有课程。在聊天里点「+」→「添加课程」就能录入"}
            </p>
          </section>

          <div className="wr-course-week">
            {courseDays.map((day) => (
              <section key={day.weekday} className="wr-course-day">
                <header>
                  <b>周{day.label}</b>
                  <small>{formatDay(day.date)}</small>
                  {day.date === today && <em>今天</em>}
                </header>
                {day.courses.length === 0 ? (
                  <p className="wr-course-empty">没课</p>
                ) : (
                  <div className="wr-course-list">
                    {day.courses.map((c) => (
                      <div key={c.id} className="wr-course-item">
                        <span className="wr-course-time">
                          {c.start}–{c.end}
                        </span>
                        <span className="wr-course-name">{c.name}</span>
                        {c.place && (
                          <span className="wr-course-place">
                            <MapPin size={12} />
                            {c.place}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
