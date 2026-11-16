import { describe, expect, it, vi } from "vitest";
import {
  CallSession,
  SILENCE_HANGUP_MS,
  SILENCE_PROMPT_MS,
} from "./callSession";

describe("CallSession", () => {
  it("开始后进入 listening", () => {
    const session = new CallSession();
    session.start();
    expect(session.current()).toBe("listening");
  });

  it("聆听 → 思考 → 说话 → 聆听", () => {
    const states: string[] = [];
    const session = new CallSession({ onState: (s) => states.push(s) });
    session.start();
    session.userSpeaking();
    session.userDone();
    session.modelSpeaking();
    session.modelDone();
    expect(states).toEqual(["listening", "thinking", "speaking", "listening"]);
  });

  it("speaking → listening 触发一次 onTurnEnd", () => {
    const onTurnEnd = vi.fn();
    const session = new CallSession({ onTurnEnd });
    session.start();
    session.modelSpeaking();
    session.modelDone();
    expect(onTurnEnd).toHaveBeenCalledTimes(1);
  });

  it("thinking → listening 不触发 onTurnEnd（不是轮到你）", () => {
    const onTurnEnd = vi.fn();
    const session = new CallSession({ onTurnEnd });
    session.start();
    session.userDone();
    session.modelDone();
    expect(onTurnEnd).not.toHaveBeenCalled();
  });

  it("说话时用户开口 → interrupted，再说完 → thinking", () => {
    const session = new CallSession();
    session.start();
    session.modelSpeaking();
    session.userSpeaking();
    expect(session.current()).toBe("interrupted");
    session.userDone();
    expect(session.current()).toBe("thinking");
  });

  it("挂断回到 idle 并清掉计时", () => {
    vi.useFakeTimers();
    const onHangup = vi.fn();
    const session = new CallSession({ onHangup });
    session.start();
    session.hangup();
    vi.advanceTimersByTime(SILENCE_HANGUP_MS + 1000);
    expect(session.current()).toBe("idle");
    expect(onHangup).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("沉默 10 秒提示、30 秒挂断", () => {
    vi.useFakeTimers();
    const onNudge = vi.fn();
    const onHangup = vi.fn();
    const session = new CallSession({ onNudge, onHangup });
    session.start();
    vi.advanceTimersByTime(SILENCE_PROMPT_MS + 50);
    expect(onNudge).toHaveBeenCalledTimes(1);
    expect(session.current()).toBe("listening");
    vi.advanceTimersByTime(SILENCE_HANGUP_MS - SILENCE_PROMPT_MS + 50);
    expect(onHangup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("thinking 期间不挂断（模型还在回）", () => {
    vi.useFakeTimers();
    const onHangup = vi.fn();
    const session = new CallSession({ onHangup });
    session.start();
    session.userDone();
    vi.advanceTimersByTime(SILENCE_HANGUP_MS + 5000);
    expect(onHangup).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("speaking 期间不挂断", () => {
    vi.useFakeTimers();
    const onHangup = vi.fn();
    const session = new CallSession({ onHangup });
    session.start();
    session.modelSpeaking();
    vi.advanceTimersByTime(SILENCE_HANGUP_MS + 5000);
    expect(onHangup).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("有话说会重置沉默计时", () => {
    vi.useFakeTimers();
    const onNudge = vi.fn();
    const session = new CallSession({ onNudge });
    session.start();
    vi.advanceTimersByTime(SILENCE_PROMPT_MS - 1000);
    session.userSpeaking();
    session.modelDone();
    vi.advanceTimersByTime(SILENCE_PROMPT_MS - 500);
    expect(onNudge).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
