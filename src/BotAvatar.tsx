/**
 * WayMuse 头像。
 *
 * 造型：大眼 + 细眉 + 圆脸，表情偏「好奇」而不是「面无表情」。
 * 动效全部用 CSS 完成（呼吸 + 眨眼 + 眼球微移 + 说话时的律动），
 * 并且遵守 prefers-reduced-motion。
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
        {/* 脸 */}
        <circle
          cx="256"
          cy="256"
          r="248"
          fill="#ffffff"
          stroke="#e3e6e8"
          strokeWidth="8"
        />
        {/* 腮红：可爱一点，但很淡 */}
        <ellipse cx="168" cy="312" rx="30" ry="18" fill="#ffd9d2" opacity="0.55" />
        <ellipse cx="344" cy="312" rx="30" ry="18" fill="#ffd9d2" opacity="0.55" />

        {/* 眉毛：细、短、有弧度 */}
        <path
          d="M150 196c22-18 52-19 74-5"
          fill="none"
          stroke="#202328"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M288 191c22-14 52-13 74 5"
          fill="none"
          stroke="#202328"
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* 眼睛：更大、更圆 */}
        <g className="wr-bot-eyes">
          <g className="wr-bot-eye">
            <ellipse cx="196" cy="256" rx="30" ry="38" fill="#202328" />
            {/* 高光让眼睛有神 */}
            <circle cx="186" cy="242" r="8" fill="#ffffff" opacity="0.9" />
          </g>
          <g className="wr-bot-eye">
            <ellipse cx="316" cy="256" rx="30" ry="38" fill="#202328" />
            <circle cx="306" cy="242" r="8" fill="#ffffff" opacity="0.9" />
          </g>
        </g>

        {/* 嘴：一个小弧 */}
        <path
          className="wr-bot-mouth"
          d="M232 336c16 12 32 12 48 0"
          fill="none"
          stroke="#202328"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
