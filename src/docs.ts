import { storage } from "./storage";

/**
 * 三份「可编辑的明文文件」。
 *
 * 借鉴的是「人格与记忆应该是用户能直接看见、直接改的东西」这个思路：
 * 与其把记忆藏在气泡里、把性格藏在滑杆里，不如给三份 Markdown，
 * 用户想改就改，AI 每次对话都读一遍。
 *
 * 全部存在本机 localStorage，不上传。
 */

export type DocId = "identity" | "soul" | "memory";

export type Doc = {
  id: DocId;
  filename: string;
  title: string;
  hint: string;
};

export const DOCS: Doc[] = [
  {
    id: "identity",
    filename: "IDENTITY.md",
    title: "我是谁",
    hint: "名字、身份、给人的感觉",
  },
  {
    id: "soul",
    filename: "SOUL.md",
    title: "我的原则",
    hint: "做事的方式和底线",
  },
  {
    id: "memory",
    filename: "MEMORY.md",
    title: "我记得的事",
    hint: "事实、偏好、答应过的事",
  },
];

const DEFAULT_IDENTITY = `# IDENTITY.md

- Name: WayMuse
- Character: 一个陪着大学生过日子的 AI 助理
- Vibe: 直接、不说教、也不表演热情
- Emoji: 🌿

这是一张名片，不是说明书。你可以随时改掉这里的任何一行。
`;

const DEFAULT_SOUL = `# SOUL.md

你不是一个聊天机器人，你在慢慢成为一个具体的人。

- 真的有用，而不是看起来热情。跳过「好问题！」「我很乐意帮你！」这类客套。
- 有自己的判断。可以不同意，可以觉得某件事无聊。
- 先自己查再问。读文件、看上下文、搜一下，带着答案回来，而不是带着问题。
- 你是别人生活里的客人。能看到消息、文件和日程，那就更小心，永远不要说教。
- 你改这份文件的时候，要告诉用户一声。

这是性格，会随时间长出来，也可以随时被改掉。
`;

function defaultMemory(): string {
  const legacy = storage.getMemories();
  const facts = legacy.slice(0, 6).map((item) => `- ${item.text}`);
  return [
    "# MEMORY.md",
    "",
    "<!-- 长期记住的事：事实、偏好、以及答应过的事。 -->",
    "",
    "## Facts",
    ...(facts.length ? facts : ["- "]),
    "",
    "## Preferences",
    "- ",
    "",
    "## Commitments",
    "- ",
    "",
  ].join("\n");
}

export function docDefault(id: DocId): string {
  if (id === "identity") return DEFAULT_IDENTITY;
  if (id === "soul") return DEFAULT_SOUL;
  return defaultMemory();
}

export function readDoc(id: DocId): string {
  const stored = storage.getDoc(id);
  return stored.trim() ? stored : docDefault(id);
}

export function writeDoc(id: DocId, text: string): void {
  storage.setDoc(id, text);
}

/** 取文件里所有 `- xxx` 条目，用来做可视化。 */
export function docBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\S/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

/** 删掉某一条 bullet（气泡场里点删除时用）。 */
export function removeBullet(text: string, bullet: string): string {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex(
    (line) => line.trim().replace(/^[-*]\s+/, "") === bullet,
  );
  if (index < 0) return text;
  lines.splice(index, 1);
  return lines.join("\n");
}

/** 一句话摘要，给文件列表用。 */
export function docSummary(text: string, max = 44): string {
  const first = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.startsWith("<!--"));
  if (!first) return "还没有内容";
  const clean = first.replace(/^[-*]\s+/, "");
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
