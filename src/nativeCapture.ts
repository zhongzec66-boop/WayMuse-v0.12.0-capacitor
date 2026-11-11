import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Android 原生拍照 / 选图。
 *
 * WebView 的 <input type="file"> 在 Android 上会走系统选择器，
 * 相机返回的大图容易 OOM（表现为闪退）。原生侧已经降采样到 1600px。
 */

export type CapturedPhoto = {
  dataUrl: string;
  name: string;
  width?: number;
  height?: number;
};

type NativeCapturePlugin = {
  capture(): Promise<CapturedPhoto>;
  pick(): Promise<CapturedPhoto>;
};

const NativeCapture = registerPlugin<NativeCapturePlugin>("NativeCapture");

export function hasNativeCapture(): boolean {
  return Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform();
}

export function capturePhoto(): Promise<CapturedPhoto> {
  return NativeCapture.capture();
}

export function pickPhoto(): Promise<CapturedPhoto> {
  return NativeCapture.pick();
}

/** dataUrl → File，方便复用现有的文件解析流程 */
export async function photoToFile(photo: CapturedPhoto): Promise<File> {
  const response = await fetch(photo.dataUrl);
  const blob = await response.blob();
  return new File([blob], photo.name || "photo.jpg", {
    type: blob.type || "image/jpeg",
  });
}
