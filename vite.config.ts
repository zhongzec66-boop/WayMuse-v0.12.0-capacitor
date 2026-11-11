import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { BRAND } from "./src/brand.ts";

// 版本号只有一个来源：package.json（发版时和 build.gradle 一起改）
// 注意：package.json 可能是带 BOM 的，直接 JSON.parse 会抛错
const pkgRaw = readFileSync(new URL("./package.json", import.meta.url), "utf8");
const pkg = JSON.parse(
  pkgRaw.charCodeAt(0) === 0xfeff ? pkgRaw.slice(1) : pkgRaw,
) as { version: string };

const manifestPath = fileURLToPath(
  new URL("./manifest.webmanifest", import.meta.url),
);
const publicManifestPath = fileURLToPath(
  new URL("./public/manifest.webmanifest", import.meta.url),
);

function brandAssets(): Plugin {
  return {
    name: "waymuse-brand-assets",
    configResolved() {
      const template = readFileSync(manifestPath, "utf8");
      writeFileSync(
        publicManifestPath,
        template.replaceAll("__BRAND__", BRAND),
      );
    },
    transformIndexHtml: (html) => html.replaceAll("__BRAND__", BRAND),
  };
}

export default defineConfig({
  server: { allowedHosts: ["terminal.local"] },
  plugins: [react(), brandAssets()],
  define: {
    // 版本号从 package.json 注入，避免设置的「版本」和安装包对不上
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
