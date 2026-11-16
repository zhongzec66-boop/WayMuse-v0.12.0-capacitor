import { createPortal } from "react-dom";
import { MessageCircle, CalendarDays, ListChecks, Sparkles } from "lucide-react";
import type { Page } from "../types";

/**
 * Duo 风格的竖向胶囊导航。
 *
 * 为什么不是"贴右边缘通栏"：6.1 寸手机上，贴右边缘 + 顶部工具按钮
 * 单手拇指够不到。这里做成右下悬浮短胶囊，视觉接近 Duo，但可达性成立。
 *
 * 只在手机/窄屏启用；宽屏走网页版四列布局里的右栏。
 */

const ITEMS: Array<{ page: Page; label: string; icon: typeof MessageCircle }> = [
  { page: "聊天", label: "聊天", icon: MessageCircle },
  { page: "Today", label: "Today", icon: CalendarDays },
  { page: "任务", label: "计划", icon: ListChecks },
  { page: "记忆", label: "记忆", icon: Sparkles },
];

export default function DuoRail({
  page,
  onNavigate,
}: {
  page: Page;
  onNavigate: (next: Page) => void;
}) {
  // 用 portal 挂到 body：Dock 在 .wr-phone 里，带有 transform/overflow，
  // fixed 会被它当参照系，实测宽高为 0 且被裁掉。
  return createPortal(
    <nav className="wr-duo-rail" aria-label="主导航">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = page === item.page;
        return (
          <button
            key={item.page}
            type="button"
            className={active ? "wr-duo-item on" : "wr-duo-item"}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            onClick={() => onNavigate(item.page)}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </nav>,
    document.body,
  );
}
