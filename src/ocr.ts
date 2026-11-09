import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * 图片转文字。
 *
 * 用 iOS 自带的 Vision（`VNRecognizeTextRequest`）：在设备本地识别，
 * 图片不上传、不需要 key、不增加包体。
 * 非 iOS 环境返回空字符串，由调用方降级成「只记文件名」。
 */

interface NativeExtrasBridge {
  recognizeText(options: { base64: string }): Promise<{ text: string }>;
  extractPdfText(options: {
    base64: string;
  }): Promise<{ text: string; scanned?: boolean }>;
}

const NativeExtras = registerPlugin<NativeExtrasBridge>("NativeExtras");

/** PDF 也走原生：PDFKit 比 pdf.js 稳，扫描件还能自动 OCR */
export async function extractPdfTextNative(
  file: File,
): Promise<{ text: string; scanned: boolean } | null> {
  if (!isOcrSupported()) return null;
  try {
    const base64 = await fileToBase64(file);
    const result = await NativeExtras.extractPdfText({ base64 });
    return {
      text: (result.text ?? "").trim(),
      scanned: Boolean(result.scanned),
    };
  } catch {
    return null;
  }
}

export function isOcrSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/** File → base64（去掉 data URL 前缀，原生只收纯 base64） */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读不出这张图片"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 识别图片里的文字。
 * 返回空字符串表示「没认出来」（空白图、纯照片），不是出错。
 */
export async function recognizeImageText(file: File): Promise<string> {
  if (!isOcrSupported()) return "";
  try {
    const base64 = await fileToBase64(file);
    const result = await NativeExtras.recognizeText({ base64 });
    return (result.text ?? "").trim();
  } catch {
    return "";
  }
}
