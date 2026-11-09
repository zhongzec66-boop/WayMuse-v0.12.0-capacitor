import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";

/**
 * 原生聊天输入框（iOS）。
 *
 * 原生侧由 `patches/liquid-glass/NativeComposePlugin.swift` 提供，
 * 通过 postinstall 注入到已链接的 SPM 插件 target 里。
 * Web / Android / 插件缺失时，调用会 reject，调用方自动回退到网页输入框。
 */

export interface ComposeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShowComposeOptions {
  bounds: ComposeBounds;
  placeholder?: string;
  text?: string;
  tintColor?: string;
  enabled?: boolean;
}

interface NativeComposePlugin {
  showComposeBar(options: ShowComposeOptions): Promise<void>;
  hideComposeBar(): Promise<void>;
  setComposeBounds(options: { bounds: ComposeBounds }): Promise<void>;
  setComposeText(options: { text: string }): Promise<void>;
  addListener(
    eventName: "composeTextChanged",
    listener: (event: { text: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "composeSubmit",
    listener: (event: { text: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName:
      | "composeAttach"
      | "composeVoice"
      | "composeVoiceStart"
      | "composeVoiceEnd",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}

const NativeCompose = registerPlugin<NativeComposePlugin>("NativeCompose");

export const COMPOSE_SLOT_ID = "waymuse-compose-slot";

export function isNativeComposeSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function measure(slotId: string): ComposeBounds | null {
  const element = document.getElementById(slotId);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function tintColor(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim() || "#1f4d3a"
  );
}

export function useNativeCompose(options: {
  enabled: boolean;
  hidden: boolean;
  text: string;
  placeholder: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onAttach: () => void;
}): boolean {
  const { enabled, hidden, text, placeholder } = options;
  const [active, setActive] = useState(false);

  // 回调放 ref，避免每次渲染重建监听
  const handlers = useRef(options);
  handlers.current = options;

  // 原生最近一次回传的文本。用来打断「原生 → JS → 原生」的写回循环：
  // 之前是消费式（比对一次就清空），打字快的时候会把旧值写回原生，
  // 表现为光标跳到末尾、后面的字被吞掉 —— 改成持久记录，只跳过真正的回声。
  const lastNativeText = useRef<string | null>(null);

  // 浜嬩欢鐩戝惉
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const handles: PluginListenerHandle[] = [];
    const track = (promise: Promise<PluginListenerHandle>) => {
      void promise
        .then((handle) => {
          if (disposed) void handle.remove();
          else handles.push(handle);
        })
        .catch(() => undefined);
    };

    track(
      NativeCompose.addListener("composeTextChanged", ({ text: next }) => {
        lastNativeText.current = next;
        handlers.current.onTextChange(next);
      }),
    );
    track(
      NativeCompose.addListener("composeSubmit", ({ text: next }) => {
        lastNativeText.current = next;
        handlers.current.onTextChange(next);
        handlers.current.onSubmit();
      }),
    );
    track(
      NativeCompose.addListener("composeAttach", () => {
        handlers.current.onAttach();
      }),
    );

    return () => {
      disposed = true;
      handles.forEach((handle) => void handle.remove());
    };
  }, [enabled]);

  // 显示 / 隐藏 + 跟随布局
  useEffect(() => {
    if (!enabled) return;
    if (hidden) {
      void NativeCompose.hideComposeBar().catch(() => undefined);
      setActive(false);
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let retryId: number | null = null;

    const sync = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const bounds = measure(COMPOSE_SLOT_ID);
        if (!bounds) return;
        void NativeCompose.setComposeBounds({ bounds }).catch(() => undefined);
      });
    };

    const attachObservers = () => {
      const slot = document.getElementById(COMPOSE_SLOT_ID);
      if (slot && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(sync);
        resizeObserver.observe(slot);
      }
      window.addEventListener("scroll", sync, { passive: true, capture: true });
      window.addEventListener("resize", sync, { passive: true });
      window.addEventListener("orientationchange", sync, { passive: true });
      window.visualViewport?.addEventListener("resize", sync);
      window.visualViewport?.addEventListener("scroll", sync);
    };

    // 每次显示前都重新测一次：dock 可能刚做过滚动收起/展开的位移动画，
    // 用旧的矩形会让原生输入框「停在以前的位置」——看起来就像旧的聊天框又冒出来了。
    const show = () => {
      const bounds = measure(COMPOSE_SLOT_ID);
      if (!bounds) {
        setActive(false);
        return Promise.resolve();
      }
      return NativeCompose.showComposeBar({
        bounds,
        placeholder,
        text,
        tintColor: tintColor(),
        enabled: true,
      })
        .then(() => {
          if (cancelled) {
            void NativeCompose.hideComposeBar().catch(() => undefined);
            return;
          }
          setActive(true);
          attachObservers();
          // 显示后立刻对齐一次，覆盖动画中途的位移
          sync();
        })
        .catch(() => {
          if (cancelled) return;
          setActive(false);
          // 插件可能比页面晚注册：给一次重试机会
          retryId = window.setTimeout(() => {
            retryId = null;
            if (!cancelled) void show();
          }, 600);
        });
    };

    void show();

    return () => {
      cancelled = true;
      if (retryId != null) window.clearTimeout(retryId);
      if (rafId != null) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", sync, { capture: true });
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      void NativeCompose.hideComposeBar().catch(() => undefined);
      setActive(false);
    };
    // text / placeholder 变化不重建浮层，交给下面的同步 effect
  }, [enabled, hidden]);

  // 文本同步到原生：只在「JS 主动改了文本」时回写。
  // 打字时原生已经把内容推上来了，再写回去会重置光标、吞掉后面的字。
  useEffect(() => {
    if (!active) return;
    if (lastNativeText.current === text) return;
    void NativeCompose.setComposeText({ text }).catch(() => undefined);
    lastNativeText.current = text;
  }, [active, text]);

  return active;
}
