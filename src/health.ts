/**
 * 健康卡的数据源。
 *
 * ⚠️ 目前是**固定示例值**，不是从 HealthKit 读的：没有付费开发者账号，
 * 健康权限拿不到。这些数字只为了把卡片的版式调出来，接真数据时
 * 把 useHealthSnapshot() 换掉即可，界面不用动。
 */

export type HealthSnapshot = {
  sleepMinutes: number;
  steps: number;
  restingHeartRate: number;
  focusMinutes: number;
  updatedAt: string;
};

export function useHealthSnapshot(): HealthSnapshot {
  // 故意用固定值而不是随机：每次进页面数字乱跳会让人以为是真数据
  return {
    sleepMinutes: 7 * 60 + 20,
    steps: 8432,
    restingHeartRate: 62,
    focusMinutes: 3 * 60 + 10,
    updatedAt: "08:59",
  };
}

export function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`;
}

export function formatFocus(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分`;
}
