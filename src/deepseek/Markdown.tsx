import { useMemo } from "react";
import CodeBlock from "./CodeBlock";
import { renderMarkdown } from "../markdown";

/**
 * 消息正文渲染。
 *
 * 正文用 markdown-it 渲染（表格、列表、公式都支持）；
 * 围栏代码块单独切成 <CodeBlock>，这样才能做高亮、复制和全屏——
 * 直接塞进 HTML 字符串里就没法挂交互了。
 */

type Segment = { type: "text"; body: string } | { type: "code"; lang: string; code: string };

export function splitCodeBlocks(text: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([\w+#.-]*)[ \t]*\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", body: text.slice(last, match.index) });
    }
    segments.push({
      type: "code",
      lang: match[1] ?? "",
      code: match[2].replace(/\n$/, ""),
    });
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    segments.push({ type: "text", body: text.slice(last) });
  }
  return segments;
}

export default function MarkdownText({ text }: { text: string }) {
  const segments = useMemo(() => splitCodeBlocks(text), [text]);

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "code" ? (
          <CodeBlock key={index} code={segment.code} language={segment.lang} />
        ) : (
          <TextSegment key={index} text={segment.body} />
        ),
      )}
    </>
  );
}

function TextSegment({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  if (!html) return null;
  return <div className="wr-ai-md" dangerouslySetInnerHTML={{ __html: html }} />;
}
