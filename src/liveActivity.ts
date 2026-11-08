import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * 灵动岛 / 锁屏实时活动的桥。
 *
 * 原生实现是 ios/App/App/LiveActivityPlugin.swift（App target），
 * 依赖同一个 Widget Extension 里编译的 WayMuseActivityAttributes。
 * 非 iOS、系统低于 16.2、或用户关掉了实时活动时全部安全降级。
 */

interface LiveActivityPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  start(options: { title: string; detail: string }): Promise<{ id: string }>;
  update(options: { title: string; detail: string }): Promise<void>;
  end(): Promise<void>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>("LiveActivity");

export function isLiveActivitySupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function startLiveActivity(
  title: string,
  detail: string,
): Promise<boolean> {
  if (!isLiveActivitySupported()) return false;
  try {
    const status = await LiveActivity.isSupported();
    if (!status.supported) return false;
    await LiveActivity.start({ title, detail });
    return true;
  } catch {
    return false;
  }
}

export async function updateLiveActivity(
  title: string,
  detail: string,
): Promise<void> {
  if (!isLiveActivitySupported()) return;
  try {
    await LiveActivity.update({ title, detail });
  } catch {
    // 更新失败不影响主流程
  }
}

export async function endLiveActivity(): Promise<void> {
  if (!isLiveActivitySupported()) return;
  try {
    await LiveActivity.end();
  } catch {
    // 同上
  }
}
