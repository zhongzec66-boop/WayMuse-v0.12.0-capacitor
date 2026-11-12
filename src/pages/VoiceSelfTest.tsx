import { useState } from "react";
import {
  cancelSpeech,
  isNativeExtrasSupported,
  speechEvents,
  startSpeech,
  stopSpeech,
} from "../nativeExtras";

/**
 * 语音识别自检。
 *
 * 为什么需要它：SFSpeech 的坑几乎都出在**反复启停**上——
 * 引擎没释放、tap 没移除、再次 start 直接报错。
 * 这里连续跑 N 轮（start → 收 partial → stop/cancel），
 * 把每轮的耗时、partial 次数、final 文本、错误都打出来。
 */

type Round = {
  index: number;
  partials: number;
  finalText: string;
  error: string;
  ms: number;
  mode: "stop" | "cancel";
};

const ROUNDS = 10;

export default function VoiceSelfTest() {
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [summary, setSummary] = useState("");

  const supported = isNativeExtrasSupported();

  const run = async () => {
    if (running) return;
    setRunning(true);
    setRounds([]);
    setSummary("");

    const results: Round[] = [];

    for (let index = 0; index < ROUNDS; index += 1) {
      const mode: "stop" | "cancel" = index % 3 === 2 ? "cancel" : "stop";
      let partials = 0;
      let finalText = "";
      let error = "";
      const started = performance.now();

      const offPartial = await speechEvents.partial((event) => {
        if (event.text.trim()) partials += 1;
      });
      const offFinal = await speechEvents.final((event) => {
        finalText = event.text.trim();
      });
      const offError = await speechEvents.error((event) => {
        error = event.message;
      });

      try {
        await startSpeech("zh-CN");
        // 给用户 1.4 秒说话时间（自检时请对着手机念「一二三四」）
        await new Promise((resolve) => setTimeout(resolve, 1400));
        if (mode === "cancel") await cancelSpeech();
        else await stopSpeech();
        // 等引擎收尾，暴露「没释放」的问题
        await new Promise((resolve) => setTimeout(resolve, 260));
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "start-failed";
      }

      await offPartial.remove();
      await offFinal.remove();
      await offError.remove();

      results.push({
        index: index + 1,
        partials,
        finalText,
        error,
        ms: Math.round(performance.now() - started),
        mode,
      });
      setRounds([...results]);
    }

    const errors = results.filter((r) => r.error).length;
    const silent = results.filter((r) => r.partials === 0).length;
    setSummary(
      errors === 0 && silent === 0
        ? `10 轮全部通过（都有 partial、无报错）`
        : `完成 ${results.length} 轮：${errors} 轮报错、${silent} 轮没收到 partial`,
    );
    setRunning(false);
  };

  if (!supported) {
    return (
      <p className="wr-settings-note">语音识别自检只在 iOS 原生 App 里可用。</p>
    );
  }

  return (
    <div className="wr-voice-selftest">
      <button
        type="button"
        className="wr-settings-row"
        onClick={() => void run()}
        disabled={running}
      >
        <span>
          语音识别自检（连跑 {ROUNDS} 轮）
          <em className="wr-settings-sub">
            开始后请对着手机念「一二三四」，每轮约 1.7 秒
          </em>
        </span>
        <span className="wr-settings-chevron">
          {running ? "运行中…" : "开始"}
        </span>
      </button>

      {rounds.length > 0 && (
        <div className="wr-voice-selftest-log">
          {rounds.map((round) => (
            <div
              key={round.index}
              className={round.error ? "bad" : round.partials ? "ok" : "warn"}
            >
              #{round.index} {round.mode} · {round.ms}ms · partial{" "}
              {round.partials}
              {round.finalText
                ? ` · final「${round.finalText.slice(0, 8)}」`
                : ""}
              {round.error ? ` · ❌ ${round.error.slice(0, 30)}` : ""}
            </div>
          ))}
        </div>
      )}

      {summary && <p className="wr-settings-note">{summary}</p>}
    </div>
  );
}
