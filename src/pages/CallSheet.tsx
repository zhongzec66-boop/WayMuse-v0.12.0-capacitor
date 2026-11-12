import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Keyboard, PhoneOff, Volume2 } from "lucide-react";
import { CallSession, STATE_COPY } from "../call/callSession";
import type { CallState } from "../call/callSession";
import { haptic } from "../nativeExtras";
import { useHideNativeChrome } from "../chrome";

/**
 * 语音通话半屏浮窗。
 *
 * 硬约束（来自规格与复核）：
 * - 玻璃只用 CSS backdrop-filter，绝不调用 nativeGlass 的任何方法
 * - 状态胶囊 / 字幕 / 波形必须是浮窗 DOM 的子元素，渲染在玻璃层之上
 * - 320ms：sheet 升起、聊天页胶囊头像淡出、浮窗头像 scale(0.6→1)
 */

export type CallSheetProps = {
  open: boolean;
  /** 正在播的 TTS 句子（字幕区显示当前这一句） */
  subtitle: string;
  /** 用户识别的实时文字 */
  heard: string;
  muted: boolean;
  onToggleMute: () => void;
  onCollapse: () => void;
  onHangup: (durationSec: number) => void;
  /** 播报时说话状态由外部驱动；这里只负责展示 */
  externalState?: CallState;
  /** 结束语（挂断后给系统卡用） */
  onSpeakLastReply?: () => void;
};

function formatDuration(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CallSheet({
  open,
  subtitle,
  heard,
  muted,
  onToggleMute,
  onCollapse,
  onHangup,
  externalState,
}: CallSheetProps) {
  const [state, setState] = useState<CallState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [nudge, setNudge] = useState(false);
  const sessionRef = useRef<CallSession | null>(null);

  // 原生 Tab 栏 / 输入框会让位（iOS 上它们画在 WebView 之上）
  useHideNativeChrome(open);

  /* 通话期间藏掉底部 Dock：玻璃再透，也不该让输入框和 Tab 栏透上来 */
  useEffect(() => {
    document.body.classList.toggle("wr-in-call", open);
    return () => document.body.classList.remove("wr-in-call");
  }, [open]);

  /* 状态机：speaking → listening 时震一下，这是「轮到你了」的唯一信号 */
  useEffect(() => {
    if (!open) {
      sessionRef.current?.hangup();
      sessionRef.current = null;
      setState("idle");
      setSeconds(0);
      setNudge(false);
      return;
    }

    const session = new CallSession({
      onState: (next) => setState(next),
      onTurnEnd: () => void haptic("light"),
      onNudge: () => setNudge(true),
      onHangup: () => {
        const duration = session.durationSec();
        session.hangup();
        onHangup(duration);
      },
    });
    sessionRef.current = session;
    session.start();

    const timer = setInterval(() => setSeconds(session.durationSec()), 1000);
    return () => {
      clearInterval(timer);
      session.hangup();
      sessionRef.current = null;
    };
  }, [open, onHangup]);

  /* 外部（TTS）驱动的状态 */
  useEffect(() => {
    const session = sessionRef.current;
    if (!session || !externalState) return;
    if (externalState === "speaking") session.modelSpeaking();
    if (externalState === "listening") session.modelDone();
    if (externalState === "thinking") session.userDone();
  }, [externalState]);

  const display =
    nudge && state === "listening" ? "还在吗？" : STATE_COPY[state];
  const caption = useMemo(() => {
    if (state === "listening")
      return heard.trim() || (nudge ? "还在吗？" : "我在听，你说");
    if (state === "interrupted") return heard.trim() || "你说，我在听";
    if (state === "thinking") return heard.trim() || "想一下…";
    return subtitle.trim() || "…";
  }, [state, heard, subtitle, nudge]);

  const hangup = useCallback(() => {
    const session = sessionRef.current;
    const duration = session?.durationSec() ?? seconds;
    session?.hangup();
    onHangup(duration);
  }, [onHangup, seconds]);

  if (!open) return null;

  return createPortal(
    <div className="wr-call-mask" data-state={state}>
      <section
        className="wr-call-sheet"
        data-state={state}
        role="dialog"
        aria-label="语音通话"
      >
        <div className="wr-call-sheet-bg" aria-hidden="true" />

        <div className="wr-call-content">
          <div className="wr-call-handle" aria-hidden="true" />

          <div className="wr-call-head">
            <span className="wr-call-duration">{formatDuration(seconds)}</span>
          </div>

          <div className="wr-call-avatar" data-state={state}>
            <div className="wr-call-face">
              <span className="wr-call-eye left" />
              <span className="wr-call-eye right" />
            </div>
            <span className="wr-call-ring" aria-hidden="true" />
          </div>

          <div className="wr-call-status" data-state={state}>
            <span className="wr-call-dot" aria-hidden="true" />
            {display}
          </div>

          <p className="wr-call-caption">{caption}</p>

          <div className="wr-call-wave" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                key={index}
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
          </div>

          <div className="wr-call-actions">
            <button
              type="button"
              className={muted ? "wr-call-action on" : "wr-call-action"}
              onClick={onToggleMute}
              aria-label={muted ? "取消静音" : "静音"}
            >
              {muted ? <MicOff size={20} /> : <Mic size={20} />}
              <small>{muted ? "已静音" : "静音"}</small>
            </button>

            <button
              type="button"
              className="wr-call-action"
              onClick={onCollapse}
              aria-label="打字"
            >
              <Keyboard size={20} />
              <small>打字</small>
            </button>

            <button
              type="button"
              className="wr-call-action hangup"
              onClick={hangup}
              aria-label="挂断"
            >
              <PhoneOff size={20} />
              <small>挂断</small>
            </button>
          </div>

          <p className="wr-call-hint">
            <Volume2 size={12} /> 说话直接打断我；安静 30 秒会自动挂断
          </p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
