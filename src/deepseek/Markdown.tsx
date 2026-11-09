import { useMemo } from "react";
import { renderMarkdown } from "../markdown";

/**
 * 消息正文渲染。
 *
 * 换成 markdown-it + KaTeX 之后，表格、嵌套列表、链接和数学公式都能
 * 正确显示；之前那份手写解析器只认标题/列表/粗体，公式是纯文本。
 *
 * 安全性：markdown-it 关了原始 HTML（`html: false`），模型输出里的
 * `<script>` 之类不会被当标签解析；KaTeX 那一段是我们自己渲染的可信 HTML。
 */
export default function MarkdownText({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return (
    <div className="wr-ai-md" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
