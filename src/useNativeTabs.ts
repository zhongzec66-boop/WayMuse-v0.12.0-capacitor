import { LiquidGlass } from "@ajuarezso/capacitor-liquid-glass";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";
import type { Page } from "./types";

const pages: Page[] = ["聊天", "Today", "任务", "记忆", "角色"];
const items = [
  { id: "聊天", label: "聊天", sfSymbol: "bubble.left" },
  { id: "Today", label: "Today", sfSymbol: "calendar" },
  { id: "任务", label: "计划", sfSymbol: "checklist" },
  { id: "记忆", label: "记忆", sfSymbol: "sparkles" },
  { id: "角色", label: "助理", sfSymbol: "person.crop.circle" },
];

const TAB_HEIGHT_VAR = "--native-tabbar";

/**
 * 把原生 Tab 栏的真实高度写进 CSS 变量。
 *
 * 原生 UITabBar 的高度由系统决定（约 49pt + 底部安全区），
 * 绝不能用 DOM 槽位去"框住"它 —— 塞不下就会像之前那样把图标和文字压扁裁掉。
 * 所以这里反过来：让原生栏贴底自由排布，再用它回报的高度把输入框和内容顶上去。
 */
function setTabHeight(px: number): void {
  const root = document.documentElement;
  if (px > 0) root.style.setProperty(TAB_HEIGHT_VAR, `${px}px`);
  else root.style.removeProperty(TAB_HEIGHT_VAR);
}

export function useNativeTabs(
  page: Page,
  entered: boolean,
  overlay: string,
  navigate: (page: Page) => void,
): boolean {
  const [active, setActive] = useState(false);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const ios = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  // 选区事件
  useEffect(() => {
    if (!ios || !entered) return;
    let disposed = false;
    let listener:
      Awaited<ReturnType<typeof LiquidGlass.addListener>> | undefined;
    void LiquidGlass.addListener("tabSelected", ({ id }) => {
      if (pages.includes(id as Page)) navigateRef.current(id as Page);
    })
      .then((handle) => {
        if (disposed) void handle.remove();
        else listener = handle;
      })
      .catch(() => setActive(false));
    return () => {
      disposed = true;
      void listener?.remove();
      void LiquidGlass.hideTabBar();
      setActive(false);
      setTabHeight(0);
    };
  }, [ios, entered]);

  // 显示 / 隐藏
  useEffect(() => {
    if (!ios || !entered) return;
    if (overlay) {
      void LiquidGlass.hideTabBar();
      setTabHeight(0);
      setActive(false);
      return;
    }

    let cancelled = false;
    let layoutListener:
      Awaited<ReturnType<typeof LiquidGlass.addListener>> | undefined;

    // 转屏、安全区变化时同步高度
    void LiquidGlass.addListener("tabBarLayoutChanged", ({ height }) => {
      if (!cancelled) setTabHeight(height);
    })
      .then((handle) => {
        if (cancelled) void handle.remove();
        else layoutListener = handle;
      })
      .catch(() => undefined);

    const tint =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim() || "#1f4d3a";

    // 注意：这里**不传 containerElement**。绑 DOM 矩形会把原生栏压进
    // 一个过小的框里（图标/文字被裁），改为系统默认的贴底布局。
    void LiquidGlass.showTabBar({
      items,
      selectedIndex: pages.indexOf(page),
      tintColor: tint,
      tabBarStyle: "liquidGlass",
    })
      .then(async () => {
        if (cancelled) {
          void LiquidGlass.hideTabBar();
          return;
        }
        setActive(true);
        try {
          const layout = await LiquidGlass.getTabBarLayout();
          if (cancelled) return;
          setTabHeight(layout.height);
          // 高度变化会让底部区域重排，通知一下输入框重新量一次位置
          window.dispatchEvent(new Event("resize"));
        } catch {
          // 拿不到高度就退回 CSS 默认值，不影响 Tab 栏本身
        }
      })
      .catch(() => setActive(false));

    return () => {
      cancelled = true;
      void layoutListener?.remove();
    };
  }, [ios, entered, overlay]);

  // 选中态同步
  useEffect(() => {
    if (ios && active && !overlay) {
      void LiquidGlass.setSelectedTab({ id: page });
    }
  }, [ios, active, overlay, page]);

  return active && !overlay;
}
