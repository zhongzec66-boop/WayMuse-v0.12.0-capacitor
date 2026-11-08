import { useLayoutEffect } from "react";
import type { MutableRefObject, RefObject } from "react";

type Body = {
  el: HTMLElement;
  id: string;
  w: number;
  h: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dragging: boolean;
};

const DRIFT = 0.42; // 每秒的漂移基准
const DAMPING = 0.995;
const MIN_SPEED = 0.14;
const TAP_SLOP = 6;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * 记忆气泡的「小物理场」。
 *
 * 每个气泡是一个圆角胶囊，用 AABB 做碰撞：重叠时沿重叠较小的轴推开，
 * 并交换那根轴上的速度 —— 便宜、稳定，视觉上够像一回事。
 * 拖拽时暂时退出物理，松手后把拖拽结束时的速度还给场。
 *
 * 全部写在 ref 里、直接改 transform，不走 React state，避免每帧重渲染。
 * `prefers-reduced-motion` 下只摆一次位置，不跑循环。
 */
export function useBubbleField(
  fieldRef: RefObject<HTMLDivElement | null>,
  count: number,
  onTap: MutableRefObject<(id: string) => void>,
): void {
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const nodes = Array.from(
      field.querySelectorAll<HTMLElement>("[data-bubble]"),
    );
    if (!nodes.length) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const W = field.clientWidth;
    const H = field.clientHeight;

    // 先按「流式排版」摆一遍：保证初始状态不重叠，
    // 之后再交给物理把彼此推开、漂起来。
    const MARGIN = 10;
    const GAP = 8;
    let cursorX = MARGIN;
    let cursorY = MARGIN;
    let rowHeight = 0;

    const bodies: Body[] = nodes.map((el, i) => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (cursorX + w > W - MARGIN) {
        cursorX = MARGIN;
        cursorY += rowHeight + GAP;
        rowHeight = 0;
      }
      const x = clamp(cursorX, 0, Math.max(0, W - w));
      const y = clamp(cursorY, 0, Math.max(0, H - h));
      cursorX += w + GAP;
      rowHeight = Math.max(rowHeight, h);

      return {
        el,
        id: el.dataset.bubble ?? String(i),
        w,
        h,
        x,
        y,
        vx: (i % 2 === 0 ? 1 : -1) * DRIFT,
        vy: (i % 3 === 0 ? -1 : 1) * DRIFT * 0.8,
        dragging: false,
      };
    });

    const paint = (b: Body) => {
      b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
    };

    const cleanups: Array<() => void> = [];

    bodies.forEach((b) => {
      let pointerId: number | null = null;
      let startX = 0;
      let startY = 0;
      let originX = 0;
      let originY = 0;
      let moved = 0;

      const onDown = (e: PointerEvent) => {
        pointerId = e.pointerId;
        b.dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        originX = b.x;
        originY = b.y;
        moved = 0;
        b.el.setPointerCapture(e.pointerId);
        b.el.style.zIndex = "10";
        b.el.style.cursor = "grabbing";
        e.preventDefault();
      };

      const onMove = (e: PointerEvent) => {
        if (pointerId !== e.pointerId || !b.dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        moved = Math.max(moved, Math.hypot(dx, dy));
        b.x = clamp(originX + dx, 0, Math.max(0, W - b.w));
        b.y = clamp(originY + dy, 0, Math.max(0, H - b.h));
        paint(b);
      };

      const onUp = (e: PointerEvent) => {
        if (pointerId !== e.pointerId) return;
        b.dragging = false;
        pointerId = null;
        b.el.style.zIndex = "";
        b.el.style.cursor = "";
        if (moved >= TAP_SLOP) {
          // 拖过就别再触发 click 打开详情，同时把惯性还给场
          b.el.dataset.suppressClick = "1";
          b.vx = clamp((e.clientX - startX) * 0.05, -6, 6) || b.vx;
          b.vy = clamp((e.clientY - startY) * 0.05, -6, 6) || b.vy;
        }
      };

      // 点按走原生 click（键盘 Enter/Space 也能触发），拖拽后抑制掉
      const onClick = (e: MouseEvent) => {
        if (b.el.dataset.suppressClick === "1") {
          delete b.el.dataset.suppressClick;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onTap.current(b.id);
      };

      b.el.addEventListener("pointerdown", onDown);
      b.el.addEventListener("pointermove", onMove);
      b.el.addEventListener("pointerup", onUp);
      b.el.addEventListener("pointercancel", onUp);
      b.el.addEventListener("click", onClick);
      cleanups.push(() => {
        b.el.removeEventListener("pointerdown", onDown);
        b.el.removeEventListener("pointermove", onMove);
        b.el.removeEventListener("pointerup", onUp);
        b.el.removeEventListener("pointercancel", onUp);
        b.el.removeEventListener("click", onClick);
      });
    });

    bodies.forEach(paint);

    if (reduce) {
      return () => cleanups.forEach((fn) => fn());
    }

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(32, now - last) / 16.67; // 归一到 60fps 的步长
      last = now;

      for (const b of bodies) {
        if (b.dragging) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vx *= DAMPING;
        b.vy *= DAMPING;

        // 快停下时补一点随机漂移，让场子一直「活着」
        if (Math.hypot(b.vx, b.vy) < MIN_SPEED) {
          b.vx += (Math.random() - 0.5) * 0.09;
          b.vy += (Math.random() - 0.5) * 0.09;
        }

        if (b.x < 0) {
          b.x = 0;
          b.vx = Math.abs(b.vx);
        } else if (b.x + b.w > W) {
          b.x = W - b.w;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y < 0) {
          b.y = 0;
          b.vy = Math.abs(b.vy);
        } else if (b.y + b.h > H) {
          b.y = H - b.h;
          b.vy = -Math.abs(b.vy);
        }
      }

      // 两两碰撞
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const a = bodies[i];
          const b = bodies[j];
          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;

          if (overlapX < overlapY) {
            const push = overlapX / 2 + 0.4;
            const dir = a.x < b.x ? -1 : 1;
            if (!a.dragging) a.x += dir * push;
            if (!b.dragging) b.x -= dir * push;
            if (!a.dragging && !b.dragging) {
              const tv = a.vx;
              a.vx = b.vx;
              b.vx = tv;
            }
          } else {
            const push = overlapY / 2 + 0.4;
            const dir = a.y < b.y ? -1 : 1;
            if (!a.dragging) a.y += dir * push;
            if (!b.dragging) b.y -= dir * push;
            if (!a.dragging && !b.dragging) {
              const tv = a.vy;
              a.vy = b.vy;
              b.vy = tv;
            }
          }
        }
      }

      bodies.forEach(paint);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    };
  }, [fieldRef, count, onTap]);
}
