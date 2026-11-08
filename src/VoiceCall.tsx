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

/** 按句切分，打断时才能「从下一句接着念」。 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?…；;\n])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 语音通话浮层。
 *
 * 像打电话：说话 → 它答 → 说完自动接着听。
 * 它念的时候你可以直接开口打断；打断只是暂停，不会丢掉剩下的内容——
 * 你不说话，它会从被中断的那一句接着念完。
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
  busy: boolean;
  reply: string;
  breezeKey: string;
  breezeVoice: string;
  onFinal: (text: string) => void;
  onClose: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState("");
  const [paused, setPaused] = useState(false);
  const [barged, setBarged] = useState(false);
  const spokenRef = useRef("");
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  // 播报队列：按句排队；打断时保留，稍后接着念
  const queueRef = useRef<string[]>([]);
  const stoppedRef = useRef(false);
  const speakingRef = useRef(false);
  const spokenTextRef = useRef("");
  const resumeTimerRef = useRef<number | null>(null);

  const bargeIn = () => {
    stoppedRef.current = true;
    stopSpeaking();
    setSpeaking(false);
    setBarged(true);
    void haptic("medium");
    // 用户只是插一句、没有继续说的话，2.6 秒后把剩下的念完
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      if (queueRef.current.length > 0) void runQueue();
    }, 2600);
  };

  const speech = useSpeechInput(
    (partial) => {
      if (!speakingRef.current) return;
      const said = partial.trim().replace(/\s+/g, "");
      if (said.length < 4) return;
      // 回声防护：识别到的就是正在念的内容，说明喇叭串进了麦克风
      const playing = spokenTextRef.current.replace(/\s+/g, "");
      if (playing.includes(said) || said.includes(playing.slice(0, 6))) return;
      bargeIn();
    },
    (text) => {
      // 用户真的说了新内容：放弃剩下的播报，进入新一轮
      queueRef.current = [];
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      finalRef.current(text);
    },
  );

  speakingRef.current = speaking;
  const native = isNativeExtrasSupported();

  const runQueue = async () => {
    if (!breezeKey.trim()) {
      setNote("没填 Breeze key，先只能看文字");
      return;
    }
    stoppedRef.current = false;
    setBarged(false);
    setNote("");
    setSpeaking(true);
    while (queueRef.current.length > 0) {
      const sentence = queueRef.current[0];
      spokenTextRef.current = sentence;
      try {
        await speakAndWait(sentence, {
          apiKey: breezeKey,
          voiceId: breezeVoice,
        });
      } catch {
        setNote("朗读失败，检查 Breeze key 或网络");
        break;
      }
      if (stoppedRef.current) {
        // 被打断：当前位置不动，之后从这里继续
        setSpeaking(false);
        return;
      }
      queueRef.current.shift();
    }
    queueRef.current = [];
    setSpeaking(false);
  };

  /* ── 收到新回复：重新排一份播报队列 ───────────── */
  useEffect(() => {
    if (!open || busy || !reply) return;
    if (reply === spokenRef.current) return;
    spokenRef.current = reply;
    queueRef.current = splitSentences(reply);
    void runQueue();
    return () => {
      stoppedRef.current = true;
      stopSpeaking();
    };
  }, [open, busy, reply, breezeKey, breezeVoice]);

  /* ── 自动接着听（说话时也要听着，否则没法打断）── */
  useEffect(() => {
    if (!open) return;
    if (paused || busy || speech.listening || speech.error) return;
    const timer = window.setTimeout(() => speech.start(), 420);
    return () => window.clearTimeout(timer);
  }, [open, paused, busy, speech.listening, speech.error]);

  /* ── 开合 ──────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      spokenRef.current = "";
      queueRef.current = [];
      setNote("");
      setPaused(false);
      setBarged(false);
      stopSpeaking();
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
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
      ? "正在说，开口就能打断"
      : phase === "thinking"
        ? "正在整理你说的话"
        : phase === "listening"
          ? barged
            ? "你说，我在听"
            : "在听你说"
          : phase === "paused"
            ? "已暂停"
            : "马上就开始听";

  return (
    <div className="wr-call" role="dialog" aria-label="语音通话">
      <button className="wr-call-close" aria-label="结束通话" onClick={onClose}>
        <ChevronDown size={20} />
        <span>结束</span>
      </button>

      <div className="wr-call-body">
        <div className={`wr-call-stage ${phase}`}>
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
          disabled={busy}
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
