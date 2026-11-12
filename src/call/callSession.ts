/**
 * 语音通话的状态机（纯逻辑，不碰 DOM，方便单测）。
 *
 * 五个状态：listening / thinking / speaking / interrupted / idle
 * 计时只发生在 listening：10 秒没识别到话 → 提示「还在吗？」，
 * 累计 30 秒 → 自动结束。
 */

export type CallState =
  "idle" | "listening" | "thinking" | "speaking" | "interrupted";

export const SILENCE_PROMPT_MS = 10_000;
export const SILENCE_HANGUP_MS = 30_000;

export type CallHooks = {
  /** 状态变了（驱动 data-state 与文案） */
  onState?: (state: CallState) => void;
  /** 沉默 10 秒 */
  onNudge?: () => void;
  /** 沉默 30 秒，应结束通话 */
  onHangup?: () => void;
  /** speaking / interrupted → listening 的边沿（触发一次轻震动） */
  onTurnEnd?: () => void;
};

export class CallSession {
  private state: CallState = "idle";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private hangupTimer: ReturnType<typeof setTimeout> | null = null;
  private hooks: CallHooks;
  private startedAt = 0;

  constructor(hooks: CallHooks = {}) {
    this.hooks = hooks;
  }

  current(): CallState {
    return this.state;
  }

  durationSec(now = Date.now()): number {
    return this.startedAt
      ? Math.max(0, Math.round((now - this.startedAt) / 1000))
      : 0;
  }

  start(): void {
    this.startedAt = Date.now();
    this.setState("listening");
    this.armSilence();
  }

  /** 用户开口了（识别到文字或按下说话） */
  userSpeaking(): void {
    if (this.state === "idle") return;
    this.clearSilence();
    if (this.state === "speaking") this.setState("interrupted");
  }

  /** 用户说完，等模型 */
  userDone(): void {
    if (this.state === "idle") return;
    this.clearSilence();
    this.setState("thinking");
  }

  /** 开始播放 TTS */
  modelSpeaking(): void {
    if (this.state === "idle") return;
    this.clearSilence();
    this.setState("speaking");
  }

  /** 一段回复播完 → 回到聆听，并触发一次「轮到你了」 */
  modelDone(): void {
    if (this.state === "idle") return;
    const wasSpeaking =
      this.state === "speaking" || this.state === "interrupted";
    this.setState("listening");
    this.armSilence();
    if (wasSpeaking) this.hooks.onTurnEnd?.();
  }

  hangup(): void {
    this.clearSilence();
    this.setState("idle");
  }

  private armSilence(): void {
    this.clearSilence();
    this.silenceTimer = setTimeout(() => {
      this.hooks.onNudge?.();
      this.hangupTimer = setTimeout(
        () => this.hooks.onHangup?.(),
        SILENCE_HANGUP_MS - SILENCE_PROMPT_MS,
      );
    }, SILENCE_PROMPT_MS);
  }

  private clearSilence(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.hangupTimer) clearTimeout(this.hangupTimer);
    this.silenceTimer = null;
    this.hangupTimer = null;
  }

  private setState(next: CallState): void {
    if (this.state === next) return;
    this.state = next;
    this.hooks.onState?.(next);
  }
}

export const STATE_COPY: Record<CallState, string> = {
  idle: "",
  listening: "我在听，你说",
  thinking: "想一下…",
  speaking: "我在说",
  interrupted: "你说，我在听",
};
