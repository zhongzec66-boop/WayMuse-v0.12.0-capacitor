import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Android 本地状态：屏幕使用时间 + 步数。
 *
 * 隐私原则：
 * - 只在本机读、本机用，不上传明细
 * - 只取「总时长 + 前几个 App 的分钟数」，不取具体使用时段
 * - 用户随时可以在系统设置里关掉授权
 */

export type UsageApp = { package: string; label: string; minutes: number };

export type UsageSummary = { totalMinutes: number; apps: UsageApp[] };

export type InsightsStatus = {
  usageAccess: boolean;
  activityPermission: boolean;
  stepsSupported: boolean;
};

type NativeInsightsPlugin = {
  status(): Promise<InsightsStatus>;
  openUsageAccessSettings(): Promise<void>;
  requestActivityPermission(): Promise<{ granted: boolean }>;
  usage(): Promise<UsageSummary>;
  steps(): Promise<{ sinceBoot: number }>;
};

const NativeInsights = registerPlugin<NativeInsightsPlugin>("NativeInsights");

export function hasNativeInsights(): boolean {
  return Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform();
}

export const insightsStatus = () => NativeInsights.status();
export const openUsageAccessSettings = () => NativeInsights.openUsageAccessSettings();
export const requestActivityPermission = () => NativeInsights.requestActivityPermission();
export const readUsage = () => NativeInsights.usage();
export const readStepsSinceBoot = () => NativeInsights.steps();

/* ── 每天步数差值（系统只给开机累计值）────────────────── */

const STEPS_KEY = "waymuse-steps-baseline";

export function todaySteps(sinceBoot: number): number {
  try {
    const raw = localStorage.getItem(STEPS_KEY);
    const today = new Date().toDateString();
    if (raw) {
      const saved = JSON.parse(raw) as { date: string; base: number };
      if (saved.date === today && sinceBoot >= saved.base) {
        return sinceBoot - saved.base;
      }
    }
    // 第一次取、跨天或手机重启（计数变小）：以当前值为基准
    localStorage.setItem(STEPS_KEY, JSON.stringify({ date: today, base: sinceBoot }));
    return 0;
  } catch {
    return 0;
  }
}

/* ── 给提示词用的摘要（有缓存，避免每句话都读系统）────── */

export type InsightsSnapshot = {
  usageMinutes: number;
  topApps: Array<{ label: string; minutes: number }>;
  steps: number;
  updatedAt: number;
};

const CACHE_KEY = "waymuse-insights-cache";
const CACHE_TTL = 10 * 60 * 1000;

export function cachedInsights(): InsightsSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InsightsSnapshot;
    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt > CACHE_TTL * 3) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function refreshInsights(): Promise<InsightsSnapshot | null> {
  if (!hasNativeInsights()) return null;

  const snapshot: InsightsSnapshot = {
    usageMinutes: 0,
    topApps: [],
    steps: 0,
    updatedAt: Date.now(),
  };

  try {
    const status = await insightsStatus();
    if (status.usageAccess) {
      const usage = await readUsage();
      snapshot.usageMinutes = usage.totalMinutes;
      snapshot.topApps = usage.apps
        .slice(0, 4)
        .map((app) => ({ label: app.label, minutes: app.minutes }));
    }
  } catch {
    // 没授权或读取失败：跳过
  }

  try {
    const { sinceBoot } = await readStepsSinceBoot();
    snapshot.steps = todaySteps(sinceBoot);
  } catch {
    // 没有计步传感器
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // 忽略
  }
  return snapshot;
}

/** 拼进系统提示词的一行摘要 */
export function insightsPromptLine(): string {
  const snapshot = cachedInsights();
  if (!snapshot) return "";
  const parts: string[] = [];
  if (snapshot.usageMinutes > 0) {
    const hours = Math.floor(snapshot.usageMinutes / 60);
    const minutes = snapshot.usageMinutes % 60;
    const time = hours > 0 ? `${hours} 小时 ${minutes} 分` : `${minutes} 分钟`;
    const top = snapshot.topApps
      .slice(0, 3)
      .map((app) => `${app.label} ${app.minutes} 分钟`)
      .join("、");
    parts.push(`今天屏幕使用 ${time}${top ? `，主要是 ${top}` : ""}`);
  }
  if (snapshot.steps > 0) parts.push(`今天走了约 ${snapshot.steps} 步`);
  if (!parts.length) return "";

  return [
    `【设备状态】${parts.join("；")}。`,
    "这些数据只在本机读取，用于你更具体地关心或轻松地调侃（例如熬夜、久坐、刷太久）。",
    "自然提起即可，不要每次都提，不要像监控报告；如果用户明显在赶截止日期，别拿这个开玩笑。",
  ].join("");
}
