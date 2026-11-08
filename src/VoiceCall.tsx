import { useEffect, useRef, useState } from "react";
import { ChevronDown, Mic, MicOff, PhoneOff } from "lucide-react";
import BotAvatar from "./BotAvatar";
import { speakAndWait, stopSpeaking } from "./breeze";
import {
  beginCallAudio,
  endAudioSession,
  endCallAudio,
  haptic,
  isNativeExtrasSupported,
} from "./nativeExtras";
import {
  endLiveActivity,
  startLiveActivity,
  updateLiveActivity,
} from "./liveActivity";
import { useSpeechInput } from "./useSpeechInput";

/**
 * 语音通话浮层。
 *
 * 目标体验是「像打电话」：说话 → 它答 → 说完自动接着听，中间不需要再按。
 * 所以这里是一个自驱的状态机：
 *   idle → listening →（识别出句子）→ thinking → speaking → listening …
 *
 * 唯一需要用户按的是麦克风（暂停/继续）和挂断。
 */
export default function VoiceCall({
  open,
  busy,
  reply,
  breezeKey,
  breezeVoice,
  onFinal,
  onClose,
}: {
  open: boolean;
  /** 聊天是否还在生成回复 */
  busy: boolean;
  /** 最新一条助手回复（已剥掉契约块）；变化时触发朗读 */
  reply: string;
  breezeKey: string;
  breezeVoice: string;
  onFinal: (text: string) => void;
  onClose: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState("");
  const [paused, setPaused] = useState(false);
  const spokenRef = useRef("");
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  // 打断用：正在念的文本、是否正在念
  const speakingRef = useRef(false);
  const spokenTextRef = useRef("");
  const [barged, setBarged] = useState(false);

  const bargeIn = () => {
    spokenRef.current = "";
    stopSpeaking();
    setSpeaking(false);
    setBarged(true);
    void haptic("medium");
  };

  // 通话模式下不做逐字回填；partial 用来判断「用户开口打断」
  const speech = useSpeechInput(
    (partial) => {
      if (!speakingRef.current) return;
      const said = partial.trim().replace(/\s+/g, "");
      if (said.length < 4) return;
      // 回声防护：如果识别到的就是正在念的内容，说明是喇叭串进麦克风
      const playing = spokenTextRef.current.replace(/\s+/g, "");
      if (playing.includes(said) || said.includes(playing.slice(0, 6))) return;
      bargeIn();
    },
    (text) => finalRef.current(text),
  );

  speakingRef.current = speaking;
  const native = isNativeExtrasSupported();

  /* ── 念回复 ─────────────────────────────────── */
  useEffect(() => {
    if (!open || busy || !reply) return;
    if (reply === spokenRef.current) return;
    spokenRef.current = reply;
    if (!breezeKey.trim()) {
      setNote("没填 Breeze key，先只能看文字");
      return;
    }
    let alive = true;
    setSpeaking(true);
    setBarged(false);
    spokenTextRef.current = reply;
    setNote("");
    void speakAndWait(reply, { apiKey: breezeKey, voiceId: breezeVoice })
      .catch(() => {
        if (alive) setNote("朗读失败，检查 Breeze key 或网络");
      })
      .finally(() => {
        if (!alive) return;
        setSpeaking(false);
        void haptic("light");
      });
    return () => {
      alive = false;
      stopSpeaking();
      setSpeaking(false);
    };
  }, [open, busy, reply, breezeKey, breezeVoice]);

  /* ── 自动接着听：说完 / 念完之后自己开麦 ─────── */
  useEffect(() => {
    if (!open) return;
    // 注意：这里**不**排除 speaking。说话时麦克风必须继续工作，
    // 否则用户没法打断（配合原生 .voiceChat 的回声消除）。
    if (paused || busy || speech.listening || speech.error) return;
    const timer = window.setTimeout(() => speech.start(), 420);
    return () => window.clearTimeout(timer);
  }, [open, paused, busy, speaking, speech.listening, speech.error]);

  /* ── 开合 ──────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      spokenRef.current = "";
      setNote("");
      setPaused(false);
      stopSpeaking();
      void endCallAudio();
      void endAudioSession();
      void endLiveActivity();
      return;
    }
    void haptic("medium");
    void beginCallAudio();
    void startLiveActivity("正在通话", "在听你说");
  }, [open]);

  /* ── 状态同步到灵动岛 ───────────────────────── */
  useEffect(() => {
    if (!open) return;
    const detail = speaking
      ? "正在说"
      : busy
        ? "正在整理"
        : speech.listening
          ? "在听你说"
          : "等你开口";
    void updateLiveActivity("WayMuse 通话中", detail);
  }, [open, speaking, busy, speech.listening]);

  if (!open) return null;

  const phase = speaking
    ? "speaking"
    : busy
      ? "thinking"
      : speech.listening
        ? "listening"
        : paused
          ? "paused"
          : "idle";

  const status =
    phase === "speaking"
      ? "正在说…（开口就能打断）"
      : phase === "thinking"
        ? "正在整理你说的话…"
        : phase === "listening"
          ? barged
            ? "你说，我在听"
            : "在听你说"
          : phase === "paused"
            ? "已暂停，点麦克风继续"
            : "马上就开始听";

  return (
    <div className="wr-call" role="dialog" aria-label="语音通话">
      <button className="wr-call-close" aria-label="结束通话" onClick={onClose}>
        <ChevronDown size={20} />
        <span>结束</span>
      </button>

      <div className="wr-call-body">
        <div className={`wr-call-stage ${phase}`}>
          {/* 波纹：收音时向外扩，说话时呼吸 */}
          <span className="wr-call-ring r1" aria-hidden="true" />
          <span className="wr-call-ring r2" aria-hidden="true" />
          <span className="wr-call-ring r3" aria-hidden="true" />
          <BotAvatar
            className="wr-call-face"
            replying={busy || speaking}
            mood={speaking ? "happy" : busy ? "thinking" : "idle"}
          />
        </div>

        <p className="wr-call-status" aria-live="polite">
          {phase === "thinking" && <span className="wr-call-spinner" />}
          {status}
        </p>
        {note && <p className="wr-call-note">{note}</p>}
        {!native && (
          <p className="wr-call-note">
            语音识别只在 iOS App 内可用；这里可以先看文字。
          </p>
        )}
      </div>

      <div className="wr-call-actions">
        <button
          className={speech.listening ? "wr-call-mic listening" : "wr-call-mic"}
          aria-label={paused ? "继续说话" : "暂停听"}
          disabled={speaking || busy}
          onClick={() => {
            if (paused) {
              setPaused(false);
              speech.start();
              return;
            }
            setPaused(true);
            speech.toggle();
          }}
        >
          {paused ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button className="wr-call-hangup" aria-label="挂断" onClick={onClose}>
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
