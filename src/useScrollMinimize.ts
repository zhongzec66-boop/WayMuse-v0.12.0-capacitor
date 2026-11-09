import { useEffect, useRef, useState } from "react";
import { setNativeTabBarMinimized } from "./nativeGlass";

/**
 * 滚动方向 → 底部栏收缩/展开。
 *
 * 机制：
 * - 向下累计 50px → 收起；向上累计 24px → 展开；回到顶部一定展开
 * - rAF 节流：一帧最多算一次，滚动过程中不重复 setState
 * - 捕获阶段监听：聊天页的滚动发生在内层 .wr-chat-scroll 上
 *
 * 为什么向上阈值更小：用户想「找输入框」时会小幅回滚，
 * 阈值太大就会觉得「我明明往上滑了它还不出来」。
 */
export function useScrollMinimize(options: {
  enabled?: boolean;
  /** 向下滚动多少像素触发收起 */
  downThreshold?: number;
  /** 向上滚动多少像素触发展开 */
  upThreshold?: number;
} = {}): { minimized: boolean; direction: "up" | "down" | "idle" } {
  const { enabled = true, downThreshold = 50, upThreshold = 24 } = options;
  const [minimized, setMinimized] = useState(false);
  const [direction, setDirection] = useState<"up" | "down" | "idle">("idle");

  // 用 ref 保存可变量，避免每次 setState 都重建监听
  const state = useRef({ lastY: 0, acc: 0, raf: 0, minimized: false, dir: "idle" as "up" | "down" | "idle" });

  useEffect(() => {
    if (!enabled) {
      state.current.minimized = false;
      setMinimized(false);
      setNativeTabBarMinimized(false);
      return;
    }

    const s = state.current;

    const apply = (next: boolean, dir: "up" | "down" | "idle") => {
      if (s.dir !== dir) {
        s.dir = dir;
        setDirection(dir);
      }
      if (s.minimized === next) return;
      s.minimized = next;
      setMinimized(next);
      // 预留的原生桥接：插件没实现时静默忽略
      setNativeTabBarMinimized(next);
    };

    const readY = (target: EventTarget | null): number =>
      target instanceof HTMLElement ? target.scrollTop : window.scrollY;

    const onScroll = (event: Event) => {
      if (s.raf) return; // 节流：一帧只处理一次
      const y = readY(event.target);

      s.raf = requestAnimationFrame(() => {
        s.raf = 0;
        const delta = y - s.lastY;
        s.lastY = y;

        // 贴顶：一定展开，避免在顶部附近抖动
        if (y < 32) {
          s.acc = 0;
          apply(false, "idle");
          return;
        }

        if (delta === 0) return;

        s.acc = delta > 0 ? Math.max(0, s.acc + delta) : Math.min(0, s.acc + delta);

        if (s.acc > downThreshold) {
          s.acc = 0;
          apply(true, "down");
        } else if (s.acc < -upThreshold) {
          s.acc = 0;
          apply(false, "up");
        }
      });
    };

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [enabled, downThreshold, upThreshold]);

  return { minimized, direction };
}
