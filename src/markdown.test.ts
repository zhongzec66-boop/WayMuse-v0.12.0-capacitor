import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("渲染粗体与行内代码", () => {
    const html = renderMarkdown("**重点** 和 `const a = 1`");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain("<code>const a = 1</code>");
  });

  it("把 $...$ 渲染成公式而不是纯文本", () => {
    const html = renderMarkdown("勾股定理 $a^2+b^2=c^2$ 成立");
    expect(html).toContain("katex");
    expect(html).not.toContain("$a^2");
  });

  it("公式里的星号不会被当成斜体", () => {
    const html = renderMarkdown("$a*b*c$");
    expect(html).toContain("katex");
    expect(html).not.toContain("<em>");
  });

  it("$$...$$ 走块级公式", () => {
    const html = renderMarkdown("$$\\int_0^1 x\\,dx$$");
    expect(html).toContain("katex-display");
  });

  it("单独的金额不当成公式", () => {
    const html = renderMarkdown("这件衣服 $100");
    expect(html).not.toContain("katex");
    expect(html).toContain("$100");
  });

  it("标题与有序列表", () => {
    const html = renderMarkdown("## 小标题\n\n1. 第一\n2. 第二");
    expect(html).toContain("<h2>小标题</h2>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>第一</li>");
  });

  it("表格", () => {
    const html = renderMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("代码块里的内容不被二次解析", () => {
    const html = renderMarkdown("```js\nconst x = **not bold**;\n```");
    expect(html).toContain("<pre");
    expect(html).not.toContain("<strong>");
  });

  it("模型输出里的原始 HTML 被转义（防注入）", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("空字符串返回空", () => {
    expect(renderMarkdown("   ")).toBe("");
  });
});
