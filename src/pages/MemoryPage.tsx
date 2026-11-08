import { useMemo, useState } from "react";
import { BookOpen, GraduationCap, Sparkles, Trash2, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { UserProfile } from "../profile";
import type { Memory, MemoryWeight, Overlay, Page } from "../types";

const WEIGHT_LABEL: Record<MemoryWeight, string> = {
  1: "小事",
  2: "一般",
  3: "重要",
};

function fact(value: string): string {
  return value.trim() || "未填写";
}

export default function MemoryPage({
  showTip,
  setShowTip,
  memories,
  setMemories,
  profile,
  profileName,
  nav,
  setOverlay,
}: {
  showTip: boolean;
  setShowTip: Dispatch<SetStateAction<boolean>>;
  memories: Memory[];
  setMemories: Dispatch<SetStateAction<Memory[]>>;
  profile: UserProfile;
  profileName: string;
  nav: (page: Page) => void;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
}) {
  const [selected, setSelected] = useState<Memory | null>(null);
  const [draft, setDraft] = useState("");

  const hasFacts = Boolean(
    profile.grade || profile.major || profile.school || profile.courses,
  );

  // 星点固定分布（用序号取模，避免每次渲染跳动）
  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${(i * 37 + 11) % 96}%`,
        top: `${(i * 53 + 7) % 94}%`,
        size: 1 + (i % 3),
        delay: `${(i % 8) * 0.55}s`,
        opacity: 0.25 + ((i * 17) % 45) / 100,
      })),
    [],
  );

  const open = (m: Memory) => {
    setSelected(m);
    setDraft(m.text);
  };

  const save = () => {
    if (!selected) return;
    const text = draft.trim();
    if (!text) return;
    setMemories(
      memories.map((m) => (m.id === selected.id ? { ...m, text } : m)),
    );
    setSelected(null);
  };

  const setWeight = (weight: MemoryWeight) => {
    if (!selected) return;
    setMemories(
      memories.map((m) => (m.id === selected.id ? { ...m, weight } : m)),
    );
    setSelected({ ...selected, weight });
  };

  const remove = () => {
    if (!selected) return;
    setMemories(memories.filter((m) => m.id !== selected.id));
    setSelected(null);
  };

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
          <p>我只用你确认过的信息给建议。这里每一条都能单独改、单独删。</p>
          <button className="wr-tip-row" onClick={() => nav("聊天")}>
            <Sparkles /> 在聊天里告诉我更多 <span>›</span>
          </button>
        </div>
      )}

      {/* ── 记忆星链 ───────────────────────────────── */}
      <section className="wr-starfield" aria-label="记忆星链">
        <div className="wr-starfield-sky" aria-hidden="true">
          {stars.map((s, i) => (
            <i
              key={i}
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                animationDelay: s.delay,
              }}
            />
          ))}
        </div>

        <header className="wr-starfield-head">
          <span>记忆星链</span>
          <em>{memories.length} 颗</em>
        </header>

        {memories.length === 0 ? (
          <p className="wr-starfield-empty">
            还没有记忆。聊天里出现值得记住的细节时，我会先问你，你同意才会写进来。
          </p>
        ) : (
          <ul className="wr-chain">
            {memories.map((m, i) => (
              <li
                key={m.id}
                className="wr-chain-node"
                data-weight={m.weight}
                style={
                  {
                    "--offset": `${Math.round(Math.sin(i * 0.9) * 26)}px`,
                    "--delay": `${(i % 6) * 0.4}s`,
                  } as React.CSSProperties
                }
              >
                <button
                  onClick={() => open(m)}
                  aria-label={`查看记忆：${m.text}`}
                >
                  {m.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 关于我 ─────────────────────────────────── */}
      <section className="wr-fact-card" aria-label="关于我">
        <header>
          <span>关于我</span>
          <button onClick={() => setOverlay("设置")}>编辑</button>
        </header>
        <div className="wr-fact-grid">
          <div>
            <small>称呼</small>
            <b>{fact(profileName)}</b>
          </div>
          <div>
            <small>年级</small>
            <b>{fact(profile.grade)}</b>
          </div>
          <div>
            <small>专业</small>
            <b>{fact(profile.major)}</b>
          </div>
          <div>
            <small>学校</small>
            <b>{fact(profile.school)}</b>
          </div>
        </div>
        {!hasFacts && (
          <button className="wr-fact-cta" onClick={() => setOverlay("设置")}>
            <GraduationCap size={16} />
            补上年级和专业，建议会更准
          </button>
        )}
      </section>

      {/* ── 详情弹层 ───────────────────────────────── */}
      {selected && (
        <div className="wr-overlay">
          <div className="wr-sheet">
            <div className="wr-sheet-head">
              <button onClick={() => setSelected(null)} aria-label="返回">
                <X />
              </button>
              <h2>这条记忆</h2>
              <button onClick={remove} aria-label="删除">
                <Trash2 />
              </button>
            </div>

            <label className="wr-memo-field">
              <span>内容</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={120}
              />
            </label>

            <div className="wr-memo-weight">
              <span>分量</span>
              <div>
                {([1, 2, 3] as MemoryWeight[]).map((w) => (
                  <button
                    key={w}
                    className={selected.weight === w ? "selected" : ""}
                    onClick={() => setWeight(w)}
                  >
                    {WEIGHT_LABEL[w]}
                  </button>
                ))}
              </div>
            </div>

            <p className="wr-memo-note">
              标成「重要」的记忆会在星链里发光，也会更容易被带进对话。
            </p>

            <button className="wr-memo-save" onClick={save}>
              保存
            </button>
          </div>
        </div>
      )}
    </>
  );
}
