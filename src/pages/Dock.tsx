import {
  CalendarDays,
  Camera,
  FilePlus2,
  ListTodo,
  MessageCircle,
  Mic2,
  AudioLines,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Kind, Overlay, Page } from "../types";

export default function Dock({
  nativeTabsActive,
  attachmentMenu,
  setAttachmentMenu,
  draft,
  setDraft,
  overlay,
  submit,
  openIntake,
  page,
  nav,
  agentName,
  agentAvatar,
}: {
  nativeTabsActive: boolean;
  attachmentMenu: boolean;
  setAttachmentMenu: Dispatch<SetStateAction<boolean>>;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  overlay: Overlay;
  submit: () => void;
  openIntake: (kind: Kind) => void;
  page: Page;
  nav: (page: Page) => void;
  agentName: string;
  agentAvatar: string;
}) {
  return (
    <div className="wr-dock">
      {attachmentMenu && (
        <div className="wr-attachment-menu">
          <button onClick={() => openIntake("图片")}>
            <Camera size={20} />
            上传照片或图片
          </button>
          <button onClick={() => openIntake("文档")}>
            <FilePlus2 size={20} />
            上传文件
          </button>
          <button onClick={() => openIntake("语音")}>
            <Mic2 size={20} />
            录制或上传语音
          </button>
          <button onClick={() => openIntake("课表")}>
            <CalendarDays size={20} />
            添加课程
          </button>
        </div>
      )}
      <div className="wr-compose">
        <button
          aria-label="添加附件"
          aria-expanded={attachmentMenu}
          onClick={() => setAttachmentMenu(!attachmentMenu)}
        >
          <Plus />
        </button>
        <input
          value={overlay === "新增任务" || overlay === "添加记忆" ? "" : draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="点击输入或录制语音…"
        />
        <button
          aria-label={draft ? "发送" : "录制语音"}
          onClick={draft ? submit : () => openIntake("语音")}
        >
          {draft ? (
            <Send size={20} />
          ) : (
            <span className="wr-voice-ring">
              <AudioLines size={21} />
            </span>
          )}
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
              <img src={agentAvatar || "/avatar.svg"} alt="" />
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
