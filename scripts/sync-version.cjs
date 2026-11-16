#!/usr/bin/env node
/**
 * 版本号单一来源同步。
 *
 * 现状问题：package.json 是 0.28.2，Android build.gradle 是 versionCode 158，
 * 但 iOS 工程里 MARKETING_VERSION 还是 1.0、CURRENT_PROJECT_VERSION 还是 1。
 * 结果就是"两个包版本号都是 1.0 (1)"，TestFlight 每次上传还会因为 build 号不递增被拒。
 *
 * 这个脚本把两处对齐：
 *   package.json.version              → iOS MARKETING_VERSION
 *   android versionCode                → iOS CURRENT_PROJECT_VERSION
 *   android versionName                → package.json.version（校验一致）
 *
 * 用法：node scripts/sync-version.cjs [--check]
 *   --check 只检查不写入，CI 里可以用它防止再次漂移。
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const gradlePath = path.join(root, "android", "app", "build.gradle");
const pbxPath = path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");

const checkOnly = process.argv.includes("--check");

function readPkgVersion() {
  let raw = fs.readFileSync(pkgPath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw).version;
}

function readAndroid(gradle) {
  const code = gradle.match(/versionCode\s+(\d+)/);
  const name = gradle.match(/versionName\s+"([^"]+)"/);
  return { code: code ? Number(code[1]) : null, name: name ? name[1] : null };
}

const version = readPkgVersion();
const gradle = fs.readFileSync(gradlePath, "utf8");
const android = readAndroid(gradle);
const problems = [];

if (!android.code) problems.push("android versionCode 读不到");
if (android.name !== version) {
  problems.push(`android versionName=${android.name} 与 package.json=${version} 不一致`);
}

const pbx = fs.readFileSync(pbxPath, "utf8");
const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]);
const build = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1]);

if (marketing.some((v) => v !== version)) {
  problems.push(`iOS MARKETING_VERSION=${marketing.join(",")} 与 ${version} 不一致`);
}
if (android.code && build.some((v) => v !== String(android.code))) {
  problems.push(`iOS CURRENT_PROJECT_VERSION=${build.join(",")} 与 versionCode=${android.code} 不一致`);
}

if (problems.length === 0) {
  console.log(`[sync-version] 一致：${version}（build ${android.code}）`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`[sync-version] 版本漂移：\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}

let nextPbx = pbx
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(
    /CURRENT_PROJECT_VERSION = [^;]+;/g,
    `CURRENT_PROJECT_VERSION = ${android.code};`,
  );
fs.writeFileSync(pbxPath, nextPbx, "utf8");

let nextGradle = gradle.replace(
  /versionName\s+"[^"]+"/,
  `versionName "${version}"`,
);
fs.writeFileSync(gradlePath, nextGradle, "utf8");

console.log(`[sync-version] 已同步：${version}（build ${android.code}）`);
