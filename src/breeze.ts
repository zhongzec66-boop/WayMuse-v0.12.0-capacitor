import { Capacitor, CapacitorHttp } from "@capacitor/core";

/**
 * Breeze TTS 客户端。
 *
 * 实测：`POST /v1/text-to-speech/{voiceId}` + `xi-api-key` + `{"text","model_id"}`
 * 直接返回 `audio/mpeg`。注意 **不能带 output_format 字段**，REST 会 422。
 *
 * 浏览器里这个域名会被 CORS 拦，所以原生端走 CapacitorHttp（走系统网络栈，
 * 不受 CORS 限制）；Web 预览保留 fetch 作为开发期的兜底。
 */

const BREEZE_BASE = "https://api.breeze.blue";
const MODEL = "breeze-tts-2";

export const DEFAULT_VOICE = "voc_xeh3w54cqvnp";

export type BreezeConfig = { apiKey: string; voiceId: string };

function base64ToBlob(base64: string, type: string): Blob {
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function describeFailure(status: number, payload: unknown): string {
  if (status === 401 || status === 403)
    return "Breeze 拒绝了这把 key（401/403）";
  if (status === 404) return "Voice ID 不存在，检查一下是不是抄错了";
  if (status === 422) return "请求参数被拒绝（422），检查文本是否为空";
  if (status === 429) return "额度或频率超限（429），等一会儿再试";
  if (status >= 500) return `Breeze 服务端出错（${status}），稍后重试`;
  if (typeof payload === "string" && payload.length < 200) return payload;
  return `合成失败（HTTP ${status}）`;
}

/** 把一段文字合成成 MP3 Blob。 */
export async function synthesizeSpeech(
  text: string,
  config: BreezeConfig,
): Promise<Blob> {
  const voice = config.voiceId.trim() || DEFAULT_VOICE;
  const url = `${BREEZE_BASE}/v1/text-to-speech/${encodeURIComponent(voice)}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "xi-api-key": config.apiKey.trim(),
  };
  const body = { text: text.slice(0, 600), model_id: MODEL };

  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.post({
        url,
        headers,
        data: body,
        responseType: "arraybuffer",
      });
      if (response.status >= 400) {
        throw new Error(describeFailure(response.status, response.data));
      }
      const data: unknown = response.data;
      if (typeof data === "string") return base64ToBlob(data, "audio/mpeg");
      return new Blob([data as ArrayBuffer], { type: "audio/mpeg" });
    } catch (error) {
      // 老版本原生桥里没有 CapacitorHttp 时退回 fetch，别直接崩
      const message = error instanceof Error ? error.message : String(error);
      if (!/not implemented|unimplemented|not available/i.test(message)) {
        throw error;
      }
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.text();
    } catch {
      detail = "";
    }
    throw new Error(describeFailure(res.status, detail));
  }
  return await res.blob();
}

let currentAudio: HTMLAudioElement | null = null;
let currentUrl = "";

/** 播一段音频；重复调用会打断上一段。 */
export async function speak(text: string, config: BreezeConfig): Promise<void> {
  const blob = await synthesizeSpeech(text, config);
  stopSpeaking();
  currentUrl = URL.createObjectURL(blob);
  const audio = new Audio(currentUrl);
  currentAudio = audio;
  audio.onended = () => stopSpeaking();
  await audio.play();
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = "";
  }
}

export function isSpeaking(): boolean {
  return Boolean(currentAudio && !currentAudio.paused);
}
