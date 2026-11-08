import { haptic, isNativeExtrasSupported } from "./nativeExtras";

/**
 * 全局触觉反馈。
 *
 * 与其在每个按钮里手写一次 haptic，不如在 document 上拦一次：任何「像按钮」
 * 的元素被按下都给一下轻震。这样新加的界面自动就有反馈，不会漏。
 *
 * 例外：带 data-no-haptic 的元素跳过——它们自己会发更合适的强度
 * （比如长按说话用 medium，避免和这里的 light 叠成两下）。
 */

let installed = false;

const INTERACTIVE =
  'button, [role="button"], a[href], summary, label, select, ' +
  'input[type="checkbox"], input[type="radio"], input[type="file"]';

export function installGlobalHaptics(): void {
  if (installed || !isNativeExtrasSupported()) return;
  installed = true;

  let last = 0;
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const hit = target.closest(INTERACTIVE);
      if (!hit) return;
      if (hit.closest("[data-no-haptic]")) return;
      if (hit.hasAttribute("disabled")) return;

      const now = Date.now();
      if (now - last < 55) return;
      last = now;
      void haptic("light");
    },
    { capture: true, passive: true },
  );
}
