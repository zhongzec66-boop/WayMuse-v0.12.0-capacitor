import { useEffect, useRef } from "react";
import type { ChangeEvent, ComponentProps } from "react";

import WebDock from "./WebDock";
import { COMPOSE_SLOT_ID, useNativeCompose } from "../nativeCompose";
import type { Page } from "../types";

type DockProps = ComponentProps<typeof WebDock>;

const placeholders: Record<Page, string> = {
  聊天: "点击输入",
  Today: "今天要做什么",
  任务: "说说要做什么",
  记忆: "记点什么",
  角色: "说点什么",
};

/**
 * 原生形态的底部区域。
 *
 * 重要：这里**不渲染任何可见的输入框或 Tab 栏**。
 * 只保留一个透明锚点（原生玻璃条按它的矩形定位）和一块底部留白。
 * 发送/语音/附件都通过 Capacitor 事件从原生回传。
 */
export default function NativeDock(props: DockProps) {
  const { draft, setDraft, submit, overlay, dockHidden, onAttach, page } =
    props;

  const fileRef = useRef<HTMLInputElement | null>(null);

  useNativeCompose({
    enabled: true,
    hidden: overlay !== "" || Boolean(dockHidden),
    text: draft,
    placeholder: placeholders[page] ?? placeholders["聊天"],
    onTextChange: setDraft,
    onSubmit: submit,
    onAttach: () => fileRef.current?.click(),
  });

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isText =
      file.type.startsWith("text/") || /\.(txt|csv|md|json)$/i.test(file.name);
    const header = `name=${encodeURIComponent(file.name)};type=${encodeURIComponent(file.type || "application/octet-stream")};size=${file.size}`;

    if (!isText) {
      // 图片等二进制：只把元信息发过去，模型看不了图，由 H5 层提示
      onAttach(`[[FILE:${header}]]\n[[/FILE]]`);
      return;
    }

    const text = (await file.text()).slice(0, 16000);
    onAttach(`[[FILE:${header}]]\n${text}\n[[/FILE]]`);
  };

  // 键盘收起时也要保证最后一条消息可见：布局由 --kb-inset + 内容区 padding 负责
  useEffect(() => {
    if (!window.visualViewport) return;
    const viewport = window.visualViewport;
    const sync = () => {
      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      document.documentElement.style.setProperty("--kb-inset", `${inset}px`);
      document.documentElement.dataset.kb = inset > 40 ? "open" : "closed";
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);

  return (
    <div className="wr-dock-anchor" aria-hidden="true">
      {/* 这里只放输入框锚点。锚点的 bottom 已经让出了标签栏高度，
         再叠一个 Tab 栏高度的占位块会把标签栏算两次，
         玻璃输入框就会浮到半空（和标签栏之间空出一大块）。 */}
      <div id={COMPOSE_SLOT_ID} className="wr-compose-slot" />
      <input
        ref={fileRef}
        type="file"
        className="wr-visually-hidden"
        onChange={(event) => void handleFile(event)}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
