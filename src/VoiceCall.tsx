import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff } from "lucide-react";
import BotAvatar from "./BotAvatar";
import { speakAndWait, stopSpeaking } from "./breeze";
import {
  endLiveActivity,
  startLiveActivity,
  updateLiveActivity,
} from "./liveActivity";
import { haptic, isNativeExtrasSupported } from "./nativeExtras";
import { useSpeechInput } from "./useSpeechInput";

/**
 * 语音通话浮层。
 *
 * 一个最小闭环：听 → 提交 → 等回复 → 念出来 → 继续听。
 * 不额外造一条对话通道，直接复用聊天页已有的 submit 与 streaming 状态，
 * 所以历史和上下文都跟文字对话一致。
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
  const spokenRef = useRef("");
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  // 通话模式下不做逐字回填，拿到 final 一次性提交
  const speech = useSpeechInput(
    () => undefined,
    (text) => finalRef.current(text),
  );

  // 说完了就念回复
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

  // 进入通话就开始听，同时把状态推到灵动岛/锁屏
  useEffect(() => {
    if (!open) {
      spokenRef.current = "";
      setNote("");
      stopSpeaking();
      void endLiveActivity();
      return;
    }
    void haptic("medium");
    void startLiveActivity("正在通话", "点一下屏幕回来说话");
  }, [open]);

  // 状态变化时更新实时活动
  useEffect(() => {
    if (!open) return;
    const detail = speaking ? "正在说" : busy ? "正在想" : "在听你说";
    void updateLiveActivity("WayMuse 通话中", detail);
  }, [open, speaking, busy]);

  if (!open) return null;

  const status = speaking
    ? "正在说…"
    : busy
      ? "正在想…"
      : speech.listening
        ? "在听你说"
        : "点麦克风开始说";

  return (
    <div className="wr-call" role="dialog" aria-label="语音通话">
      <div className="wr-call-body">
        <BotAvatar
          className="wr-call-face"
          replying={busy || speaking}
          mood={speaking ? "happy" : busy ? "thinking" : "idle"}
        />
        <p className="wr-call-status">{status}</p>
        {note && <p className="wr-call-note">{note}</p>}
        {!isNativeExtrasSupported() && (
          <p className="wr-call-note">
            语音识别只在 iOS App 内可用；这里可以先看文字。
          </p>
        )}
      </div>

      <div className="wr-call-actions">
        <button
          className={speech.listening ? "wr-call-mic listening" : "wr-call-mic"}
          aria-label={speech.listening ? "结束这次说话" : "开始说话"}
          disabled={speaking || busy}
          onClick={() => speech.toggle()}
        >
          <Mic size={22} />
        </button>
        <button
          className="wr-call-hangup"
          aria-label="结束通话"
          onClick={onClose}
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
