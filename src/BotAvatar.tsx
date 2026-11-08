/**
 * WayMuse 头像。
 *
 * 造型：深色圆球 + 只有两只眼睛，没有眉毛/腮红/嘴 —— 情绪完全由「眼神」传递：
 * 眨眼、注视方向、出神时的眯眼与轻微歪头。回复中节奏变快。
 *
 * 动效全部 CSS，遵守 prefers-reduced-motion。
 */
export default function BotAvatar({
  source,
  replying = false,
}: {
  source?: string;
  replying?: boolean;
}) {
  if (source) return <img src={source} alt="" />;

  return (
    <svg
      className={replying ? "wr-bot-avatar replying" : "wr-bot-avatar"}
      viewBox="0 0 512 512"
      role="img"
      aria-label="WayMuse 头像"
    >
      <g className="wr-bot-body">
        <circle cx="256" cy="256" r="248" fill="#17191c" />
        <g className="wr-bot-eyes">
          <ellipse
            className="wr-bot-eye"
            cx="200"
            cy="250"
            rx="27"
            ry="46"
            fill="#f7f8f7"
          />
          <ellipse
            className="wr-bot-eye"
            cx="312"
            cy="250"
            rx="27"
            ry="46"
            fill="#f7f8f7"
          />
        </g>
      </g>
    </svg>
  );
}
