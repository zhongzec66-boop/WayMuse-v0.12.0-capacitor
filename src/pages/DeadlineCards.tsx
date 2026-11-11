import { CalendarClock, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useHideNativeChrome } from "../chrome";
import { newId } from "../id";
import { hoursUntilDue } from "../semester";
import type { Assignment, Exam } from "../semester";
import type { Course } from "../types";

/**
 * 作业卡与考试卡。
 *
 * 设计原则（来自界面定稿）：卡片负责做事，文字只负责解释。
 * 所以这里不写鼓励的话，只给事实：还剩多少时间、占多少分、复习到哪。
 */

/** 剩余时间的人话表述：逾期优先，其次按小时/天分档 */
export function dueText(hours: number | null): string {
  if (hours === null) return "没有截止时间";
  if (hours < 0) {
    const overdue = Math.abs(hours);
    // 不足一小时的不要说「逾期 0 小时」
    if (overdue < 1) return `逾期 ${Math.max(1, Math.round(overdue * 60))} 分钟`;
    return overdue < 24
      ? `逾期 ${Math.round(overdue)} 小时`
      : `逾期 ${Math.round(overdue / 24)} 天`;
  }
  if (hours < 1) return `还剩 ${Math.max(1, Math.round(hours * 60))} 分钟`;
  if (hours < 24) return `还剩 ${Math.round(hours)} 小时`;
  return `还剩 ${Math.round(hours / 24)} 天`;
}

function isOverdue(hours: number | null): boolean {
  return hours !== null && hours < 0;
}

function courseName(courses: Course[], courseId?: string): string {
  if (!courseId) return "";
  return courses.find((course) => course.id === courseId)?.name ?? "";
}

