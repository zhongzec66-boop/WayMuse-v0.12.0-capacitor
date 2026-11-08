const connections = ["日历与提醒事项", "学习 App 与资料", "实习平台"];

export default function ConnectionsPanel() {
  return (
    <div aria-label="计划接入的应用">
      {connections.map((name) => (
        <div className="wr-settings-row" key={name}>
          <span>{name}</span>
          <span className="wr-settings-status">规划中</span>
        </div>
      ))}
    </div>
  );
}
