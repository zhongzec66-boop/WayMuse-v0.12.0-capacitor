import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * 语音合成。
 *
 * 原生：系统 TTS（AVSpeechSynthesizer），零配置、离线、免费
 * 浏览器：Web Speech API，调试时也能听
 */

type TTSApi = {
  speak: (options: {
    text: string;
    language?: string;
    rate?: number;
  }) => Promise<{ started: boolean }>;
  stop: () => Promise<void>;
  isSpeaking: () => Promise<{ speaking: boolean }>;
};

const NativeTTS = registerPlugin<TTSApi>("NativeTTS");

export function isTTSAvailable(): boolean {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.isPluginAvailable("NativeTTS");
  }
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export async function speak(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("NativeTTS")) return;
    await NativeTTS.speak({ text: trimmed, language: "zh-CN" }).catch(
      () => undefined,
    );
    return;
  }

  // 浏览器兜底
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(trimmed.slice(0, 1200));
  utterance.lang = "zh-CN";
  utterance.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export async function stopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("NativeTTS")) return;
    await NativeTTS.stop().catch(() => undefined);
    return;
  }
  window.speechSynthesis?.cancel();
}

export async function isSpeaking(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("NativeTTS")) return false;
    const result = await NativeTTS.isSpeaking().catch(() => null);
    return Boolean(result?.speaking);
  }
  return window.speechSynthesis?.speaking ?? false;
}

/** 把 markdown/富文本压成能读的纯文本 */
export function toSpeechText(raw: string): string {
  return raw
    .replace(/<plans>[\s\S]*?<\/plans>/g, "")
    .replace(/<memories>[\s\S]*?<\/memories>/g, "")
    .replace(/<courses>[\s\S]*?<\/courses>/g, "")
    .replace(/```[\s\S]*?```/g, "（代码略过）")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
