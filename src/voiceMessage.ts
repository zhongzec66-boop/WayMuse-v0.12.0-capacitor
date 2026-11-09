import { Capacitor } from "@capacitor/core";
import { DEFAULT_VOICE, synthesizeSpeech } from "./breeze";
import type { BreezeConfig } from "./breeze";
import { playAudioNative, stopAudioNative } from "./nativeExtras";

/**
 * agent 的语音消息。
 *
 * 用 Breeze API 合成（用户自带 key），不是系统 TTS：
 * 声音是「这个 agent 的声音」，跨平台一致，也方便以后换音色。
 *
 * 同一条消息只合成一次（缓存 Blob URL），重复点播放不会再花钱。
 */

const urlCache = new Map<string, string>();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.onerror = () => reject(new Error("音频编码失败"));
    reader.readAsDataURL(blob);
  });
}

export type VoiceStatus = "idle" | "loading" | "ready" | "playing" | "error";

export type VoiceState = {
  status: VoiceStatus;
  url?: string;
  error?: string;
};

export function hasBreezeKey(): boolean {
  // 延迟到调用方传 key，这里只给 UI 一个快速判断
  return true;
}

/** 取缓存的音频地址；没有就调 Breeze 合成一次 */
export async function ensureVoiceUrl(
  messageId: string,
  text: string,
  config: BreezeConfig,
): Promise<string> {
  const cached = urlCache.get(messageId);
  if (cached) return cached;

  const blob = await synthesizeSpeech(text, config);
  const url = URL.createObjectURL(blob);
  urlCache.set(messageId, url);
  return url;
}

/** 播放一段已经合成好的音频 */
export async function playVoice(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // 原生播放器更稳（后台、锁屏、音量都走系统）
    const blob = await fetch(url).then((response) => response.blob());
    const base64 = await blobToBase64(blob);
    await playAudioNative(base64);
    return;
  }

  const audio = new Audio(url);
  await audio.play();
}

export async function stopVoice(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await stopAudioNative();
  }
}

export function defaultVoiceId(): string {
  return DEFAULT_VOICE;
}

export function clearVoiceCache(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

/** 把 markdown / 契约块压成能念的纯文本 */
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
