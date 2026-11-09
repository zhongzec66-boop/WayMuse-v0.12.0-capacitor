#!/usr/bin/env node
/**
 * 删除已经没有任何 JSX 引用的 CSS 规则块。
 *
 * 为什么用脚本而不是手删：一条规则可能是多行、可能带 @media 里的嵌套，
 * 手删容易留下半截花括号，把整份样式表弄坏。这里按括号配对来切。
 */
const fs = require("node:fs");
const path = require("node:path");

const DEAD = [
  "wr-docrow",
  "wr-doclist",
  "wr-voice-ring",
  "wr-listening",
  "wr-compose-mic",
];

const dir = path.resolve(__dirname, "..", "src", "styles");
let removed = 0;

for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".css"))) {
  const full = path.join(dir, file);
  const source = fs.readFileSync(full, "utf8");
  const lines = source.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const hit = DEAD.some((name) => line.includes(`.${name}`));
    // 只处理「选择器行 + 紧随其后的 {」，避免误伤属性值里出现的同名文本
    if (!hit || !/[{,]\s*$/.test(line)) {
      out.push(line);
      continue;
    }

    // 从这一行开始配对括号，找到规则结束
    let depth = 0;
    let j = i;
    let started = false;
    for (; j < lines.length; j += 1) {
      for (const ch of lines[j]) {
        if (ch === "{") {
          depth += 1;
          started = true;
        } else if (ch === "}") {
          depth -= 1;
        }
      }
      if (started && depth === 0) break;
    }
    removed += j - i + 1;
    i = j; // 跳过整块
  }

  fs.writeFileSync(full, out.join("\n"), "utf8");
  console.log(`[css-clean] ${file} 处理完成`);
}

console.log(`[css-clean] 共删除 ${removed} 行`);
