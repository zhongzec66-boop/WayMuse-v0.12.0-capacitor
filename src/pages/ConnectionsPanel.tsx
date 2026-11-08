import { useState } from "react";

const connections = [
  {
    name: "Apple 健康",
    icon: "♡",
    note: "睡眠、步数与活动",
    detail:
      "演示样例：昨晚睡眠 6 小时，今日 3,200 步。可用于展示较轻量的学习建议。实际健康数据尚未接入。",
    memory:
      "【模拟健康样例，非真实数据】昨晚睡眠6小时；安排学习时希望少量多次。",
  },
  {
    name: "日历与提醒事项",
    icon: "▦",
    note: "课程安排与学习提醒",
    detail:
      "演示样例：周三 14:00 高等数学，周五提交课程作业。目前只预览，不会写入系统日历或提醒事项。",
    memory: "【模拟日历样例】周三14:00高等数学，周五提交课程作业。",
  },
  {
    name: "快捷指令与本机文件",
    icon: "⌘",
    note: "未来的本机操作入口",
    detail:
      "连接设计预览。尚未调用快捷指令，也不会读取其他 App、本机文件或后台活动。系统能力需要逐项实现和授权。",
    memory: "",
  },
  {
    name: "学习 App 与资料",
    icon: "▤",
    note: "笔记、卡片与课程资料",
    detail:
      "演示样例：一份包含「极限、导数、积分」的复习提纲。可将样例加入记忆，体验聊天读取学习资料；外部学习 App 尚未接入。",
    memory:
      "【模拟学习资料】数学复习提纲：极限、导数、积分。学习时偏好先举例，再做一道自测题。",
  },
];
export default function ConnectionsPanel({
  onImport,
}: {
  onImport: (text: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [imported, setImported] = useState<string[]>([]);
  return (
    <>
      <p className="wr-settings-hint">
        以下均为连接演示，未读取设备或外部
        App。样例只有在你点选后才加入本机记忆。
      </p>
      {connections.map((item) => (
        <div className="wr-connection" key={item.name}>
          <button
            className="wr-settings-row"
            aria-expanded={selected === item.name}
            onClick={() =>
              setSelected(selected === item.name ? null : item.name)
            }
          >
            <span>
              <b>
                {item.icon} {item.name}
              </b>
              <small>{item.note}</small>
            </span>
            <small>未接入 · 预览</small>
          </button>
          {selected === item.name && (
            <div className="wr-connection-detail">
              <p>{item.detail}</p>
              {item.memory && (
                <button
                  className="wr-ai-secondary"
                  disabled={imported.includes(item.name)}
                  onClick={() => {
                    onImport(item.memory);
                    setImported([...imported, item.name]);
                  }}
                >
                  {imported.includes(item.name)
                    ? "样例已加入记忆，可随时删除"
                    : "将模拟样例加入记忆"}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
