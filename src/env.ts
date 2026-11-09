import { Capacitor } from "@capacitor/core";

/**
 * 运行环境判定。
 *
 * 关键点：不要只判断 `isNativePlatform()`。
 * 装了 App 但原生插件没注册成功时（模拟器、旧包、插件加载失败），
 * 必须退回网页形态，否则会出现「网页不渲染 + 原生也没画」的空窗。
 */

/** "ios" | "android" | "web" */
export const platform = Capacitor.getPlatform();
export const isNative = Capacitor.isNativePlatform();

export const hasNativeTabs =
  isNative && Capacitor.isPluginAvailable("LiquidGlass");

export const hasNativeCompose =
  isNative && Capacitor.isPluginAvailable("NativeCompose");

/** 调试开关：?web=1 强制走浏览器形态（真机上也能对比） */
const forceWeb =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("web") === "1";

export const useWebDock = forceWeb || !isNative;

/** 原生形态下是否接管底部：插件齐全才接管 */
/** 调试开关：?native=1 在浏览器里渲染原生形态的 DOM（只验结构，不验玻璃） */
const forceNative =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("native") === "1";

export const useNativeDock = forceNative || (!useWebDock && hasNativeCompose);
