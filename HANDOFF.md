# WayMuse 0.11.0 交接

入口：`src/WayMuseReference.tsx`。数据继续使用 `src/storage.ts` 的 v2 本地存储，保留旧资料兼容。

- `src/pages/TodayPage.tsx`：行动优先的首页，任务完成直接写入共享状态。
- `src/pages/TaskPage.tsx`：任务编辑器、筛选和搜索、删除撤销；原假定时页已移除。
- `src/taskOrder.ts`：优先级优先，同级按日期升序，无日期置后，不修改原数组。
- `src/styles/workspace.css`：本轮工作台样式，最后加载；保留旧组件 CSS 以支持未重构的设置与资料页面。桌面和手机布局在此定义。
- `src/WayMuseIntake.tsx`：课程增改、周课表列表、删除撤销；时间输入即时更新。
- `src/pages/MemoryPage.tsx`：内联编辑与删除撤销。
- `src/pages/ChatPage.tsx`：默认展示对话入口，连接配置按需展开。保留真实 API 客户端。

首次体验入口只跳过档案向导，不注入密钥或伪造 AI 回复。没有云同步与系统学习信号。

任务的撤销记录为当前任务页面最近一次删除；课程和记忆撤销记录保留在各自页面，离开页面或刷新后失效。重要资料可通过设置导出。

检查和浏览器验证记录见 `docs/reports/0.11.0-demo.md`。
