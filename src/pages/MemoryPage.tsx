import { BookOpen, GraduationCap, Sparkles, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { UserProfile } from "../profile";
import type { Overlay, Page } from "../types";

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
  memories: string[];
  setMemories: Dispatch<SetStateAction<string[]>>;
  profile: UserProfile;
  profileName: string;
  nav: (page: Page) => void;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
}) {
  const hasFacts = Boolean(
    profile.grade || profile.major || profile.school || profile.courses,
  );

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
          <p>我只用你确认过的信息给建议。这里每一条都能单独删掉。</p>
          <button className="wr-tip-row" onClick={() => nav("聊天")}>
            <Sparkles /> 在聊天里告诉我更多 <span>›</span>
          </button>
        </div>
      )}

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

      <section className="wr-memory-block" aria-label="记住的事">
        <header>
          <span>记住的事</span>
          <em>{memories.length}</em>
        </header>
        {memories.length === 0 ? (
          <p className="wr-memory-empty">
            还没有记住任何事。聊天里出现值得记住的细节时，{""}
            我会先问你，你同意才会写进来。
          </p>
        ) : (
          <ul className="wr-memory-tags">
            {memories.map((m, i) => (
              <li key={`${m}-${i}`}>
                <span>{m}</span>
                <button
                  aria-label={`删除记忆：${m}`}
                  onClick={() =>
                    setMemories(memories.filter((_, n) => n !== i))
                  }
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
