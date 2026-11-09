import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * 灵动岛 / 锁屏实时活动的桥。
 *
 * 同一时刻**只有一个**实时活动会占据灵动岛，所以这里带一个仲裁器：
 * 每个功能要先申请「占岛权」，优先级低的不会把高的顶掉。
 * 现在的优先级：专注计时（3）> 计划到期（2）> 复习倒计时（1）。
 */

interface LiveActivityPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  start(options: {
    title: string;
    detail: string;
    dueAt?: string;
  }): Promise<{ id: string }>;
  update(options: {
    title: string;
    detail: string;
    dueAt?: string;
  }): Promise<void>;
  end(): Promise<void>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>("LiveActivity");

export type IslandOwner = "focus" | "task" | "review";

const PRIORITY: Record<IslandOwner, number> = {
  focus: 3,
  task: 2,
  review: 1,
};

let currentOwner: IslandOwner | null = null;

export function isLiveActivitySupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/** 申请占岛权：返回 false 表示当前有更高优先级的功能在用 */
export function claimIsland(owner: IslandOwner): boolean {
  if (currentOwner && currentOwner !== owner) {
    if (PRIORITY[owner] < PRIORITY[currentOwner]) return false;
  }
  currentOwner = owner;
  return true;
}

export function releaseIsland(owner: IslandOwner): void {
  if (currentOwner === owner) currentOwner = null;
}

export function islandOwner(): IslandOwner | null {
  return currentOwner;
}

export async function startLiveActivity(
  owner: IslandOwner,
  title: string,
  detail: string,
  dueAt?: string,
): Promise<boolean> {
  if (!isLiveActivitySupported()) return false;
  if (!claimIsland(owner)) return false;
  try {
    const status = await LiveActivity.isSupported();
    if (!status.supported) return false;
    await LiveActivity.start({ title, detail, dueAt });
    return true;
  } catch {
    return false;
  }
}

export async function updateLiveActivity(
  owner: IslandOwner,
  title: string,
  detail: string,
  dueAt?: string,
): Promise<void> {
  if (!isLiveActivitySupported()) return;
  if (currentOwner && currentOwner !== owner) return;
  currentOwner = owner;
  try {
    await LiveActivity.update({ title, detail, dueAt });
  } catch {
    // 更新失败不影响主流程
  }
}

export async function endLiveActivity(owner?: IslandOwner): Promise<void> {
  if (!isLiveActivitySupported()) return;
  if (owner) releaseIsland(owner);
  if (owner && currentOwner && currentOwner !== owner) return;
  try {
    await LiveActivity.end();
  } catch {
    // 忽略
  }
}
