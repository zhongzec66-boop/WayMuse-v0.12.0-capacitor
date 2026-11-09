import type { ComponentProps } from "react";
import WebDock from "./WebDock";
import NativeDock from "./NativeDock";
import { useNativeDock } from "../env";

type DockProps = ComponentProps<typeof WebDock>;

/**
 * 底部区域的入口：按运行环境二选一。
 *
 * - 浏览器 / ?web=1：完整渲染 React 的 TabBar + 输入框（方便调试）
 * - 原生 App：只渲染透明锚点，视觉与交互全部交给原生插件
 */
export default function Dock(props: DockProps) {
  if (!useNativeDock) return <WebDock {...props} />;
  return <NativeDock {...props} />;
}
