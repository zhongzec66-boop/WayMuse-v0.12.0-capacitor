import type { Memory } from "./types";

/**
 * 大脑图的坐标计算。
 *
 * 全部是纯函数：同样的记忆一定得到同样的图，方便测试，也不会每次渲染跳来跳去。
 * 不是解剖图，只是五个区域 + 圆形节点 + 邻接连线的比喻。
 */

export type RegionId =
  | "hippocampus"
  | "cortex"
  | "amygdala"
  | "prefrontal"
  | "cerebellum";

export type RegionSpec = {
  id: RegionId;
  name: string;
  /** 一句人话说明 */
  hint: string;
  color: string;
  /** 区域中心（viewBox 坐标） */
  cx: number;
  cy: number;
  /** 节点分布半径 */
  radius: number;
};

export const VIEW_W = 320;
export const VIEW_H = 300;

/** 每个区域最多画多少个节点 */
export const MAX_NODES_PER_REGION = 40;
/** 全图最多多少个节点（性能兜底） */
export const MAX_NODES_TOTAL = 200;

export const REGIONS: RegionSpec[] = [
  {
    id: "prefrontal",
    name: "前额叶",
    hint: "身份与目标",
    color: "#036F3B",
    cx: 96,
    cy: 96,
    radius: 34,
  },
  {
    id: "hippocampus",
    name: "海马体",
    hint: "新记忆",
    color: "#386CB2",
    cx: 168,
    cy: 150,
    radius: 30,
  },
  {
    id: "cortex",
    name: "皮层",
    hint: "长期记忆",
    color: "#109480",
    cx: 236,
    cy: 120,
    radius: 36,
  },
  {
    id: "amygdala",
    name: "杏仁核",
    hint: "情绪",
    color: "#D88A1C",
    cx: 168,
    cy: 214,
    radius: 24,
  },
  {
    id: "cerebellum",
    name: "小脑",
    hint: "习惯",
    color: "#7A6EAC",
    cx: 232,
    cy: 214,
    radius: 26,
  },
];


/**
 * 大脑轮廓：用角度调制生成一条闭合的有机曲线。
 *
 * 手写 path 容易画成土豆，这样按 sin 调制半径既圆润又有一点起伏，
 * 而且完全确定——同样的参数每次画出同一条线。
 */
export function brainOutlinePath(): string {
  const cx = 160;
  const cy = 150;
  const rx = 104;
  const ry = 88;
  const steps = 56;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.06 * Math.sin(3 * angle) + 0.04 * Math.cos(5 * angle);
    points.push({
      x: Number((cx + Math.cos(angle) * rx * wobble).toFixed(2)),
      y: Number((cy + Math.sin(angle) * ry * wobble).toFixed(2)),
    });
  }
  // 用二次曲线穿过各点中点，得到平滑闭合线
  let d = `M ${(points[0].x + points[steps - 1].x) / 2} ${(points[0].y + points[steps - 1].y) / 2}`;
  for (let i = 0; i < steps; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % steps];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  return `${d} Z`;
}

export function regionSpec(id: RegionId): RegionSpec {
  return REGIONS.find((region) => region.id === id) ?? REGIONS[0];
}

/** 记忆归到哪个区域 */
export function regionOf(memory: Memory): RegionId {
  if (memory.kind === "habit") return "cerebellum";
  if (memory.kind === "emotion") return "amygdala";
  // 待巩固的先进海马体，已巩固的在皮层
  if (memory.status === "pending") return "hippocampus";
  return "cortex";
}

export type BrainNode = {
  id: string;
  x: number;
  y: number;
  /** 半径 2–4px */
  r: number;
  /** 是否高亮（巩固动画用） */
  highlight?: boolean;
};

export type BrainLink = {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type BrainRegion = RegionSpec & {
  count: number;
  nodes: BrainNode[];
  links: BrainLink[];
};

export type BrainGraph = {
  regions: BrainRegion[];
  totalNodes: number;
  totalMemories: number;
};

/** 稳定伪随机：同一个 id 每次得到同一个值 */
function hashUnit(seed: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // 归一化到 0–1
  return ((hash >>> 0) % 10000) / 10000;
}

/** 把节点铺在区域圆内：黄金角螺旋 + 少量抖动，比纯随机均匀 */
function placeNodes(memories: Memory[], region: RegionSpec): BrainNode[] {
  const count = Math.min(memories.length, MAX_NODES_PER_REGION);
  const nodes: BrainNode[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const memory = memories[i];
    const angle = i * golden + hashUnit(memory.id, 1) * 0.6;
    // 开方让点分布更均匀，不至于全挤在中心
    const distance = region.radius * Math.sqrt((i + 0.6) / count);
    const jitter = (hashUnit(memory.id, 2) - 0.5) * 4;
    nodes.push({
      id: memory.id,
      x: Number((region.cx + Math.cos(angle) * (distance + jitter)).toFixed(2)),
      y: Number((region.cy + Math.sin(angle) * (distance + jitter)).toFixed(2)),
      r: Number((2 + hashUnit(memory.id, 3) * 2).toFixed(2)),
    });
  }
  return nodes;
}

/** 每个节点连最近的 2 个邻居，连到别人的连线不重复画 */
function linkNodes(nodes: BrainNode[]): BrainLink[] {
  const links: BrainLink[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const nearest = nodes
      .filter((other) => other.id !== node.id)
      .map((other) => ({
        other,
        distance: (other.x - node.x) ** 2 + (other.y - node.y) ** 2,
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
    for (const { other } of nearest) {
      const key = [node.id, other.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        from: node.id,
        to: other.id,
        x1: node.x,
        y1: node.y,
        x2: other.x,
        y2: other.y,
      });
    }
  }
  return links;
}

export function buildBrainGraph(memories: Memory[]): BrainGraph {
  // 先分区，再按区域上限裁节点；全图总量也要兜住
  const buckets = new Map<RegionId, Memory[]>();
  for (const region of REGIONS) buckets.set(region.id, []);
  for (const memory of memories) {
    buckets.get(regionOf(memory))?.push(memory);
  }

  let budget = MAX_NODES_TOTAL;
  const regions: BrainRegion[] = REGIONS.map((spec) => {
    const bucket = buckets.get(spec.id) ?? [];
    const visible = bucket.slice(0, Math.min(MAX_NODES_PER_REGION, budget));
    budget -= visible.length;
    const nodes = placeNodes(visible, spec);
    return {
      ...spec,
      count: bucket.length,
      nodes,
      links: linkNodes(nodes),
    };
  });

  return {
    regions,
    totalNodes: regions.reduce((sum, region) => sum + region.nodes.length, 0),
    totalMemories: memories.length,
  };
}
