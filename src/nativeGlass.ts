import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * 原生玻璃栏的桥接预留位。
 *
 * 现在的插件（@ajuarezso/capacitor-liquid-glass 0.8.0）没有收缩 API，
 * 所以这里只是「坑位」：未来自己 fork 加一个 `setMinimizeState` 方法后，
 * JS 侧不用改，直接实现 Swift 即可。
 */

type MinimizeOptions = { minimized: boolean };

type GlassBridge = {
  setMinimizeState?: (options: MinimizeOptions) => Promise<void>;
};

// registerPlugin 对不存在的方法返回会 reject 的代理，因此调用处必须 catch
const Glass = registerPlugin<GlassBridge>("LiquidGlass");

export function canMinimizeNativeBar(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("LiquidGlass") &&
    typeof (Glass as GlassBridge).setMinimizeState === "function"
  );
}

/** 通知原生栏收缩/展开；插件未实现时静默忽略 */
export function setNativeTabBarMinimized(minimized: boolean): void {
  if (!Capacitor.isPluginAvailable("LiquidGlass")) return;
  const api = Glass as GlassBridge;
  if (typeof api.setMinimizeState !== "function") return;
  void api.setMinimizeState({ minimized }).catch(() => undefined);
}
