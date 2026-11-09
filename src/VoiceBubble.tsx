import { Volume2 } from "lucide-react";
import type { VoiceState } from "./voiceMessage";

/**
 * 语音气泡：波形 + 时长 + 播放状态。
 *
 * 交互：没合成过 → 点一下合成并播放；已合成 → 点一下播放/停止。
 * 没配 Key 或合成失败时，气泡变成错误提示，不假装能播。
 */
export default function VoiceBubble({
  state,
  onRequest,
  onStop,
}: {
  state: VoiceState | undefined;
  onRequest: () => void;
  onStop: () => void;
}) {
  const status = state?.status ?? "idle";
  const duration = state?.duration ?? 0;
  const playing = status === "playing";
  const loading = status === "loading";

  const label = (() => {
    if (loading) return "合成中…";
    if (status === "error") return state?.error ?? "合成失败";
    if (duration > 0) return `${Math.max(1, Math.round(duration))}″`;
    return "语音";
  })();

  return (
    <button
      type="button"
      className="wr-voice-bubble"
      data-state={status}
      onClick={() => {
        if (loading) return;
        if (playing) {
          onStop();
          return;
        }
        onRequest();
      }}
      aria-label={playing ? "停止播放" : "播放语音"}
    >
      <Volume2 size={15} />
      <span className="wr-voice-wave" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <i key={index} style={{ animationDelay: `${index * 90}ms` }} />
        ))}
      </span>
      <span className="wr-voice-time">{label}</span>
    </button>
  );
}
