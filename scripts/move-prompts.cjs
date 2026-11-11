#!/usr/bin/env node
/**
 * 把客户端的提示词模板原样搬到服务端。
 *
 * 为什么用脚本搬而不是手抄：这些模板是中文明文，几万字，手抄一定会出错，
 * 而且以后前端再有改动还能重跑一遍比对。脚本只做「取字面量 → 写文件」，
 * 不改一个字。
 *
 * 用法：node scripts/move-prompts.cjs <客户端src目录> <服务端src目录>
 */
const fs = require("node:fs");
const path = require("node:path");

const clientSrc = process.argv[2];
const serverSrc = process.argv[3];
if (!clientSrc || !serverSrc) {
  console.error("用法: node move-prompts.cjs <客户端src> <服务端src>");
  process.exit(1);
}

const read = (relative) =>
  fs.readFileSync(path.join(clientSrc, relative), "utf8");

/** 取出 `export const NAME = \`...\`;` 的正文 */
function pickConst(source, name) {
  const match = source.match(
    new RegExp(`export const ${name}\\s*=\\s*\`([\\s\\S]*?)\`;`),
  );
  if (!match) throw new Error(`找不到常量 ${name}`);
  return match[1];
}

/** 取出 skills 数组里每一项的 id / name / triggers / body */
function pickSkills(source) {
  const items = [];
  const idRe = /id:\s*"([\w-]+)"/g;
  let match;
  while ((match = idRe.exec(source))) {
    const start = match.index;
    const nextId = source.indexOf('id: "', start + 5);
    const block = source.slice(start, nextId === -1 ? undefined : nextId);
    const nameMatch = block.match(/name:\s*"([^"]+)"/);
    const triggersMatch = block.match(/triggers:\s*\[([\s\S]*?)\]/);
    const bodyMatch = block.match(/body:\s*`([\s\S]*?)`,?\s*\n\s*}/);
    if (!nameMatch || !triggersMatch || !bodyMatch) continue;
    const triggers = [...triggersMatch[1].matchAll(/"([^"]+)"/g)].map(
      (item) => item[1],
    );
    items.push({
      id: match[1],
      name: nameMatch[1],
      triggers,
      body: bodyMatch[1],
    });
  }
  return items;
}

function escapeTemplate(text) {
  return text.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const outDir = path.join(serverSrc, "prompts");
fs.mkdirSync(outDir, { recursive: true });

// 1) 基础人格
const promptSource = read("deepseek/prompt.ts");
const base = pickConst(promptSource, "DEFAULT_SYSTEM_PROMPT");
fs.writeFileSync(
  path.join(outDir, "base.ts"),
  `/** 助手的基础人格与回答风格。由客户端 src/deepseek/prompt.ts 原样搬来。 */
export const BASE_PROMPT = \`${escapeTemplate(base)}\`;
`,
  "utf8",
);

// 2) 回复协议
const agentSource = read("agent.ts");
const protocol = pickConst(agentSource, "PLAN_INSTRUCTION");
fs.writeFileSync(
  path.join(outDir, "protocol.ts"),
  `/** 回复协议：方案块 / 记忆块 / 课表块的格式约定。由客户端 src/agent.ts 原样搬来。 */
export const PROTOCOL_PROMPT = \`${escapeTemplate(protocol)}\`;
`,
  "utf8",
);

// 3) 技能
const skillSource = read("skills/index.ts");
const skills = pickSkills(skillSource);
fs.writeFileSync(
  path.join(outDir, "skills.ts"),
  `/**
 * 按需加载的技能模板。
 *
 * 客户端原先在本地匹配触发词，现在整段搬到服务端：
 * 客户端只发用户原话，由这里判断命中哪个技能，再拼进 system prompt。
 * 这样拆包看不到能力清单，也看不到正文。
 *
 * 正文由客户端 src/skills/index.ts 原样搬来。
 */
export type Skill = {
  id: string;
  name: string;
  triggers: string[];
  body: string;
};

export const SKILLS: Skill[] = [
${skills
  .map(
    (skill) => `  {
    id: ${JSON.stringify(skill.id)},
    name: ${JSON.stringify(skill.name)},
    triggers: [${skill.triggers.map((t) => JSON.stringify(t)).join(", ")}],
    body: \`${escapeTemplate(skill.body)}\`,
  },`,
  )
  .join("\n")}
];
`,
  "utf8",
);

console.log(
  `[move-prompts] base ${base.length} 字 · protocol ${protocol.length} 字 · 技能 ${skills.length} 个（${skills.map((s) => s.name).join("、")}）`,
);
