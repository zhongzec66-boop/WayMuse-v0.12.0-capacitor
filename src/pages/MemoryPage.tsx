import { BRAND } from "../brand";
import { BookOpen, ChevronRight, FilePlus2, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Overlay, Page } from "../types";

export default function MemoryPage({
  showTip,
  setShowTip,
  memories,
  setMemories,
  nav,
  setOverlay,
}: {
  showTip: boolean;
  setShowTip: Dispatch<SetStateAction<boolean>>;
  memories: string[];
  setMemories: Dispatch<SetStateAction<string[]>>;
  nav: (page: Page) => void;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
}) {
  return (
    <>
      <div className="wr-head">
        <h1>记忆</h1>
        <button
          className="wr-round"
          aria-label="添加记忆"
          onClick={() => setOverlay("添加记忆")}
        >
          <BookOpen />
        </button>
      </div>
      {showTip && (
        <div className="wr-memory-tip">
          <button aria-label="关闭提示" onClick={() => setShowTip(false)}>
            <X size={17} />
          </button>
          <h2>让建议更贴近你</h2>
          <p>{BRAND} 会依据你确认的信息给出建议。你可以随时更改或删除。</p>
          <button className="wr-tip-row" onClick={() => nav("聊天")}>
            <FilePlus2 /> 告诉我更多关于你的事 <ChevronRight />
          </button>
        </div>
      )}
      <div className="wr-memory-card">
        <div className="wr-memory-card-title">
          我对你的了解 <span>演示资料</span>
        </div>
        {memories.map((m, i) => (
          <div className="wr-memory-line" key={i}>
            <span>{m}</span>
            <button
              aria-label={`删除${m}`}
              onClick={() => setMemories(memories.filter((_, n) => n !== i))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
