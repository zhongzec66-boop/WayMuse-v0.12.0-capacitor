import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  FileText,
  Footprints,
  Heart,
  Moon,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from "lucide-react";
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
import type { Memory, Overlay, Page, Task } from "../types";
import { formatFocus, formatSleep, useHealthSnapshot } from "../health";
import { useHideNativeChrome } from "../chrome";
import BrainMap from "./BrainMap";
import { inferHabits } from "../habits";
import { applyConsolidation, planConsolidation } from "../consolidation";
import { createMemory, storage } from "../storage";

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
  tasks,
  nav,
  setOverlay,
}: {
  showTip: boolean;
  setShowTip: Dispatch<SetStateAction<boolean>>;
  tasks: Task[];
  memories: Memory[];
  setMemories: Dispatch<SetStateAction<Memory[]>>;
  nav: (page: Page) => void;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
}) {
  // 记忆页分两个子页：大脑（图）与文件（三份明文 + 健康）
  const [tab, setTab] = useState<"brain" | "files">("brain");
  const [docs, setDocs] = useState<Record<DocId, string>>(() => ({
    identity: readDoc("identity"),
    soul: readDoc("soul"),
    memory: readDoc("memory"),
  }));
  const [editing, setEditing] = useState<DocId | null>(null);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<Bubble | null>(null);
  const health = useHealthSnapshot();

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


  // 编辑器和单条详情都是铺满屏幕的，原生 Tab 栏必须让位
  useHideNativeChrome(Boolean(editing) || Boolean(picked));

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

  // ── 记忆巩固 + 习惯推断（打开时算一次，不做定时器）──
  const [consolidating, setConsolidating] = useState(false);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    // 1) 习惯：纯规则推断，同签名被删过就不再生成
    const dismissed = storage.getDismissedHabitKeys();
    const habits = inferHabits(tasks, { dismissedKeys: dismissed });
    const fresh = habits
      .map((habit) => ({
        ...createMemory(habit.text, 2, "habit"),
        id: `habit-${habit.signature}`,
        status: "consolidated" as const,
        source: "inferred" as const,
      }))
      .filter((habit) => !memories.some((memory) => memory.id === habit.id));

    // 2) 巩固：先把数据改对，再播动画；动画失败也不回滚数据
    const plan = planConsolidation(memories, {
      lastConsolidatedAt: storage.getLastConsolidatedAt(),
    });
    const next = applyConsolidation([...memories, ...fresh], plan.promote);
    if (next !== memories && (fresh.length || plan.promote.length)) {
      setMemories(next);
    }
    if (plan.shouldAnimate) {
      storage.setLastConsolidatedAt(Date.now());
      setConsolidating(true);
      const timer = window.setTimeout(() => setConsolidating(false), 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // 只在进入页面时算一次
  }, []);

  // 删掉推断出来的习惯时，把签名记下来，之后不再重复生成
  const updateMemories = (next: Memory[]) => {
    const removedHabits = memories.filter(
      (memory) =>
        memory.kind === "habit" && !next.some((item) => item.id === memory.id),
    );
    if (removedHabits.length) {
      const keys = storage.getDismissedHabitKeys();
      const added = removedHabits.map((memory) => memory.id.replace("habit-", ""));
      storage.setDismissedHabitKeys([...new Set([...keys, ...added])]);
    }
    setMemories(next);
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

      <div className="wr-segment">
        <button
          className={tab === "brain" ? "selected" : ""}
          onClick={() => setTab("brain")}
        >
          大脑
        </button>
        <button
          className={tab === "files" ? "selected" : ""}
          onClick={() => setTab("files")}
        >
          文件
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

      {tab === "brain" && (
        <>
          <h2 className="wr-section-title">记忆</h2>
          <BrainMap
            memories={memories}
            onMemoriesChange={updateMemories}
            consolidating={consolidating}
            onSkipConsolidation={() => setConsolidating(false)}
          />
        </>
      )}

      {tab === "files" && (
        <>
          {/* ── 健康 ─────────────────────────────────── */}
      <section className="wr-health" aria-label="健康">
        <header className="wr-health-head">
          <span className="wr-health-mark">
            <Heart size={16} />
          </span>
          <span className="wr-health-title">
            <b>健康</b>
            <small>更新于 {health.updatedAt}</small>
          </span>
        </header>
        <div className="wr-health-grid">
          <div className="wr-health-tile">
            <Moon size={15} />
            <b>{formatSleep(health.sleepMinutes)}</b>
            <small>睡眠</small>
          </div>
          <div className="wr-health-tile">
            <Footprints size={15} />
            <b>{health.steps.toLocaleString("zh-CN")}</b>
            <small>步数</small>
          </div>
          <div className="wr-health-tile">
            <Activity size={15} />
            <b>{health.restingHeartRate}</b>
            <small>静息心率</small>
          </div>
          <div className="wr-health-tile">
            <Timer size={15} />
            <b>{formatFocus(health.focusMinutes)}</b>
            <small>专注</small>
          </div>
        </div>
      </section>

      {/* ── 文件 ─────────────────────────────────── */}
      <h2 className="wr-section-title">文件</h2>
      <section className="wr-filegrid" aria-label="人格与记忆文件">
        {DOCS.map((doc) => {
          const text = docs[doc.id];
          const count = docBullets(text).length;
          return (
            <button
              key={doc.id}
              className="wr-filecard"
              onClick={() => openDoc(doc.id)}
            >
              <span className="wr-filecard-mark">
                <FileText size={16} />
              </span>
              <b>{doc.filename}</b>
              <small>{docSummary(text)}</small>
              <em>{count > 0 ? `${count} 条` : doc.hint}</em>
            </button>
          );
        })}
      </section>

        </>
      )}

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
