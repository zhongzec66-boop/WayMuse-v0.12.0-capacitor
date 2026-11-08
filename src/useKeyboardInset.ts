import { useEffect } from "react";

/**
 * iOS 上键盘弹出时，布局视口 `window.innerHeight` 不变，只有
 * `visualViewport` 会缩小。底部对齐的弹层（新增任务/添加记忆）因此会被
 * 键盘整个盖住。
 *
 * 这里把「被键盘挡住的高度」写进 `--kb-inset`，让弹层用它把内容顶上去。
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;

    const apply = () => {
      const layout = window.innerHeight;
      const visible = vv ? vv.height + vv.offsetTop : layout;
      const inset = Math.max(0, Math.round(layout - visible));
      root.style.setProperty("--kb-inset", `${inset}px`);
    };

    apply();
    window.addEventListener("resize", apply);
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);

    return () => {
      window.removeEventListener("resize", apply);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      root.style.removeProperty("--kb-inset");
    };
  }, []);
}
