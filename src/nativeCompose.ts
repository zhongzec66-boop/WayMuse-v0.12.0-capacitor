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
  onVoice: () => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
}): boolean {
  const { enabled, hidden, text, placeholder } = options;
  const [active, setActive] = useState(false);

  // 回调放 ref，避免每次渲染重建监听
  const handlers = useRef(options);
  handlers.current = options;

  // 原生回传的文本，用来打断「原生 → JS → 原生」的回写循环
  const lastFromNative = useRef<string | null>(null);

  // 事件监听
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
        lastFromNative.current = next;
        handlers.current.onTextChange(next);
      }),
    );
    track(
      NativeCompose.addListener("composeSubmit", ({ text: next }) => {
        lastFromNative.current = next;
        handlers.current.onTextChange(next);
        handlers.current.onSubmit();
      }),
    );
    track(
      NativeCompose.addListener("composeAttach", () => {
        handlers.current.onAttach();
      }),
    );
    track(
      NativeCompose.addListener("composeVoice", () => {
        handlers.current.onVoice();
      }),
    );
    // 长按说话：按下开始识别，松手结束
    track(
      NativeCompose.addListener("composeVoiceStart", () => {
        handlers.current.onVoiceStart?.();
      }),
    );
    track(
      NativeCompose.addListener("composeVoiceEnd", () => {
        handlers.current.onVoiceEnd?.();
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

    const bounds = measure(COMPOSE_SLOT_ID);
    if (!bounds) {
      setActive(false);
      return;
    }

    const show = () =>
      NativeCompose.showComposeBar({
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

  // 文本同步到原生
  useEffect(() => {
    if (!active) return;
    if (lastFromNative.current === text) {
      lastFromNative.current = null;
      return;
    }
    void NativeCompose.setComposeText({ text }).catch(() => undefined);
  }, [active, text]);

  return active;
}
