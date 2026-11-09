#!/usr/bin/env node
/**
 * 把 NativeComposePlugin 注册进 Capacitor 的 packageClassList。
 *
 * Capacitor iOS 在 CapacitorBridge.swift 里是这样加载插件的：
 *
 *     for plugin in registrationList.packageClassList {
 *         if let pluginClass = NSClassFromString(plugin) { ... }
 *     }
 *
 * 也就是说它只按 **ObjC 类名**查，不需要 App target 去 import Swift 模块。
 * 我们的插件类用 `@objc(NativeComposePlugin)` 声明了 ObjC 名，所以只要把
 * 字符串塞进这个列表即可。
 *
 * 时机很关键：`npx cap sync ios` 会重写 ios/App/App/capacitor.config.json，
 * 所以这个脚本必须在 sync 之后跑（CI 里就是紧跟着 sync 的一步）。
 */
const fs = require("node:fs");
const path = require("node:path");

const PLUGIN_CLASSES = [
  "NativeComposePlugin",
  "NativeExtrasPlugin",
  "NativeTTSPlugin",
  "LiveActivityPlugin",
];
const configPath = path.join(__dirname, "..", "ios", "App", "App", "capacitor.config.json");

if (!fs.existsSync(configPath)) {
  console.warn(`[register-native-compose] 找不到 ${configPath}，跳过`);
  process.exit(0);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (error) {
  console.warn(`[register-native-compose] 配置解析失败：${error.message}`);
  process.exit(0);
}

const list = Array.isArray(config.packageClassList) ? config.packageClassList : [];
if (!PLUGIN_CLASSES.every((cls) => list.includes(cls))) {
  PLUGIN_CLASSES.forEach((cls) => { if (!list.includes(cls)) list.push(cls); });
  config.packageClassList = list;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`, "utf8");
  console.log(`[register-native-compose] 已注册：${list.join(", ")}`);
} else {
  console.log(`[register-native-compose] 已存在：${list.join(", ")}`);
}
