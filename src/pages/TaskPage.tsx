import { AlertTriangle, Check, Clock3, Plus, Trash2, X } from "lucide-react";
import { Fragment, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { newId } from "../id";
import { useHideNativeChrome } from "../chrome";
import DeadlineCards from "./DeadlineCards";
import type { Assignment, Exam } from "../semester";
import type { Course, Overlay, Task } from "../types";

export type TaskMode = "任务" | "课表";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** 课程 weekday 用 0=周日 … 6=周六（与 storage.sanitizeCourse 一致），
 *  界面按「周一开头」排列。 */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const WEEKDAY_OF_LABEL: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

/** "8:00" → "08:00"，其它原样返回 */
function padTime(value: string): string {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : value;
}

/**
 * 批量导入：一行一节课。
 * 例：周一 08:00-09:40 高等数学 @教三-201
 * 地点用 @ 分隔，可省略；「周」/「星期」前缀可省略。
 */
function parseCourseLines(text: string): Course[] {
  const out: Course[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(
      /^(?:周|星期)?([一二三四五六日天])\s*(\d{1,2}:\d{2})\s*[-–~—至]\s*(\d{1,2}:\d{2})\s*(.+)$/,
    );
    if (!m) continue;
    let rest = m[4].trim();
    let place = "";
    const at = rest.lastIndexOf("@");
    if (at >= 0) {
      place = rest.slice(at + 1).trim();
      rest = rest.slice(0, at).trim();
    }
    if (!rest) continue;
    out.push({
      id: newId(),
      name: rest.slice(0, 40),
      weekday: WEEKDAY_OF_LABEL[m[1]] ?? 1,
      start: padTime(m[2]),
      end: padTime(m[3]),
      place: place.slice(0, 40),
    });
  }
  return out;
}

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
  setCourses,
  assignments,
  setAssignments,
  exams,
  setExams,
  setOverlay,
}: {
  taskMode: TaskMode;
  setTaskMode: Dispatch<SetStateAction<TaskMode>>;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  courses: Course[];
  setCourses: Dispatch<SetStateAction<Course[]>>;
  assignments: Assignment[];
  setAssignments: Dispatch<SetStateAction<Assignment[]>>;
  exams: Exam[];
  setExams: Dispatch<SetStateAction<Exam[]>>;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
}) {
  // ── 课程录入 / 批量导入 ──
  const [courseOpen, setCourseOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // iOS 的输入框和标签栏是原生视图，浮在网页之上：弹层打开时必须藏起来，
  // 否则「保存」按钮永远被它们盖住。
  useHideNativeChrome(courseOpen || importOpen);
  const [draftName, setDraftName] = useState("");
  const [draftWeekday, setDraftWeekday] = useState(1);
  const [draftStart, setDraftStart] = useState("08:00");
  const [draftEnd, setDraftEnd] = useState("09:40");
  const [draftPlace, setDraftPlace] = useState("");
  const [importText, setImportText] = useState("");
  const [importNote, setImportNote] = useState("");

  const resetCourse = () => {
    setDraftName("");
    setDraftWeekday(1);
    setDraftStart("08:00");
    setDraftEnd("09:40");
    setDraftPlace("");
  };

  const saveCourse = () => {
    const name = draftName.trim();
    if (!name) return;
    setCourses([
      ...courses,
      {
        id: newId(),
        name: name.slice(0, 40),
        weekday: draftWeekday,
        start: draftStart,
        end: draftEnd,
        place: draftPlace.trim().slice(0, 40),
      },
    ]);
    resetCourse();
    setCourseOpen(false);
  };

  const runImport = () => {
    const parsed = parseCourseLines(importText);
    if (!parsed.length) {
      setImportNote("没认出任何一行，检查一下格式？");
      return;
    }
    setCourses([...courses, ...parsed]);
    setImportText("");
    setImportNote(`已导入 ${parsed.length} 节`);
  };

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

  // 课表按「时间槽 × 周一~周日」排成网格：整个一周一屏看完，不再一行一个。
  const slots = Array.from(new Set(courses.map((c) => c.start))).sort();

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
          aria-label={taskMode === "课表" ? "添加课程" : "新增任务"}
          onClick={() =>
            taskMode === "课表" ? setCourseOpen(true) : setOverlay("新增任务")
          }
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

          <DeadlineCards
            courses={courses}
            assignments={assignments}
            setAssignments={setAssignments}
            exams={exams}
            setExams={setExams}
          />

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
                ? "整个一周一屏看完；点上面的「+」可以补课或批量导入"
                : "还没有课程。点右上角「+」录入一节课，或者批量粘贴。"}
            </p>
            <div className="wr-course-actions">
              <button onClick={() => setCourseOpen(true)}>录入一节课</button>
              <button onClick={() => setImportOpen(true)}>批量导入</button>
            </div>
          </section>

          {courses.length === 0 ? (
            <p className="wr-empty-hint">
              还没有课程。点「录入一节课」，或者「批量导入」一次贴进来。
            </p>
          ) : (
            <div className="wr-grid" aria-label="周课表">
              <div className="wr-grid-corner" />
              {WEEK_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={
                    "wr-grid-day" + (weekDates[i] === today ? " is-today" : "")
                  }
                >
                  {label}
                </div>
              ))}
              {slots.map((slot) => (
                <Fragment key={slot}>
                  <div className="wr-grid-time">{slot}</div>
                  {WEEK_ORDER.map((weekday) => {
                    const cell = courses.filter(
                      (c) => c.weekday === weekday && c.start === slot,
                    );
                    return (
                      <div key={weekday} className="wr-grid-cell">
                        {cell.map((c) => (
                          <button
                            key={c.id}
                            className="wr-grid-course"
                            title={`${c.name} ${c.start}–${c.end}${c.place ? ` · ${c.place}` : ""}（点一下删除）`}
                            onClick={() =>
                              setCourses(courses.filter((x) => x.id !== c.id))
                            }
                          >
                            <b>{c.name}</b>
                            {c.place && <small>{c.place}</small>}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 录入一节课 ─────────────────────────────── */}
      {courseOpen && (
        <div className="wr-overlay wr-overlay-fixed">
          <div className="wr-sheet">
            <div className="wr-sheet-head">
              <button onClick={() => setCourseOpen(false)} aria-label="返回">
                <X />
              </button>
              <h2>录入一节课</h2>
              <span />
            </div>

            <label className="wr-field">
              <span>课程名</span>
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="例如：高等数学"
                maxLength={40}
              />
            </label>

            <div className="wr-field">
              <span>星期几</span>
              <div className="wr-weekpick">
                {WEEK_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={draftWeekday === WEEK_ORDER[i] ? "selected" : ""}
                    onClick={() => setDraftWeekday(WEEK_ORDER[i])}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="wr-field-row">
              <label className="wr-field">
                <span>开始</span>
                <input
                  type="time"
                  value={draftStart}
                  onChange={(e) => setDraftStart(e.target.value)}
                />
              </label>
              <label className="wr-field">
                <span>结束</span>
                <input
                  type="time"
                  value={draftEnd}
                  onChange={(e) => setDraftEnd(e.target.value)}
                />
              </label>
            </div>

            <label className="wr-field">
              <span>地点</span>
              <input
                value={draftPlace}
                onChange={(e) => setDraftPlace(e.target.value)}
                placeholder="例如：教三-201（可空）"
                maxLength={40}
              />
            </label>

            <button className="wr-sheet-primary" onClick={saveCourse}>
              保存这节课
            </button>
          </div>
        </div>
      )}

      {/* ── 批量导入 ───────────────────────────────── */}
      {importOpen && (
        <div className="wr-overlay wr-overlay-fixed">
          <div className="wr-sheet">
            <div className="wr-sheet-head">
              <button onClick={() => setImportOpen(false)} aria-label="返回">
                <X />
              </button>
              <h2>批量导入</h2>
              <span />
            </div>

            <p className="wr-import-hint">
              一行一节课，格式：<code>周一 08:00-09:40 高等数学 @教三-201</code>
              <br />
              地点用 @ 分隔，可以省略。
            </p>

            <textarea
              className="wr-import-area"
              rows={6}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportNote("");
              }}
              placeholder={
                "周一 08:00-09:40 高等数学 @教三-201\n周二 10:00-11:40 数据结构 @机房 A\n周三 14:00-15:40 大学英语"
              }
            />

            {importNote && <p className="wr-import-note">{importNote}</p>}

            <button className="wr-sheet-primary" onClick={runImport}>
              解析并加入课表
            </button>
          </div>
        </div>
      )}
    </>
  );
}
