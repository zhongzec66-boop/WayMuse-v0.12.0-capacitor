import {
  CalendarDays,
  Camera,
  FilePlus2,
  ListTodo,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { useRef } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import BotAvatar from "../BotAvatar";
import { haptic } from "../nativeExtras";

import type { Overlay, Page } from "../types";
import { COMPOSE_SLOT_ID, useNativeCompose } from "../nativeCompose";
import { buildFileBlock, extractFileText } from "../fileText";
import { recognizeImageText } from "../ocr";

export default function WebDock({
  nativeTabsActive,
  attachmentMenu,
  setAttachmentMenu,
  draft,
  setDraft,
  overlay,
  submit,
  onAttach,
  page,
  nav,
  agentName,
  agentAvatar,
  dockHidden,
}: {
  nativeTabsActive: boolean;
  attachmentMenu: boolean;
  setAttachmentMenu: Dispatch<SetStateAction<boolean>>;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  overlay: Overlay | "通话";
  submit: () => void;
  onAttach: (payload: string) => void;
  page: Page;
  nav: (page: Page) => void;
  agentName: string;
  agentAvatar: string;
  dockHidden?: boolean;
}) {
  const composeText =
    overlay === "新增任务" || overlay === "添加记忆" ? "" : draft;
  // 同一个 agent，五个工作面：占位符跟着当前页走，提示它此刻能帮什么。
  const basePlaceholder =
    page === "Today"
      ? "今天要做什么"
      : page === "任务"
        ? "说说要做什么"
        : page === "记忆"
          ? "记点什么"
          : page === "角色"
            ? "说点什么"
            : "点击输入";

  const fileRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);

  // 统一走 extractFileText：文本 / PDF / Word / Excel 都抽正文，
  // 图片走原生 OCR；都提取不到才退回「只记文件名」。
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAttachmentMenu(false);

    const extracted = await extractFileText(file);
    const content =
      extracted.source === "image"
        ? await recognizeImageText(file)
        : extracted.text;
    onAttach(buildFileBlock(file.name, file.size, content));
  };

  // iOS 上用原生输入框；其它环境（Web / 插件缺失）自动回退到下面的 <input>。
  // 状态直接体现在输入框里，不再弹浮条
  const placeholder = basePlaceholder;

  const nativeComposeActive = useNativeCompose({
    // WebDock 只在浏览器 / 调试模式使用，不接管原生输入框
    enabled: false,
    hidden: overlay !== "" || Boolean(dockHidden),
    text: composeText,
    placeholder,
    onTextChange: setDraft,
    onSubmit: submit,
    onAttach: () => setAttachmentMenu(!attachmentMenu),
  });

  return (
    <div className={nativeTabsActive ? "wr-dock wr-dock-native" : "wr-dock"}>
      {attachmentMenu && (
        <div className="wr-attachment-menu">
          <button onClick={() => imageRef.current?.click()}>
            <Camera size={20} />
            选一张图片
          </button>
          <button onClick={() => fileRef.current?.click()}>
            <FilePlus2 size={20} />
            选一个文件
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        className="wr-visually-hidden"
        onChange={handleFile}
        aria-label="选择要发送的文件"
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="wr-visually-hidden"
        onChange={handleFile}
        aria-label="选择要发送的图片"
      />
      <div
        id={COMPOSE_SLOT_ID}
        className={
          nativeComposeActive ? "wr-compose wr-compose-native" : "wr-compose"
        }
      >
        <button
          aria-label="添加附件"
          aria-expanded={attachmentMenu}
          onClick={() => setAttachmentMenu(!attachmentMenu)}
        >
          <Plus />
        </button>
        <input
          value={composeText}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={placeholder}
        />
        <button
          className="wr-compose-send"
          disabled={!draft.trim()}
          aria-label="发送"
          onClick={() => {
            if (!draft.trim()) return;
            void haptic("light");
            submit();
          }}
        >
          <Send size={19} />
        </button>
      </div>
      <nav
        id="waymuse-native-tab-slot"
        className={nativeTabsActive ? "wr-native-tabs" : undefined}
      >
        <div
          className="wr-tab-highlight"
          aria-hidden="true"
          style={{
            transform: `translateX(${
              ["聊天", "Today", "任务", "记忆", "角色"].indexOf(page) * 100
            }%)`,
          }}
        />
        {(
          [
            { key: "聊天", label: "聊天" },
            { key: "Today", label: "Today" },
            { key: "任务", label: "计划" },
            { key: "记忆", label: "记忆" },
            { key: "角色", label: agentName || "助理" },
          ] as { key: Page; label: string }[]
        ).map((item, i) => {
          const icons = [
            <MessageCircle />,
            <CalendarDays />,
            <ListTodo />,
            <Sparkles />,
            <span className="wr-small-orb">
              <BotAvatar source={agentAvatar} />
            </span>,
          ];
          return (
            <button
              aria-current={page === item.key ? "page" : undefined}
              className={page === item.key ? "active" : ""}
              key={item.key}
              onClick={() => nav(item.key)}
            >
              {icons[i]}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
