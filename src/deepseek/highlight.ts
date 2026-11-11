/**
 * 极简语法高亮。
 *
 * 不引 Prism/highlight.js（几百 KB，还带来一堆主题 CSS），
 * 只做四类：注释、字符串、数字、关键字。够看，也够快。
 */

const KEYWORDS: Record<string, string[]> = {
  js: "const let var function return if else for while do switch case break continue new class extends import export default from async await try catch finally throw typeof instanceof null undefined true false this super yield of in delete void".split(
    " ",
  ),
  py: "def class return if elif else for while break continue import from as try except finally raise with lambda None True False and or not in is pass global nonlocal yield async await".split(
    " ",
  ),
  c: "int char float double void long short unsigned signed struct union enum typedef static const return if else for while do switch case break continue goto sizeof extern volatile register inline".split(
    " ",
  ),
  java: "public private protected class interface extends implements static final void int long double float boolean char byte short return if else for while do switch case break continue new this super try catch finally throw throws import package abstract synchronized volatile transient instanceof enum".split(
    " ",
  ),
  go: "package import func var const type struct interface map chan go defer select range return if else for switch case break continue nil true false".split(
    " ",
  ),
  rs: "fn let mut const struct enum impl trait pub use mod match if else for while loop return self Self true false".split(
    " ",
  ),
  sql: "select from where join left right inner outer on group by order having limit offset insert into values update set delete create table alter drop index primary key foreign references not null default and or as distinct count sum avg min max".split(
    " ",
  ),
  sh: "echo cd ls mkdir rm cp mv cat grep sed awk export source if then else fi for do done while case esac function return".split(
    " ",
  ),
};

const ALIASES: Record<string, string> = {
  javascript: "js",
  jsx: "js",
  ts: "js",
  typescript: "js",
  tsx: "js",
  node: "js",
  python: "py",
  py3: "py",
  cpp: "c",
  "c++": "c",
  h: "c",
  objc: "c",
  java: "java",
  kotlin: "java",
  golang: "go",
  rust: "rs",
  postgres: "sql",
  psql: "sql",
  mysql: "sql",
  bash: "sh",
  shell: "sh",
  zsh: "sh",
  console: "sh",
  powershell: "sh",
};

function normalizeLanguage(lang: string): string | null {
  const key = lang.trim().toLowerCase();
  if (!key) return null;
  const direct = KEYWORDS[key] ? key : ALIASES[key];
  if (!direct) return null;
  return KEYWORDS[direct] ? direct : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function highlightCode(code: string, language: string): string {
  const normalized = normalizeLanguage(language);
  const escaped = escapeHtml(code);
  if (!normalized) return escaped;

  const words = new Set(KEYWORDS[normalized]);

  // 一次性匹配：注释 / 字符串 / 数字 / 标识符，避免多轮替换互相破坏
  const pattern =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;

  return escaped.replace(pattern, (match, comment, string, number, word) => {
    if (comment) return `<span class="tok-comment">${match}</span>`;
    if (string) return `<span class="tok-string">${match}</span>`;
    if (number) return `<span class="tok-number">${match}</span>`;
    if (word && words.has(word))
      return `<span class="tok-keyword">${match}</span>`;
    return match;
  });
}
