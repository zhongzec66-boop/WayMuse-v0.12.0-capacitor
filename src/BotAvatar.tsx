import { useEffect, useState } from "react";

/**
 * WayMuse 头像。
 *
 * 造型：深色圆球 + 只有两只眼睛，没有眉毛/腮红/嘴 —— 情绪完全由「眼睛的形状、
 * 开合、注视方向」传递。所以情绪不是换图，而是同一双眼睛在变形。
 *
 * 七种状态：
 *   idle      正常（呼吸 + 双眨 + 注视漂移）
 *   thinking  回复中（眯眼 + 快速扫视，专注感）
 *   happy     开心（眯成弯眼 + 轻轻弹）
 *   curious   好奇（一只眼半闭 + 歪头打量）
 *   angry     生气（两眼向内倾成 /\）
 *   sleepy    犯困（眼睛几乎闭合 + 呼吸变慢）
 *   surprised 惊讶（眼睛放大 + 停一下）
 *
 * 全部 CSS 动效，遵守 prefers-reduced-motion。
 */
export type BotMood =
  "idle" | "thinking" | "happy" | "curious" | "angry" | "sleepy" | "surprised";

export default function BotAvatar({
  source,
  replying = false,
  mood,
  className,
}: {
  source?: string;
  replying?: boolean;
  mood?: BotMood;
  className?: string;
}) {
  const [drift, setDrift] = useState<BotMood>("idle");

  // 空闲时每隔一会儿「打量一下」，避免一直僵在同一个表情。
  useEffect(() => {
    if (mood || replying) return;
    const id = window.setInterval(
      () => setDrift((cur) => (cur === "idle" ? "curious" : "idle")),
      9000,
    );
    return () => window.clearInterval(id);
  }, [mood, replying]);

  if (source)
    return (
      <img
        src={source}
        alt=""
        className={className ? `wr-bot-avatar ${className}` : "wr-bot-avatar"}
      />
    );

  const active: BotMood = replying ? "thinking" : (mood ?? drift);

  return (
    <svg
      className={className ? `wr-bot-avatar ${className}` : "wr-bot-avatar"}
      data-mood={active}
      viewBox="0 0 512 512"
      role="img"
      aria-label={`WayMuse 头像（${active}）`}
    >
      <g className="wr-bot-body">
        <circle cx="256" cy="256" r="248" fill="#036f3b" />
        <g className="wr-bot-eyes">
          <rect
            className="wr-eye wr-eye-l"
            x="173"
            y="204"
            width="54"
            height="92"
            rx="27"
            fill="#f7f8f7"
          />
          <rect
            className="wr-eye wr-eye-r"
            x="285"
            y="204"
            width="54"
            height="92"
            rx="27"
            fill="#f7f8f7"
          />
        </g>
      </g>
    </svg>
  );
}
