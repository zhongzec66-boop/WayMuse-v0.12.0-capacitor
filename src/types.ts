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
  /** 完成时刻（ms）。习惯推断要用，勾选完成时写入；取消完成则清掉 */
  completedAt?: number;
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
  /** 以下都是学期结构化数据，缺省不影响旧数据 */
  teacher?: string;
  /** 学分 */
  credits?: number;
  /** 考核方式，如「期末开卷 70% + 平时 30%」 */
  assessment?: string;
};

/** 记忆的分量：1 = 小事，2 = 一般，3 = 重要（星空里会发光） */
export type MemoryWeight = 1 | 2 | 3;

/** 记忆的性质：普通事实 / 情绪 / 推断出来的习惯 */
export type MemoryKind = "normal" | "emotion" | "habit";

/** pending = 还在海马体待巩固；consolidated = 已沉淀进皮层 */
export type MemoryStatus = "pending" | "consolidated";

export type Memory = {
  id: string;
  text: string;
  weight: MemoryWeight;
  createdAt: number;
  /** 旧数据迁移时默认 normal；weight === 3 的旧条目迁移为 emotion */
  kind?: MemoryKind;
  /** 旧数据迁移时默认 consolidated（存量本来就是长期记忆） */
  status?: MemoryStatus;
  /** inferred = 由任务完成记录推断出来的习惯，用户可以删 */
  source?: "inferred";
};
