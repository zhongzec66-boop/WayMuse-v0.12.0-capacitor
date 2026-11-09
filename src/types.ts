export type Page = "聊天" | "Today" | "任务" | "记忆" | "角色";

export type Overlay =
  "" | "设置" | "隐私与数据" | "清除数据" | "新增任务" | "添加记忆";

export type Task = {
  id: string;
  text: string;
  done: boolean;
  priority?: "high" | "medium" | "low";
  deadline?: string;
  /** 可选：HH:mm，用户提到具体钟点时才给 */
  time?: string;
  /** 可选：精确到期时刻（ISO8601）。有值时优先于 deadline + time。 */
  dueAt?: string;
  category?: string;
};

export type Course = {
  id: string;
  name: string;
  weekday: number;
  start: string;
  end: string;
  place: string;
  /** 这门课在第几周上。空/缺省 = 每周都上（兼容旧数据） */
  weeks?: number[];
};

/** 记忆的分量：1 = 小事，2 = 一般，3 = 重要（星空里会发光） */
export type MemoryWeight = 1 | 2 | 3;

export type Memory = {
  id: string;
  text: string;
  weight: MemoryWeight;
  createdAt: number;
};
