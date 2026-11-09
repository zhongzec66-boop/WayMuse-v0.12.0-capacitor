/**
 * 第三方模块的类型补丁。
 *
 * 这两个模块没有可用的类型声明：
 * - Vite 的 `?url` 导入（pdf.js 的 worker）
 * - mammoth 的浏览器构建（npm 包里只带 node 版的 .d.ts）
 */

declare module "*?url" {
  const url: string;
  export default url;
}

declare module "mammoth/mammoth.browser" {
  export function extractRawText(options: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}

declare module "mammoth" {
  export function extractRawText(options: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}
