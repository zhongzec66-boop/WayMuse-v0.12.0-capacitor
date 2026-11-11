import type { Task } from "./types";

/**
 * 从任务完成记录里推断习惯。
 *
 * 刻意做成纯规则、不调模型：便宜、稳定、结论可解释。
 * 不新建采集入口：只读 Task 上已有的 category 与 completedAt。
 */

/** 滚动窗口：最近 7 天 */
export const HABIT_WINDOW_DAYS = 7;
/** 至少完成几次才算习惯 */
export const HABIT_MIN_COUNT = 3;
/** 「时段相近」= 落在连续 2 小时之内 */
export const HABIT_WINDOW_HOURS = 2;

export type HabitCandidate = {
  /** 稳定签名：同类行为 + 时段桶，用来防重复生成 */
  signature: string;
  /** 显示用正文，例如「连续 5 天 · 早上 7 点左右背单词」 */
  text: string;
  label: string;
  /** 时段起点（偶数小时，仅用于文案与排序） */
  windowStartHour: number;
  /** 命中的天数 */
  days: number;
  /** 命中的完成次数 */
  count: number;
};

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 文案用的时段起点：向下取整到偶数小时 */
function bucketHour(hour: number): number {
  return hour - (hour % HABIT_WINDOW_HOURS);
}

function periodLabel(hour: number): string {
  if (hour < 5) return "凌晨";
  if (hour < 8) return "早上";
  if (hour < 11) return "上午";
  if (hour < 13) return "中午";
  if (hour < 17) return "下午";
  if (hour < 19) return "傍晚";
  if (hour < 23) return "晚上";
  return "深夜";
}

/** 类别键：优先用 category，退回任务正文的前几个字 */
function labelOf(task: Task): string {
  const category = task.category?.trim();
  if (category) return category;
  return task.text.trim().slice(0, 12);
}

/**
 * 在一组时刻里找「最密的一段」：找一个起点，使落在它之后 2 小时内的次数最多。
 *
 * 为什么不用固定对齐的窗口（0–2 / 2–4…）：7:59 和 8:01 只差两分钟，
 * 却被切成两个窗口，用户的感受不是这样——「都差不多这个点做的事」
 * 才算同一个习惯。滑动窗口没有这种断崖。
 */
function densestCluster(times: number[]): number[] {
  // 按「一天中的第几分钟」比较：连续三天早上 7 点，绝对时间差 24 小时，
  // 但时刻是同一个，这才是用户心里的「都差不多这个点」。
  const span = HABIT_WINDOW_HOURS * 60;
  const items = times
    .map((time, idx) => {
      const date = new Date(time);
      return { idx, time, minutes: date.getHours() * 60 + date.getMinutes() };
    })
    .sort((a, b) => a.minutes - b.minutes);

  // 复制一份 +24h，处理跨零点（23:30 与 00:30 只差一小时）
  const extended = [
    ...items,
    ...items.map((item) => ({ ...item, minutes: item.minutes + 1440 })),
  ];

  let best: typeof items = [];
  for (let i = 0; i < items.length; i += 1) {
    const start = extended[i].minutes;
    const cluster: typeof items = [];
    for (let j = i; j < extended.length && extended[j].minutes < start + span; j += 1) {
      cluster.push(extended[j]);
    }
    if (cluster.length > best.length) best = cluster;
  }
  // 去重按「哪一条记录」而不是按时刻：
  // 同一天同一分钟完成两条任务也算两次，不能因为时间戳相同被吞掉
  const seen = new Set<number>();
  return best
    .filter((item) => {
      if (seen.has(item.idx)) return false;
      seen.add(item.idx);
      return true;
    })
    .map((item) => item.time);
}

export function inferHabits(
  tasks: Task[],
  options: { now?: Date; dismissedKeys?: string[] } = {},
): HabitCandidate[] {
  const now = options.now ?? new Date();
  const dismissed = new Set(options.dismissedKeys ?? []);
  const from = startOfDay(now.getTime()) - (HABIT_WINDOW_DAYS - 1) * 86_400_000;

  // 1. 收集窗口内已完成的记录，按类别分组
  const byLabel = new Map<string, { times: number[] }>();
  for (const task of tasks) {
    if (!task.done) continue;
    const at = task.completedAt;
    if (typeof at !== "number" || at < from || at > now.getTime()) continue;
    const label = labelOf(task);
    if (!label) continue;
    const bucket = byLabel.get(label) ?? { times: [] };
    bucket.times.push(at);
    byLabel.set(label, bucket);
  }

  // 2. 每类找最密的一段，够 3 次才算习惯
  const habits: HabitCandidate[] = [];
  for (const [label, bucket] of byLabel) {
    if (bucket.times.length < HABIT_MIN_COUNT) continue;
    const cluster = densestCluster(bucket.times);
    if (cluster.length < HABIT_MIN_COUNT) continue;

    const hours = cluster.map((time) => new Date(time).getHours());
    const medianHour = hours.slice().sort((a, b) => a - b)[Math.floor(hours.length / 2)] ?? 0;
    const start = bucketHour(medianHour);
    // 签名用「类别 + 2 小时桶」，同一行为换个星期也不会重复生成
    const signature = `${label}#${start}`;
    if (dismissed.has(signature)) continue;

    const days = new Set(cluster.map(startOfDay)).size;
    habits.push({
      signature,
      text: `连续 ${days} 天 · ${periodLabel(start)} ${start} 点左右${label}`,
      label,
      windowStartHour: start,
      days,
      count: cluster.length,
    });
  }

  habits.sort((a, b) => b.days - a.days || b.count - a.count);
  return habits;
}
