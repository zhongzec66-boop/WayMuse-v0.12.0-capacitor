import { Capacitor } from "@capacitor/core";
import { synthesizeSpeech } from "./breeze";
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

export type VoiceMode = "api" | "system";

export type VoiceState = {
  status: VoiceStatus;
  url?: string;
  /** 秒；0 表示拿不到时长，UI 不显示 */
  duration?: number;
  error?: string;
};

/** 读音频时长；拿不到就返回 0，UI 会退回不显示时长 */
export function readDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (value: number) => resolve(Number.isFinite(value) ? value : 0);
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

export type VoiceClip = { url: string; duration: number };

/** 取缓存的音频；没有就调 Breeze 合成一次（带时长） */
export async function ensureVoice(
  messageId: string,
  text: string,
  config: BreezeConfig,
): Promise<VoiceClip> {
  const cached = urlCache.get(messageId);
  if (cached) {
    return { url: cached, duration: await readDuration(cached) };
  }

  const blob = await synthesizeSpeech(text, config);
  const url = URL.createObjectURL(blob);
  urlCache.set(messageId, url);
  return { url, duration: await readDuration(url) };
}

/** 浏览器里正在播的元素；原生走 playAudioNative，不用这个 */
let webAudio: HTMLAudioElement | null = null;

function stopWebAudio(): void {
  if (!webAudio) return;
  webAudio.pause();
  webAudio = null;
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

  // 先停掉上一条，避免两段声音重叠
  stopWebAudio();
  const audio = new Audio(url);
  webAudio = audio;
  audio.onended = () => {
    if (webAudio === audio) webAudio = null;
  };
  await audio.play();
}

export async function stopVoice(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await stopAudioNative();
  }
  // 审查时发现：原先浏览器分支只调了原生 stop（no-op），
  // 点「停止」其实停不掉网页里的 Audio，这里补上。
  stopWebAudio();
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
