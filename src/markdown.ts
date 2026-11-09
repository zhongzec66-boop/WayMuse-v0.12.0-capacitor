import MarkdownIt from "markdown-it";
import katex from "katex";

/**
 * 把助手回复渲染成 HTML（Markdown + 数学公式）。
 *
 * 两个刻意的选择：
 * 1. `html: false` —— 没有原始 HTML，天然防注入。模型输出不可信，
 *    绝不能把它当 HTML 直接插进 DOM。
 * 2. 公式先被抽走再交给 Markdown —— 否则 `$a*b*c$` 里的星号会被
 *    当成斜体，公式就烂了。
 */

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFormula(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: "html",
    });
  } catch {
    return escapeHtml(source);
  }
}

/** 把公式挖出来换成占位符，避免 Markdown 规则破坏公式内部字符 */
function extractMath(source: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const stash = (html: string) => {
    slots.push(html);
    return `\uE000${slots.length - 1}\uE001`;
  };

  let text = source;
  // $$ ... $$（块级）
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, body: string) =>
    stash(renderFormula(body.trim(), true)),
  );
  // \( ... \) 与 \[ ... \]（LaTeX 写法）
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, body: string) =>
    stash(renderFormula(body.trim(), true)),
  );
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, body: string) =>
    stash(renderFormula(body.trim(), false)),
  );
  // $ ... $（行内），要求首尾不是空白，避免误伤金额
  text = text.replace(
    /\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$/g,
    (_, body: string) => stash(renderFormula(body.trim(), false)),
  );
  return { text, slots };
}

export function renderMarkdown(source: string): string {
  if (!source.trim()) return "";
  const { text, slots } = extractMath(source);
  let html = md.render(text);
  html = html.replace(/\uE000(\d+)\uE001/g, (_, index: string) => {
    return slots[Number(index)] ?? "";
  });
  return html;
}
