#!/usr/bin/env node
/**
 * 把「原生聊天输入框」的两个 Swift 文件注入到已链接的 SPM 插件目标里。
 *
 * 为什么这么做：
 * - 这个工程用的是传统 project.pbxproj（每个 .swift 都要 4 处显式引用），
 *   手改容易把 Xcode 工程写坏；
 * - Capacitor 的 SPM 插件是在 node_modules 里通过 Package.swift 链接的，
 *   而 SPM 会自动编译 target 目录下**所有** .swift；
 * - 但 node_modules 在 CI 的 `npm ci` 之后是全新的，所以必须由 postinstall 重新写入。
 *
 * 脚本是幂等的：内容一致就不写，目录不存在只告警不报错（避免依赖升级时卡住构建）。
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "patches", "liquid-glass");
const target = path.join(
  root,
  "node_modules",
  "@ajuarezso",
  "capacitor-liquid-glass",
  "ios",
  "Sources",
  "LiquidGlassPlugin",
);

const files = [
  "NativeComposePlugin.swift",
  "NativeComposeOverlay.swift",
  "NativeExtrasPlugin.swift",
];

if (!fs.existsSync(target)) {
  console.warn(
    `[inject-native-compose] 未找到插件目录，跳过：${path.relative(root, target)}\n` +
      "  （依赖未安装，或插件包路径变了；原生输入框会退回到 Web 输入框）",
  );
  process.exit(0);
}

let written = 0;
for (const name of files) {
  const from = path.join(source, name);
  const to = path.join(target, name);
  if (!fs.existsSync(from)) {
    console.warn(`[inject-native-compose] 缺少源文件：${path.relative(root, from)}`);
    continue;
  }
  const next = fs.readFileSync(from, "utf8");
  const current = fs.existsSync(to) ? fs.readFileSync(to, "utf8") : null;
  if (current === next) continue;
  fs.writeFileSync(to, next, "utf8");
  written += 1;
}

console.log(
  written
    ? `[inject-native-compose] 已注入 ${written} 个 Swift 文件 → ${path.relative(root, target)}`
    : "[inject-native-compose] 原生输入框文件已是最新",
);
