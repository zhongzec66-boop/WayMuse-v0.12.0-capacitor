import { useEffect } from "react";

/**
 * 原生 UI 的显隐开关。
 *
 * iOS 上 Tab 栏和输入框是**盖在 WebView 之上的原生视图**，网页层做的浮层
 * （编辑器、菜单、弹窗）永远画不到它们上面。所以任何铺满屏幕的网页浮层
 * 打开时，都必须先让原生 UI 让位。
 *
 * 用引用计数而不是布尔值：可能同时有多个浮层在切换。
 */

let count = 0;
const listeners = new Set<(hidden: boolean) => void>();

function notify(): void {
  const hidden = count > 0;
  listeners.forEach((listener) => listener(hidden));
}

export function pushChromeHide(): void {
  count += 1;
  notify();
}

export function popChromeHide(): void {
  count = Math.max(0, count - 1);
  notify();
}

export function subscribeChrome(
  listener: (hidden: boolean) => void,
): () => void {
  listeners.add(listener);
  listener(count > 0);
  return () => {
    listeners.delete(listener);
  };
}

/** 浮层打开时调用，打开期间原生 Tab 栏和输入框会让位。 */
export function useHideNativeChrome(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    pushChromeHide();
    return popChromeHide;
  }, [active]);
}
