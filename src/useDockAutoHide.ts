import { useEffect, useState } from "react";

/**
 * 底部 dock（输入框 + 导航）的自动收起。
 *
 * 参考酷安 / 苹果音乐的做法：内容往下滚时收起，往上滚时回来，
 * 回到顶部一定显示。这样长列表（聊天记录、课表）不会被底部这条挡着，
 * 但用户想发消息时只要往回滚一点，它就回来了。
 *
 * 只做「方向 + 累计位移」判断，不做逐帧计算：
 * 手指轻微抖动不会触发，快速滑动才收起。
 */
export function useDockAutoHide(enabled = true): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }

    let lastY = 0;
    let accumulated = 0;

    const readY = (target: EventTarget | null): number => {
      if (target instanceof HTMLElement) return target.scrollTop;
      return window.scrollY;
    };

    const onScroll = (event: Event) => {
      const y = readY(event.target);
      const delta = y - lastY;
      lastY = y;

      // 贴顶时永远显示，避免在顶部附近来回抖
      if (y < 32) {
        accumulated = 0;
        setHidden(false);
        return;
      }

      accumulated = delta > 0
        ? Math.max(0, accumulated + delta)
        : Math.min(0, accumulated + delta);

      if (accumulated > 32) {
        accumulated = 0;
        setHidden(true);
      } else if (accumulated < -24) {
        accumulated = 0;
        setHidden(false);
      }
    };

    // 捕获阶段监听：聊天页的滚动发生在内层 .wr-chat-scroll 上
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [enabled]);

  return hidden;
}
