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

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  calendar: string;
};

export type CalendarDraft = {
  title: string;
  /** ISO8601 */
  start: string;
  end?: string;
  notes?: string;
};

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
  addListener(
    event: "speechDebug",
    listener: (event: Record<string, unknown>) => void,
  ): Promise<PluginListenerHandle>;
  calendarStatus(): Promise<{ granted: boolean; rawStatus: number }>;
  requestCalendar(): Promise<{ granted: boolean }>;
  readEvents(options: {
    start?: string;
    end?: string;
  }): Promise<{ events: CalendarEvent[] }>;
  addEvent(options: {
    title: string;
    start: string;
    end?: string;
    notes?: string;
  }): Promise<{ ok: boolean; id: string }>;
  addReminder(options: {
    title: string;
    due?: string;
  }): Promise<{ ok: boolean }>;
  playAudio(options: { base64: string }): Promise<{ finished?: boolean }>;
  stopAudio(): Promise<void>;
  endAudioSession(): Promise<void>;
  beginCallAudio(): Promise<{ ok: boolean }>;
  endCallAudio(): Promise<void>;
  audioRoute(): Promise<{
    outputs: Array<{ port: string; name: string }>;
    category: string;
    mode: string;
  }>;
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

/* ── 本地语音识别（端上，不上传音频）────────────── */

export async function startSpeech(
  locale = "zh-CN",
  options: { onDevice?: boolean } = {},
): Promise<void> {
  await NativeExtras.startSpeech({
    locale,
    onDevice: options.onDevice ?? true,
  });
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
  debug: (cb: (event: Record<string, unknown>) => void) =>
    NativeExtras.addListener("speechDebug", cb),
};

/* ── 日历 / 提醒事项 ─────────────────────────────── */

/** 确保拿到日历权限；用户拒绝返回 false。 */
export async function ensureCalendarAccess(): Promise<boolean> {
  if (!isNativeExtrasSupported()) return false;
  try {
    const status = await NativeExtras.calendarStatus();
    if (status.granted) return true;
    const result = await NativeExtras.requestCalendar();
    return result.granted;
  } catch {
    return false;
  }
}

export async function readCalendarEvents(
  startISO?: string,
  endISO?: string,
): Promise<CalendarEvent[]> {
  if (!isNativeExtrasSupported()) return [];
  try {
    const result = await NativeExtras.readEvents({
      start: startISO,
      end: endISO,
    });
    return result.events ?? [];
  } catch {
    return [];
  }
}

export async function addEventToCalendar(
  draft: CalendarDraft,
): Promise<boolean> {
  if (!isNativeExtrasSupported()) return false;
  try {
    const ok = await ensureCalendarAccess();
    if (!ok) return false;
    await NativeExtras.addEvent(draft);
    return true;
  } catch {
    return false;
  }
}

/** 把一段音频交给原生播（锁扬声器，播完才 resolve）。 */
export async function playAudioNative(base64: string): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  await NativeExtras.playAudio({ base64 });
}

export async function stopAudioNative(): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  try {
    await NativeExtras.stopAudio();
  } catch {
    // ignore
  }
}

/** 当前是从哪出声的：扬声器 / 听筒 / 耳机。 */
export async function getAudioRoute(): Promise<string> {
  if (!isNativeExtrasSupported()) return "";
  try {
    const result = await NativeExtras.audioRoute();
    const port = result.outputs?.[0]?.port ?? "";
    if (port.includes("Speaker")) return "扬声器";
    if (port.includes("Receiver")) return "听筒";
    if (port.includes("Bluetooth") || port.includes("AirPlay")) return "蓝牙";
    if (port.includes("Headphones") || port.includes("Headset")) return "耳机";
    return result.outputs?.[0]?.name ?? "";
  } catch {
    return "";
  }
}

/** 进入通话音频模式：开硬件回声消除，允许「边说边听」。 */
export async function beginCallAudio(): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  try {
    await NativeExtras.beginCallAudio();
  } catch {
    // 失败就退回普通模式，不影响通话本身
  }
}

export async function endCallAudio(): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  try {
    await NativeExtras.endCallAudio();
  } catch {
    // ignore
  }
}

/** 通话结束时把音频会话关掉，恢复系统默认路由。 */
export async function endAudioSession(): Promise<void> {
  if (!isNativeExtrasSupported()) return;
  try {
    await NativeExtras.endAudioSession();
  } catch {
    // ignore
  }
}

export async function addReminder(
  title: string,
  dueISO?: string,
): Promise<boolean> {
  if (!isNativeExtrasSupported()) return false;
  try {
    await NativeExtras.addReminder({ title, due: dueISO });
    return true;
  } catch {
    return false;
  }
}
