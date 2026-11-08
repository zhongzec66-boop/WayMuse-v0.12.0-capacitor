import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

/**
 * 原生「震动 + 本地语音识别」的 JS 桥。
 *
 * 对应的 Swift 实现是 `patches/liquid-glass/NativeExtrasPlugin.swift`，
 * 由 postinstall 注入 SPM target、由 register 脚本写进 packageClassList。
 *
 * 非 iOS 环境全部降级为 no-op，调用方不需要自己判断平台。
 */

export type ImpactStyle = "light" | "medium" | "heavy" | "soft" | "rigid";
export type NotifyStyle = "success" | "warning" | "error";

type SpeechPayload = { text: string; final?: boolean };
type SpeechFailure = { message: string };

interface NativeExtras {
  impact(options: { style: ImpactStyle }): Promise<void>;
  notify(options: { type: NotifyStyle }): Promise<void>;
  startSpeech(options: { locale?: string; onDevice?: boolean }): Promise<void>;
  stopSpeech(): Promise<void>;
  cancelSpeech(): Promise<void>;
  addListener(
    event: "speechPartial",
    listener: (event: SpeechPayload) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "speechFinal",
    listener: (event: SpeechPayload) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "speechError",
    listener: (event: SpeechFailure) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "speechCancelled",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}

const NativeExtras = registerPlugin<NativeExtras>("NativeExtras");

export function isNativeExtrasSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

/** 轻触反馈；非 iOS 静默返回。 */
export async function haptic(style: ImpactStyle = "light"): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  try {
    await NativeExtras.impact({ style });
  } catch {
    // 震动失败不该影响任何交互
  }
}

/** 结果类反馈（成功 / 警告 / 失败）。 */
export async function hapticNotify(
  type: NotifyStyle = "success",
): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  try {
    await NativeExtras.notify({ type });
  } catch {
    // 同上
  }
}

export async function startSpeech(locale = "zh-CN"): Promise<void> {
  await NativeExtras.startSpeech({ locale, onDevice: true });
}

export async function stopSpeech(): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  try {
    await NativeExtras.stopSpeech();
  } catch {
    // ignore
  }
}

export async function cancelSpeech(): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  try {
    await NativeExtras.cancelSpeech();
  } catch {
    // ignore
  }
}

export const speechEvents = {
  partial: (cb: (event: SpeechPayload) => void) =>
    NativeExtras.addListener("speechPartial", cb),
  final: (cb: (event: SpeechPayload) => void) =>
    NativeExtras.addListener("speechFinal", cb),
  error: (cb: (event: SpeechFailure) => void) =>
    NativeExtras.addListener("speechError", cb),
  cancelled: (cb: () => void) =>
    NativeExtras.addListener("speechCancelled", cb),
};
