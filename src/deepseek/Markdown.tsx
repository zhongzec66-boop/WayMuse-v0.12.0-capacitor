import type { ReactNode } from "react";

function inline(text: string, prefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    const key = `${prefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    return <span key={key}>{part}</span>;
  });
}

function Prose({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        const key = `line-${index}`;
        if (!trimmed) return <div className="wr-ai-gap" key={key} />;
        if (trimmed.startsWith("### ")) {
          return <h4 key={key}>{inline(trimmed.slice(4), key)}</h4>;
        }
        if (trimmed.startsWith("## ")) {
          return <h3 key={key}>{inline(trimmed.slice(3), key)}</h3>;
        }
        if (trimmed.startsWith("# ")) {
          return <h2 key={key}>{inline(trimmed.slice(2), key)}</h2>;
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={key}>{inline(trimmed.slice(2), key)}</blockquote>
          );
        }
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div className="wr-ai-li" key={key}>
              <span>•</span>
              <span>{inline(trimmed.replace(/^[-*]\s+/, ""), key)}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const marker = trimmed.match(/^\d+\./)?.[0] ?? "·";
          return (
            <div className="wr-ai-li" key={key}>
              <span>{marker}</span>
              <span>{inline(trimmed.replace(/^\d+\.\s+/, ""), key)}</span>
            </div>
          );
        }
        return <p key={key}>{inline(line, key)}</p>;
      })}
    </>
  );
}

export default function MarkdownText({ text }: { text: string }) {
  const segments = text.split(/```([\w-]*)\n?([\s\S]*?)```/g);
  const blocks: ReactNode[] = [];
  for (let index = 0; index < segments.length; index += 3) {
    const prose = segments[index];
    if (prose) blocks.push(<Prose text={prose} key={`prose-${index}`} />);
    if (index + 2 < segments.length) {
      blocks.push(
        <pre className="wr-ai-code" key={`code-${index}`}>
          <code>{segments[index + 2]}</code>
        </pre>,
      );
    }
  }
  return <div className="wr-ai-md">{blocks}</div>;
}
