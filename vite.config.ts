import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { BRAND } from "./src/brand.ts";

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
});
