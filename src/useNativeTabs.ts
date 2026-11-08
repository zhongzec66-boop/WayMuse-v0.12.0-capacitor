import { LiquidGlass } from '@ajuarezso/capacitor-liquid-glass';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import type { Page } from './types';

const pages: Page[] = ['聊天', 'Today', '任务', '记忆', '角色'];
const items = [
  { id: '聊天', label: '聊天', sfSymbol: 'bubble.left' },
  { id: 'Today', label: 'Today', sfSymbol: 'calendar' },
  { id: '任务', label: '计划', sfSymbol: 'checklist' },
  { id: '记忆', label: '记忆', sfSymbol: 'sparkles' },
  { id: '角色', label: '助理', sfSymbol: 'person.crop.circle' },
];

export function useNativeTabs(
  page: Page,
  entered: boolean,
  overlay: string,
  navigate: (page: Page) => void,
): boolean {
  const [active, setActive] = useState(false);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const ios = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  useEffect(() => {
    if (!ios || !entered) return;
    let disposed = false;
    let listener: Awaited<ReturnType<typeof LiquidGlass.addListener>> | undefined;
    void LiquidGlass.addListener('tabSelected', ({ id }) => {
      if (pages.includes(id as Page)) navigateRef.current(id as Page);
    }).then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    }).catch(() => setActive(false));
    return () => {
      disposed = true;
      void listener?.remove();
      void LiquidGlass.hideTabBar();
      setActive(false);
    };
  }, [ios, entered]);

  useEffect(() => {
    if (!ios || !entered) return;
    if (overlay) {
      void LiquidGlass.hideTabBar();
      setActive(false);
      return;
    }
    let cancelled = false;
    const tint = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary').trim() || '#1f4d3a';
    void LiquidGlass.showTabBar({
      items,
      selectedIndex: pages.indexOf(page),
      tintColor: tint,
      tabBarStyle: 'liquidGlass',
      containerElement: 'waymuse-native-tab-slot',
    }).then(() => {
      if (cancelled) void LiquidGlass.hideTabBar();
      else setActive(true);
    }).catch(() => setActive(false));
    return () => { cancelled = true; };
  }, [ios, entered, overlay]);

  useEffect(() => {
    if (ios && active && !overlay) {
      void LiquidGlass.setSelectedTab({ id: page });
    }
  }, [ios, active, overlay, page]);

  return active && !overlay;
}
