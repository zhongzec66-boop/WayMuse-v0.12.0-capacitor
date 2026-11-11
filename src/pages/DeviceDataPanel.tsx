import { useEffect, useState } from "react";
import { Footprints, Smartphone } from "lucide-react";
import {
  hasNativeInsights,
  insightsStatus,
  openUsageAccessSettings,
  refreshInsights,
  requestActivityPermission,
  type InsightsSnapshot,
  type InsightsStatus,
} from "../nativeInsights";

/**
 * 设备数据授权面板。
 *
 * 只在 Android 原生里出现；iOS 不做（需要付费账号的 HealthKit 能力）。
 */
export default function DeviceDataPanel() {
  const [status, setStatus] = useState<InsightsStatus | null>(null);
  const [snapshot, setSnapshot] = useState<InsightsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!hasNativeInsights()) return;
    try {
      setStatus(await insightsStatus());
      setSnapshot(await refreshInsights());
    } catch {
      // 插件缺失或系统拒绝，保持未授权状态
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!hasNativeInsights()) return null;

  const usageGranted = status?.usageAccess ?? false;
  const activityGranted = status?.activityPermission ?? false;
  const stepsSupported = status?.stepsSupported ?? false;

  const usageLabel = usageGranted
    ? snapshot && snapshot.usageMinutes > 0
      ? `今天 ${Math.floor(snapshot.usageMinutes / 60)} 小时 ${snapshot.usageMinutes % 60} 分`
      : "已授权"
    : "未授权";

  const stepsLabel = !stepsSupported
    ? "本机不支持"
    : activityGranted
      ? snapshot && snapshot.steps > 0
        ? `今天 ${snapshot.steps} 步`
        : "已授权"
      : "未授权";

  return (
    <>
      <button
        type="button"
        className="wr-settings-row"
        onClick={() => {
          if (usageGranted) {
            void load();
            return;
          }
          setBusy(true);
          void openUsageAccessSettings().finally(() => setBusy(false));
        }}
      >
        <span>
          <Smartphone size={16} /> 屏幕使用时间
          <em className="wr-settings-sub">
            {busy ? "正在打开系统设置…" : "只在本机读取，用于更了解你的作息"}
          </em>
        </span>
        <span className="wr-settings-chevron">{usageLabel}</span>
      </button>
      <button
        type="button"
        className="wr-settings-row"
        disabled={!stepsSupported}
        onClick={() => {
          if (activityGranted) {
            void load();
            return;
          }
          setBusy(true);
          void requestActivityPermission()
            .then(() => load())
            .finally(() => setBusy(false));
        }}
      >
        <span>
          <Footprints size={16} /> 步数
          <em className="wr-settings-sub">
            {stepsSupported ? "用系统计步传感器，不上传" : "这台设备没有计步传感器"}
          </em>
        </span>
        <span className="wr-settings-chevron">{stepsLabel}</span>
      </button>
    </>
  );
}
