import { describe, expect, it } from "vitest";
import { SentenceSplitter, cleanForSpeech } from "./tts";

describe("cleanForSpeech", () => {
  it("去掉代码块", () => {
    const text = cleanForSpeech("看这段：\n```js\nconsole.log(1)\n```\n完了");
    expect(text).not.toContain("console");
    expect(text).toContain("看这段");
  });

  it("去掉协议块（卡片内容不朗读）", () => {
    const text = cleanForSpeech(
      '今天先做两件事<plans>[{"title":"复习"}]</plans>，然后休息。',
    );
    expect(text).not.toContain("plans");
    expect(text).toContain("今天先做两件事");
  });

  it("链接只留文字，裸 URL 删掉", () => {
    const text = cleanForSpeech(
      "看[这里的说明](https://x.com/a)和 https://y.com",
    );
    expect(text).toContain("这里的说明");
    expect(text).not.toContain("http");
  });

  it("去 Markdown 符号与公式", () => {
    const text = cleanForSpeech("**重点**：`x = 1`，公式 $a^2$ 不算");
    expect(text).not.toContain("*");
    expect(text).not.toContain("$");
    expect(text).toContain("重点");
  });

  it("截断到 300 字", () => {
    const text = cleanForSpeech("啊".repeat(400));
    expect([...text].length).toBe(300);
  });
});

describe("SentenceSplitter", () => {
  it("首句够 12 字就先切，换来更早出声", () => {
    const splitter = new SentenceSplitter();
    const out = splitter.push("今天下午没有课，我们可以安排两小时的复习。");
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].length).toBeLessThanOrEqual(20);
  });

  it("按句号切分", () => {
    const splitter = new SentenceSplitter();
    const out = splitter.push("第一句话在这里。第二句话也在这里。");
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.join("")).toContain("第一句话");
  });

  it("短句合并，不单独成句", () => {
    const splitter = new SentenceSplitter();
    const out = splitter.push("好。然后我们继续把这件事做完吧。");
    expect(out.every((s) => s.length >= 10)).toBe(true);
  });

  it("超长无标点在逗号处切", () => {
    const splitter = new SentenceSplitter();
    const long =
      "啊".repeat(40) + "，" + "啊".repeat(40) + "，" + "啊".repeat(40);
    const out = splitter.push(long);
    expect(out.every((s) => s.length <= 90)).toBe(true);
  });

  it("flush 吐出剩余", () => {
    const splitter = new SentenceSplitter();
    splitter.push("最后没有标点的一句话");
    const rest = splitter.flush();
    expect(rest.join("")).toContain("最后");
  });

  it("reset 清空缓冲", () => {
    const splitter = new SentenceSplitter();
    splitter.push("一句话");
    splitter.reset();
    expect(splitter.flush()).toEqual([]);
  });
});
