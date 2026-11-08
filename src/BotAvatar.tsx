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
      <circle cx="256" cy="256" r="252" fill="#fff" stroke="#e2e4e6" strokeWidth="8" />
      <path d="M153 199c20-15 47-16 68-4M291 195c21-12 48-11 68 4" fill="none" stroke="#202328" strokeWidth="15" strokeLinecap="round" />
      <g className="wr-bot-eyes">
        <rect x="176" y="232" width="38" height="77" rx="19" fill="#202328" />
        <rect x="298" y="232" width="38" height="77" rx="19" fill="#202328" />
      </g>
    </svg>
  );
}