function examDateText(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "时间待定";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month} 月 ${day} 日 ${hour}:${minute}`;
}

export default function DeadlineCards({
  courses,
  assignments,
  setAssignments,
  exams,
  setExams,
  now = new Date(),
}: {
  courses: Course[];
  assignments: Assignment[];
  setAssignments: Dispatch<SetStateAction<Assignment[]>>;
  exams: Exam[];
  setExams: Dispatch<SetStateAction<Exam[]>>;
  now?: Date;
}) {
  const [sheet, setSheet] = useState<"assignment" | "exam" | null>(null);
  useHideNativeChrome(sheet !== null);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("23:59");
  const [weight, setWeight] = useState("");
  const [scope, setScope] = useState("");
  const [courseId, setCourseId] = useState("");

  const reset = () => {
    setTitle("");
    setDueDate("");
    setDueTime("23:59");
    setWeight("");
    setScope("");
    setCourseId("");
  };

  const pending = assignments
    .filter((item) => item.status !== "done")
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const finished = assignments.filter((item) => item.status === "done");
  const upcomingExams = exams
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const addAssignment = () => {
    if (!title.trim() || !dueDate) return;
    const parsedWeight = Number(weight);
    setAssignments((current) => [
      ...current,
      {
        id: newId(),
        title: title.trim(),
        ...(courseId ? { courseId } : {}),
        dueAt: new Date(`${dueDate}T${dueTime || "23:59"}:00`).toISOString(),
        ...(Number.isFinite(parsedWeight) && weight.trim()
          ? { weightPercent: Math.min(100, Math.max(0, Math.round(parsedWeight))) }
          : {}),
        status: "todo",
      },
    ]);
    reset();
    setSheet(null);
  };

  const addExam = () => {
    if (!dueDate) return;
    setExams((current) => [
      ...current,
      {
        id: newId(),
        ...(courseId ? { courseId } : {}),
        at: new Date(`${dueDate}T${dueTime || "09:00"}:00`).toISOString(),
        ...(scope.trim() ? { scope: scope.trim() } : {}),
      },
    ]);
    reset();
    setSheet(null);
  };

  const toggleDone = (id: string) => {
    setAssignments((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "done" ? "todo" : "done" }
          : item,
      ),
    );
  };

  const removeAssignment = (id: string) => {
    setAssignments((current) => current.filter((item) => item.id !== id));
  };

  const removeExam = (id: string) => {
    setExams((current) => current.filter((item) => item.id !== id));
  };

  return (
    <>
      <div className="wr-deadline-head">
        <h3 className="wr-section-title">
          <CalendarClock size={16} /> 作业与考试
        </h3>
        <button
          type="button"
          className="wr-deadline-add"
          onClick={() => {
            reset();
            setSheet("assignment");
          }}
        >
          <Plus size={14} /> 添加
        </button>
      </div>

      {pending.length === 0 && upcomingExams.length === 0 && (
        <p className="wr-deadline-empty">
          还没有作业或考试。加一条，到期前会按 48 / 12 / 2 小时提醒你。
        </p>
      )}

      {pending.length > 0 && (
        <div className="wr-deadline-list">
          {pending.map((item) => {
            const hours = hoursUntilDue(item, now);
            const name = courseName(courses, item.courseId);
            return (
              <article
                key={item.id}
                className={
                  "wr-deadline-card" +
                  (isOverdue(hours) ? " is-overdue" : "")
                }
              >
                <button
                  type="button"
                  className="wr-deadline-check"
                  aria-label="标记完成"
                  onClick={() => toggleDone(item.id)}
                >
                  <span />
                </button>
                <div className="wr-deadline-body">
                  <b>{item.title}</b>
                  <small>
                    {name ? `${name} · ` : ""}
                    {dueText(hours)}
                  </small>
                </div>
                {item.weightPercent !== undefined && (
                  <span className="wr-deadline-weight">
                    占 {item.weightPercent}%
                  </span>
                )}
                <button
                  type="button"
                  className="wr-deadline-remove"
                  aria-label="删除"
                  onClick={() => removeAssignment(item.id)}
                >
                  <X size={14} />
                </button>
              </article>
            );
          })}
        </div>
      )}

      {upcomingExams.length > 0 && (
        <div className="wr-deadline-list">
          {upcomingExams.map((item) => {
            const name = courseName(courses, item.courseId);
            const progress = item.progressPercent ?? 0;
            return (
              <article key={item.id} className="wr-deadline-card is-exam">
                <div className="wr-deadline-body">
                  <b>{name || "考试"}</b>
                  <small>
                    {examDateText(item.at)}
                    {item.scope ? ` · ${item.scope}` : ""}
                  </small>
                  <div
                    className="wr-deadline-progress"
                    aria-label={`复习进度 ${progress}%`}
                  >
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <button
                  type="button"
                  className="wr-deadline-remove"
                  aria-label="删除"
                  onClick={() => removeExam(item.id)}
                >
                  <X size={14} />
                </button>
              </article>
            );
          })}
        </div>
      )}

      {finished.length > 0 && (
        <p className="wr-deadline-empty">已完成 {finished.length} 项作业</p>
      )}

      {sheet && (
        <div className="wr-deadline-sheet" role="dialog" aria-modal="true">
          <div className="wr-deadline-sheet-card">
            <header>
              <h2>{sheet === "assignment" ? "添加作业" : "添加考试"}</h2>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setSheet(null)}
              >
                <X size={18} />
              </button>
            </header>

            {sheet === "assignment" && (
              <label>
                作业内容
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例如：数据结构第三次作业"
                  maxLength={80}
                />
              </label>
            )}

            <label>
              课程
              <select
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
              >
                <option value="">不关联课程</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="wr-deadline-row">
              <label>
                {sheet === "assignment" ? "截止日期" : "考试日期"}
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              <label>
                时间
                <input
                  type="time"
                  value={dueTime}
                  onChange={(event) => setDueTime(event.target.value)}
                />
              </label>
            </div>

            {sheet === "assignment" ? (
              <label>
                占总成绩（%，可不填）
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  placeholder="15"
                />
              </label>
            ) : (
              <label>
                考试范围（可不填）
                <input
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                  placeholder="第 1–6 章"
                  maxLength={100}
                />
              </label>
            )}

            <div className="wr-deadline-sheet-actions">
              <button type="button" onClick={() => setSheet(null)}>
                取消
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={sheet === "assignment" ? addAssignment : addExam}
                disabled={sheet === "assignment" ? !title.trim() || !dueDate : !dueDate}
              >
                保存
              </button>
            </div>

            {sheet === "assignment" && (
              <button
                type="button"
                className="wr-deadline-switch"
                onClick={() => setSheet("exam")}
              >
                这次是考试？
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
