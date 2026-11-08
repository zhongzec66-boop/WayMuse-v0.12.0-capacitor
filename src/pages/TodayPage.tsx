import { SlidersHorizontal, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Course, Kind, Overlay, Page, Task } from "../types";

export default function TodayPage({
  profileName,
  date,
  memories,
  tasks,
  todayCourses,
  courses,
  setCourses,
  setOverlay,
  openIntake,
  nav,
}: {
  profileName: string;
  date: string;
  memories: string[];
  tasks: Task[];
  todayCourses: Course[];
  courses: Course[];
  setCourses: Dispatch<SetStateAction<Course[]>>;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
  openIntake: (kind: Kind) => void;
  nav: (page: Page) => void;
}) {
  const activeTasks = tasks.filter((t) => !t.done);
  const highPriorityTasks = activeTasks.filter((t) => t.priority === "high");

  // 生成简报标题和正文
  const getBriefContent = () => {
    if (highPriorityTasks.length > 0) {
      return {
        title: "今天重点推进这些",
        body: `你有 ${highPriorityTasks.length} 项高优先级任务。专注完成它们，会让本周进展更清楚。`,
      };
    }
    if (activeTasks.length > 0) {
      return {
        title: "稳步推进当前计划",
        body: `你有 ${activeTasks.length} 项待办任务。选一两件今天能推进的，保持节奏。`,
      };
    }
    if (memories.length > 0) {
      return {
        title: "准备好开始了",
        body: "可以在任务页添加要推进的事，或者在聊天页告诉我你的想法。",
      };
    }
    return {
      title: "欢迎使用 WayMuse",
      body: "从记录你的情况开始，我会根据你的需要给出建议。",
    };
  };

  const brief = getBriefContent();
  const suggestedTasks = activeTasks.slice(0, 2);

  return (
    <>
      <div className="wr-head">
        <h1>今天</h1>
        <button
          className="wr-round"
          aria-label="设置"
          onClick={() => setOverlay("设置")}
        >
          <SlidersHorizontal />
        </button>
      </div>
      <div className="wr-welcome">
        <span>现在</span>
        <strong>欢迎，{profileName}</strong>
      </div>
      <article className="wr-brief">
        <div className="wr-brief-date">{date}</div>
        <h2>{brief.title}</h2>
        <p>{brief.body}</p>
        <div className="wr-brief-label">我记得这些</div>
        <div className="wr-chips">
          {memories.slice(0, 3).map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <div className="wr-divider" />
        <div className="wr-brief-label">今天的课程</div>
        {todayCourses.length ? (
          <div className="wr-course-list">
            {todayCourses.map((c) => (
              <div className="wr-course-row" key={c.id}>
                <span>
                  <b>{c.name}</b>
                  <small>{c.place || "地点未填写"}</small>
                </span>
                <time>
                  {c.start}–{c.end}
                </time>
                <button
                  aria-label={`删除${c.name}`}
                  onClick={() =>
                    setCourses(courses.filter((x) => x.id !== c.id))
                  }
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button
            className="wr-course-empty"
            onClick={() => openIntake("课表")}
          >
            暂无今天的课程，添加课表
          </button>
        )}
        <div className="wr-divider" />
        <div className="wr-brief-label">今天可以做</div>
        {suggestedTasks.length > 0 ? (
          <div className="wr-mini-grid">
            {suggestedTasks.map((t) => (
              <button key={t.id} onClick={() => nav("任务")}>
                <b>{t.text}</b>
                {t.priority && (
                  <small>
                    {t.priority === "high"
                      ? "高优先级"
                      : t.priority === "medium"
                        ? "中优先级"
                        : ""}
                  </small>
                )}
              </button>
            ))}
          </div>
        ) : (
          <button className="wr-course-empty" onClick={() => nav("任务")}>
            去任务页添加要推进的事
          </button>
        )}
        <p className="wr-brief-end">
          你可以随时告诉我新的进展，我会一起调整计划。
        </p>
      </article>
    </>
  );
}
