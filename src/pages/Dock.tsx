import {
  CalendarDays,
  Camera,
  FilePlus2,
  ListTodo,
  MessageCircle,
  AudioLines,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { useRef } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import BotAvatar from "../BotAvatar";
import { haptic } from "../nativeExtras";
import { useSpeechInput } from "../useSpeechInput";
import type { Kind, Overlay, Page } from "../types";
import {
  COMPOSE_SLOT_ID,
  isNativeComposeSupported,
  useNativeCompose,
} from "../nativeCompose";

export default function Dock({
  nativeTabsActive,
  attachmentMenu,
  setAttachmentMenu,
  draft,
  setDraft,
  overlay,
  submit,
  openIntake,
  onAttach,
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
  overlay: Overlay | "通话";
  submit: () => void;
  openIntake: (kind: Kind) => void;
  onAttach: (payload: string) => void;
  page: Page;
  nav: (page: Page) => void;
  agentName: string;
  agentAvatar: string;
}) {
  const composeText =
    overlay === "新增任务" || overlay === "添加记忆" ? "" : draft;
  // 同一个 agent，五个工作面：占位符跟着当前页走，提示它此刻能帮什么。
  const placeholder =
    page === "Today"
      ? "帮我梳理今天的安排…"
      : page === "任务"
        ? "让我帮你研究、规划或拆解…"
        : page === "记忆"
          ? "让我更了解你…"
          : page === "角色"
            ? "和助理说点什么…"
            : "点击输入或录制语音…";
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  // 右侧麦克风：原生本地识别，逐字回填到输入框，不跳页
  const speech = useSpeechInput(setDraft);

  // 文本类文件直接把内容带进对话；其它类型只带文件名，不假装能解析。
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAttachmentMenu(false);
    const isText =
      file.type.startsWith("text/") ||
      /\.(txt|md|markdown|mdx|csv|tsv|json|jsonl|log|ya?ml|html?|xml|svg|css|scss|jsx?|tsx?|py|java|c|cc|cpp|h|hpp|go|rs|rb|php|sh|sql|tex|ini|conf|toml)$/i.test(
        file.name,
      );
    const header = JSON.stringify({
      n: file.name.slice(0, 80),
      s: file.size,
      b: !isText,
    });
    let payload = `[[FILE:${header}]]` + "\n[[/FILE]]";
    if (isText && file.size <= 4 * 1024 * 1024) {
      const text = await file.text();
      const LIMIT = 16000;
      // 截断要说清楚，否则模型以为自己看到了全文
      const body =
        text.length > LIMIT
          ? `${text.slice(0, LIMIT)}\n（文件较长，以上是前 ${LIMIT} 字）`
          : text;
      payload = `[[FILE:${header}]]` + "\n" + body + "\n[[/FILE]]";
    } else if (!isText) {
      // 图片/PDF/Word 这类读不出文字，明确告诉模型它看不到内容
      payload =
        `[[FILE:${header}]]` +
        "\n（这是二进制文件，你只能看到文件名和大小，看不到里面的内容）" +
        "\n[[/FILE]]";
    }
    onAttach(payload);
  };

  // iOS 上用原生输入框；其它环境（Web / 插件缺失）自动回退到下面的 <input>。
  const nativeComposeActive = useNativeCompose({
    enabled: isNativeComposeSupported(),
    hidden: overlay !== "",
    text: composeText,
    placeholder,
    onTextChange: setDraft,
    onSubmit: submit,
    onAttach: () => setAttachmentMenu(!attachmentMenu),
    onVoice: () => {
      if (speech.supported) {
        speech.toggle();
        return;
      }
      openIntake("语音");
    },
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
          <button onClick={() => openIntake("课表")}>
            <CalendarDays size={20} />
            添加课程
          </button>
        </div>
      )}
      {speech.listening && (
        <div className="wr-listening" role="status">
          <span className="wr-listening-dot" />
          正在听…再点一下麦克风结束
        </div>
      )}
      {speech.error && !speech.listening && (
        <div className="wr-listening error" role="alert">
          {speech.error}
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
          className={speech.listening ? "wr-compose-mic listening" : undefined}
          aria-label={
            draft
              ? "发送"
              : speech.supported
                ? speech.listening
                  ? "结束语音输入"
                  : "语音输入"
                : "录制语音"
          }
          onClick={() => {
            if (draft) {
              void haptic("light");
              submit();
              return;
            }
            if (speech.supported) {
              speech.toggle();
              return;
            }
            openIntake("语音");
          }}
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
