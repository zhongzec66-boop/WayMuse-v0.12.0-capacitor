import { useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  cancelSpeech,
  haptic,
  isNativeExtrasSupported,
  speechEvents,
  startSpeech,
  stopSpeech,
} from "./nativeExtras";

/**
 * 聊天框右侧的「按住说话」。
 *
 * 走原生 `SFSpeechRecognizer`：说话时逐字回填到输入框，
 * 不会跳转到别的页面。识别失败或非 iOS 环境时
 * `supported` 为 false，调用方退回原来的语音录入入口。
 */
export function useSpeechInput(
  onText: (text: string) => void,
  onFinal?: (text: string) => void,
): {
  supported: boolean;
  listening: boolean;
  error: string;
  toggle: () => void;
  start: () => void;
} {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (!isNativeExtrasSupported()) return;
    let alive = true;
    const handles: PluginListenerHandle[] = [];

    const bind = async () => {
      const partial = await speechEvents.partial(({ text }) => {
        if (alive) onTextRef.current(text);
      });
      const final = await speechEvents.final(({ text }) => {
        if (!alive) return;
        onTextRef.current(text);
        setListening(false);
        // 识别到一句就主动收麦：不等系统自己结束，
        // 否则会出现「已经读完了但一直开着、点也关不掉」的状态
        void stopSpeech();
        void haptic("light");
        if (text.trim() && onFinalRef.current) onFinalRef.current(text.trim());
      });
      const failed = await speechEvents.error(({ message }) => {
        if (!alive) return;
        setListening(false);
        setError(message || "识别中断");
      });
      const cancelled = await speechEvents.cancelled(() => {
        if (alive) setListening(false);
      });
      handles.push(partial, final, failed, cancelled);
    };

    void bind().catch(() => undefined);

    return () => {
      alive = false;
      handles.forEach((handle) => void handle.remove());
      void cancelSpeech();
    };
  }, []);

  const begin = async () => {
    setError("");
    try {
      await startSpeech("zh-CN");
      setListening(true);
      void haptic("medium");
      // 兜底：60 秒还没识别出句子就自动收麦，避免一直占着麦克风
      window.setTimeout(() => {
        setListening(false);
        void stopSpeech();
      }, 60_000);
    } catch {
      setListening(false);
      setError("语音识别不可用，检查麦克风和语音识别权限");
    }
  };

  const toggle = () => {
    void (async () => {
      if (listening) {
        setListening(false);
        await stopSpeech();
        return;
      }
      await begin();
    })();
  };

  return {
    supported: isNativeExtrasSupported(),
    listening,
    error,
    toggle,
    start: () => {
      if (!isNativeExtrasSupported()) return;
      void begin();
    },
  };
}
