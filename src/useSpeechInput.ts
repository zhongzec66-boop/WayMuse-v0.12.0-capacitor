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
  stop: () => void;
} {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  // ── 断句与去重 ────────────────────────────────
  // 同一句话可能同时由「静音断句」和系统的 final 各触发一次，
  // 用这个引用挡掉重复提交。
  const committedRef = useRef({ text: "", at: 0 });
  const silenceRef = useRef<number | null>(null);

  const commit = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const now = Date.now();
    if (
      committedRef.current.text === text &&
      now - committedRef.current.at < 4000
    ) {
      return;
    }
    committedRef.current = { text, at: now };
    if (silenceRef.current) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
    onTextRef.current(text);
    setListening(false);
    void stopSpeech();
    void haptic("light");
    onFinalRef.current?.(text);
  };

  const armSilence = (text: string) => {
    if (silenceRef.current) window.clearTimeout(silenceRef.current);
    silenceRef.current = window.setTimeout(() => {
      silenceRef.current = null;
      if (text.trim()) commit(text);
    }, 1200);
  };

  useEffect(() => {
    if (!isNativeExtrasSupported()) return;
    let alive = true;
    const handles: PluginListenerHandle[] = [];

    const bind = async () => {
      const partial = await speechEvents.partial(({ text }) => {
        if (!alive) return;
        onTextRef.current(text);
        // 只有通话模式才做静音断句：中文离线识别经常不给 isFinal。
        // 长按说话由松手结束，不做静音判定，免得停顿一下就被截断。
        if (onFinalRef.current) armSilence(text);
      });
      const final = await speechEvents.final(({ text }) => {
        if (!alive) return;
        commit(text);
      });
      const failed = await speechEvents.error(({ message }) => {
        if (!alive) return;
        setListening(false);
        // 「没听到人说话」是正常收尾，不是错误：既不要报错，也别把英文原文给用户
        if (/no speech|no match|1110|recognition request/i.test(message)) {
          setError("");
          return;
        }
        setError("没听清，再说一次");
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
    committedRef.current = { text: "", at: 0 };
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
    stop: () => {
      setListening(false);
      void stopSpeech();
    },
  };
}
