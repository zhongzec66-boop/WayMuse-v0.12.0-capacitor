import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronRight, RotateCcw, Trash2, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import {
  DOCS,
  docBullets,
  docDefault,
  docSummary,
  readDoc,
  removeBullet,
  writeDoc,
} from "../docs";
import type { DocId } from "../docs";
import type { Memory, Overlay, Page } from "../types";
import { useBubbleField } from "../useBubbleField";

type Bubble = {
  id: string;
  text: string;
  weight: number;
  from: "doc" | "chat";
};

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
  memories: Memory[];
  setMemories: Dispatch<SetStateAction<Memory[]>>;
  nav: (page: Page) => void;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
}) {
  const [docs, setDocs] = useState<Record<DocId, string>>(() => ({
    identity: readDoc("identity"),
    soul: readDoc("soul"),
    memory: readDoc("memory"),
  }));
  const [editing, setEditing] = useState<DocId | null>(null);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<Bubble | null>(null);

  const fieldRef = useRef<HTMLDivElement>(null);
  const tapRef = useRef<(id: string) => void>(() => undefined);

  // MEMORY.md 里的条目 + 对话里确认过的记忆，合并成气泡
  const bubbles = useMemo<Bubble[]>(() => {
    const docItems = docBullets(docs.memory);
    const fromDoc: Bubble[] = docItems.map((text, index) => ({
      id: `doc-${index}-${text.slice(0, 8)}`,
      text,
      weight: 2,
      from: "doc",
    }));
    const fromChat: Bubble[] = memories
      .filter((item) => !docItems.includes(item.text))
      .map((item) => ({
        id: item.id,
        text: item.text,
        weight: item.weight,
        from: "chat",
      }));
    return [...fromChat, ...fromDoc];
  }, [docs.memory, memories]);

  tapRef.current = (id: string) => {
    const hit = bubbles.find((item) => item.id === id);
    if (hit) setPicked(hit);
  };

  useBubbleField(fieldRef, bubbles.length, tapRef);

  const openDoc = (id: DocId) => {
    setEditing(id);
    setDraft(docs[id]);
  };

  const saveDoc = () => {
    if (!editing) return;
    const text = draft;
    setDocs((current) => ({ ...current, [editing]: text }));
    writeDoc(editing, text);
    setEditing(null);
  };

  const resetDoc = () => {
    if (!editing) return;
    setDraft(docDefault(editing));
  };

  const removeBubble = (bubble: Bubble) => {
    if (bubble.from === "doc") {
      const next = removeBullet(docs.memory, bubble.text);
      setDocs((current) => ({ ...current, memory: next }));
      writeDoc("memory", next);
    } else {
      setMemories(memories.filter((item) => item.text !== bubble.text));
    }
    setPicked(null);
  };

  // 打开编辑器时锁住页面滚动
  useEffect(() => {
    if (!editing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [editing]);

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
          <h2>三份文件，随时可改</h2>
          <p>
            我怎么称呼自己、按什么原则做事、记住了什么，都写在这三份明文里。
            你可以直接编辑，也可以让它忘掉某件事。
          </p>
          <button className="wr-tip-row" onClick={() => nav("聊天")}>
            <BookOpen /> 在聊天里告诉我更多 <span>›</span>
          </button>
        </div>
      )}

      {/* ── 三份文件 ─────────────────────────────── */}
      <section className="wr-doclist" aria-label="人格与记忆文件">
        {DOCS.map((doc) => {
          const text = docs[doc.id];
          const count = docBullets(text).length;
          return (
            <button
              key={doc.id}
              className="wr-docrow"
              onClick={() => openDoc(doc.id)}
            >
              <span className="wr-docrow-main">
                <b>{doc.filename}</b>
                <small>{docSummary(text)}</small>
              </span>
              <span className="wr-docrow-meta">
                {count > 0 ? `${count} 条` : doc.hint}
                <ChevronRight size={14} />
              </span>
            </button>
          );
        })}
      </section>

      {/* ── 记忆气泡场 ───────────────────────────── */}
      <section className="wr-bubblewrap" aria-label="记忆">
        <header className="wr-bubblewrap-head">
          <span>记忆气泡</span>
          <em>
            {bubbles.length} 条{bubbles.length > 0 && " · 拖动看看"}
          </em>
        </header>

        {bubbles.length === 0 ? (
          <p className="wr-bubblewrap-empty">
            还没有记忆。聊天里出现值得记住的细节时，我会先问你；你也可以直接编辑
            MEMORY.md。
          </p>
        ) : (
          <div className="wr-bubblefield" ref={fieldRef}>
            {bubbles.map((item) => (
              <button
                key={item.id}
                type="button"
                data-bubble={item.id}
                data-weight={item.weight}
                className="wr-membubble"
                aria-label={`查看记忆：${item.text}`}
              >
                {item.text}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── 编辑器 ───────────────────────────────── */}
      {editing && (
        <div className="wr-overlay wr-overlay-fixed">
          <div className="wr-doceditor">
            <div className="wr-doceditor-head">
              <button aria-label="取消" onClick={() => setEditing(null)}>
                <X />
              </button>
              <b>{DOCS.find((doc) => doc.id === editing)?.filename}</b>
              <button aria-label="恢复默认模板" onClick={resetDoc}>
                <RotateCcw size={17} />
              </button>
            </div>
            <p className="wr-doceditor-hint">
              这是明文文件，AI 每次对话都会读它。改完记得保存。
            </p>
            <textarea
              className="wr-doceditor-area"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
            />
            <div className="wr-doceditor-actions">
              <button className="wr-doceditor-save" onClick={saveDoc}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 单条记忆 ─────────────────────────────── */}
      {picked && (
        <div className="wr-overlay wr-overlay-fixed">
          <div className="wr-sheet">
            <div className="wr-sheet-head">
              <button onClick={() => setPicked(null)} aria-label="关闭">
                <X />
              </button>
              <h2>这条记忆</h2>
              <span />
            </div>
            <p className="wr-picked-text">{picked.text}</p>
            <p className="wr-doceditor-hint">
              来源：{picked.from === "doc" ? "MEMORY.md" : "对话中确认"}
            </p>
            <button
              className="wr-doceditor-save danger"
              onClick={() => removeBubble(picked)}
            >
              <Trash2 size={15} /> 从记忆里删掉
            </button>
          </div>
        </div>
      )}
    </>
  );
}
