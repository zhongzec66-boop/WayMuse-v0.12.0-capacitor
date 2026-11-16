import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  REGIONS,
  VIEW_H,
  VIEW_W,
  brainOutlinePaths,
  buildBrainGraph,
  regionOf,
} from "../brainLayout";
import type { RegionId } from "../brainLayout";
import { createMemory } from "../storage";
import type { Memory } from "../types";

/**
 * 大脑记忆图。
 *
 * 这是比喻，不是解剖图：五个区域、圆形节点、浅色连线。
 * 图只是入口——点开区域下面的列表仍然是可编辑的纯文本，
 * 不允许为了图形牺牲编辑能力。
 */

function timeText(createdAt: number): string {
  const date = new Date(createdAt);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export default function BrainMap({
  memories,
  onMemoriesChange,
  consolidating = false,
  onSkipConsolidation,
}: {
  memories: Memory[];
  onMemoriesChange: (next: Memory[]) => void;
  /** 正在播巩固动画：海马体节点向皮层移动 */
  consolidating?: boolean;
  onSkipConsolidation?: () => void;
}) {
  const [openRegion, setOpenRegion] = useState<RegionId | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const pressTimer = useRef<number | null>(null);

  const graph = useMemo(() => buildBrainGraph(memories), [memories]);
  const outline = useMemo(() => brainOutlinePaths(), []);

  // 低端机降级：帧率不足就把呼吸动画关掉
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  const list = openRegion
    ? memories.filter((memory) => regionOf(memory) === openRegion)
    : [];

  const toggleKind = (id: string) => {
    onMemoriesChange(
      memories.map((memory) =>
        memory.id === id
          ? {
              ...memory,
              kind: memory.kind === "emotion" ? "normal" : "emotion",
            }
          : memory,
      ),
    );
    setMenuId(null);
  };

  const remove = (id: string) => {
    onMemoriesChange(memories.filter((memory) => memory.id !== id));
    setMenuId(null);
  };

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onMemoriesChange([createMemory(text, 2, "normal"), ...memories]);
    setDraft("");
  };

  const startPress = (id: string) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setMenuId(id), 420);
  };

  const endPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <>
      <section className="wr-brain" aria-label="记忆分布">
        <header className="wr-brain-head">
          <span>这是 WayMuse 的抽象大脑</span>
          <em>{graph.totalMemories} 条 · 不进解剖，只看它把事记在哪儿</em>
        </header>

        <div className="wr-brain-stage">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className={"wr-brain-svg" + (reduceMotion ? " is-static" : "")}
            role="img"
            aria-label="WayMuse 的抽象大脑：记忆分布在五个区域"
          >
            {/* 大脑轮廓：只描边 + 浅填充，不画沟回 */}
            <path className="wr-brain-outline" d={outline.cerebrum} />
            <path
              className="wr-brain-outline is-cerebellum"
              d={outline.cerebellum}
            />
            <path className="wr-brain-outline is-stem" d={outline.brainstem} />
            {graph.regions.map((region) => (
              <g
                key={region.id}
                className={
                  "wr-brain-region" +
                  (openRegion === region.id ? " is-open" : "") +
                  (consolidating && region.id === "hippocampus"
                    ? " is-consolidating"
                    : "")
                }
                onClick={() =>
                  setOpenRegion(openRegion === region.id ? null : region.id)
                }
                role="button"
                aria-label={`${region.name} · ${region.hint} · ${region.count} 条`}
              >
                <circle
                  cx={region.cx}
                  cy={region.cy}
                  r={region.radius}
                  fill={region.color}
                  fillOpacity="0.08"
                  stroke={region.color}
                  strokeOpacity="0.22"
                />
                {region.links.map((link) => (
                  <line
                    key={`${link.from}-${link.to}`}
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke={region.color}
                    strokeOpacity="0.18"
                    strokeWidth="0.6"
                  />
                ))}
                {region.nodes.map((node, index) => (
                  <circle
                    key={node.id}
                    className="wr-brain-node"
                    cx={node.x}
                    cy={node.y}
                    r={node.r}
                    fill={region.color}
                    style={{ animationDelay: `${(index % 12) * 0.18}s` }}
                  />
                ))}
              </g>
            ))}
          </svg>

          {consolidating && (
            <button
              type="button"
              className="wr-brain-skip"
              onClick={onSkipConsolidation}
            >
              跳过
            </button>
          )}
        </div>

        <ul className="wr-brain-legend">
          {graph.regions.map((region) => (
            <li key={region.id}>
              <button
                type="button"
                onClick={() =>
                  setOpenRegion(openRegion === region.id ? null : region.id)
                }
              >
                <span style={{ background: region.color }} />
                <b>{region.name}</b>
                <em>{region.hint}</em>
                <i>
                  {region.id === "cerebellum" && region.count === 0
                    ? "还在形成中"
                    : `${region.count} 条`}
                </i>
              </button>
            </li>
          ))}
        </ul>

        {openRegion && (
          <div className="wr-brain-list" aria-label="该区域的记忆">
            <header>
              <b>{REGIONS.find((region) => region.id === openRegion)?.name}</b>
              <button
                type="button"
                onClick={() => setOpenRegion(null)}
                aria-label="收起"
              >
                <X size={16} />
              </button>
            </header>

            {list.length === 0 ? (
              <p className="wr-brain-empty">
                {openRegion === "cerebellum"
                  ? "习惯还在形成中。同一类事情这周做满 3 次，就会出现在这里。"
                  : "这个区域还没有记忆。"}
              </p>
            ) : (
              <ul>
                {list.map((memory) => (
                  <li key={memory.id}>
                    <button
                      type="button"
                      className="wr-brain-row"
                      onPointerDown={() => startPress(memory.id)}
                      onPointerUp={endPress}
                      onPointerLeave={endPress}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMenuId(memory.id);
                      }}
                    >
                      <span
                        className="wr-brain-dot"
                        style={{
                          background:
                            REGIONS.find(
                              (region) => region.id === regionOf(memory),
                            )?.color ?? "#888",
                        }}
                      />
                      <b>{memory.text}</b>
                      <time>{timeText(memory.createdAt)}</time>
                    </button>
                    {menuId === memory.id && (
                      <div className="wr-brain-menu">
                        <button
                          type="button"
                          onClick={() => toggleKind(memory.id)}
                        >
                          {memory.kind === "emotion"
                            ? "改为普通记忆"
                            : "改为情绪记忆"}
                        </button>
                        <button type="button" onClick={() => remove(memory.id)}>
                          删除
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="wr-brain-add">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="记一条"
                maxLength={120}
                onKeyDown={(event) => {
                  if (event.key === "Enter") add();
                }}
              />
              <button
                type="button"
                onClick={add}
                aria-label="添加记忆"
                disabled={!draft.trim()}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
