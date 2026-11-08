import { BRAND } from "../brand";
import { Check, Clock3, Plus, Trash2, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Overlay, Task } from "../types";

export default function TaskPage({
  taskMode,
  setTaskMode,
  tasks,
  setTasks,
  setOverlay,
}: {
  taskMode: "任务" | "定时";
  setTaskMode: Dispatch<SetStateAction<"任务" | "定时">>;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
}) {
  const activeTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

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
          className={taskMode === "定时" ? "selected" : ""}
          onClick={() => setTaskMode("定时")}
        >
          定时
        </button>
      </div>
      {taskMode === "任务" ? (
        <>
          {activeTasks.length > 0 && (
            <>
              <h3 className="wr-section-title">进行中</h3>
              <div className="wr-task-card">
                {activeTasks.map((t) => (
                  <div key={t.id} className="wr-task-line">
                    <button
                      className="wr-check"
                      aria-label={`${t.done ? "标记未完成" : "完成"}：${t.text}`}
                      onClick={() =>
                        setTasks(
                          tasks.map((item) =>
                            item.id === t.id ? { ...item, done: true } : item,
                          ),
                        )
                      }
                    >
                      {t.done && <Check size={15} />}
                    </button>
                    <span className="wr-task-content">
                      {t.category && (
                        <small className="wr-plan-origin">{t.category}</small>
                      )}
                      <span>{t.text}</span>
                      {t.priority && (
                        <small className={`wr-priority-${t.priority}`}>
                          {t.priority === "high"
                            ? "高优先级"
                            : t.priority === "medium"
                              ? "中优先级"
                              : "低优先级"}
                        </small>
                      )}
                      {t.deadline && <small>截止 {t.deadline}</small>}
                    </span>
                    <button
                      aria-label="删除"
                      onClick={() =>
                        setTasks(tasks.filter((item) => item.id !== t.id))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {doneTasks.length > 0 && (
            <>
              <h3 className="wr-section-title">已完成</h3>
              <div className="wr-task-card">
                {doneTasks.map((t) => (
                  <div key={t.id} className="wr-task-line">
                    <button
                      className="wr-check done"
                      onClick={() =>
                        setTasks(
                          tasks.map((item) =>
                            item.id === t.id ? { ...item, done: false } : item,
                          ),
                        )
                      }
                    >
                      <Check size={15} />
                    </button>
                    <span className="wr-task-content wr-done-text">
                      {t.category && (
                        <small className="wr-plan-origin">{t.category}</small>
                      )}
                      {t.text}
                    </span>
                    <button
                      aria-label="删除"
                      onClick={() =>
                        setTasks(tasks.filter((item) => item.id !== t.id))
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {tasks.length === 0 && (
            <p className="wr-empty-hint">暂无任务，点击右上角添加</p>
          )}
        </>
      ) : (
        <>
          <h3 className="wr-section-title">为你推荐</h3>
          {["每日行动简报", "每周目标复盘", "截止事项提前检查"].map((x) => (
            <button
              key={x}
              className="wr-schedule"
              onClick={() => setOverlay("新增任务")}
            >
              <Clock3 size={20} />
              <span>
                {x}
                <small>让 {BRAND} 定期帮你整理进展</small>
              </span>
              <Plus size={20} />
            </button>
          ))}
        </>
      )}
    </>
  );
}
