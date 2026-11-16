import type { Memory } from "./types";

/**
 * 大脑图的坐标计算。
 *
 * 全部是纯函数：同样的记忆一定得到同样的图，方便测试，也不会每次渲染跳来跳去。
 * 不是解剖图，只是五个区域 + 圆形节点 + 邻接连线的比喻。
 */

export type RegionId =
  "hippocampus" | "cortex" | "amygdala" | "prefrontal" | "cerebellum";

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
    cx: 92,
    cy: 116,
    radius: 28,
  },
  {
    id: "hippocampus",
    name: "海马体",
    hint: "新记忆",
    color: "#386CB2",
    cx: 166,
    cy: 150,
    radius: 26,
  },
  {
    id: "cortex",
    name: "皮层",
    hint: "长期记忆",
    color: "#109480",
    cx: 212,
    cy: 112,
    radius: 32,
  },
  {
    id: "amygdala",
    name: "杏仁核",
    hint: "情绪",
    color: "#D88A1C",
    cx: 126,
    cy: 172,
    radius: 20,
  },
  {
    id: "cerebellum",
    name: "小脑",
    hint: "习惯",
    color: "#7A6EAC",
    cx: 224,
    cy: 202,
    radius: 22,
  },
];

/**
 * 侧视大脑的外形。
 *
 * 用「手挑轮廓点 + Catmull-Rom 平滑」，而不是按角度调制半径：
 * 调制半径出来的永远是土豆，只有控制点能画出额叶、颞叶、枕叶的高低关系。
 */
function catmullRom(points: { x: number; y: number }[]): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];
  let d = `M ${at(0).x} ${at(0).y}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
}

export type BrainOutline = {
  cerebrum: string;
  cerebellum: string;
  brainstem: string;
};

export function brainOutlinePaths(): BrainOutline {
  // 半球：前额（左）略高、顶部有起伏、枕部（右）圆、底下有颞叶的凹口
  const cerebrum = catmullRom([
    { x: 66, y: 178 },
    { x: 58, y: 150 },
    { x: 64, y: 122 },
    { x: 84, y: 100 },
    { x: 108, y: 88 },
    { x: 126, y: 74 },
    { x: 150, y: 80 },
    { x: 172, y: 70 },
    { x: 196, y: 82 },
    { x: 220, y: 88 },
    { x: 244, y: 106 },
    { x: 254, y: 132 },
    { x: 250, y: 156 },
    { x: 236, y: 172 },
    { x: 214, y: 180 },
    { x: 190, y: 188 },
    { x: 166, y: 182 },
    { x: 146, y: 190 },
    { x: 122, y: 196 },
    { x: 92, y: 196 },
  ]);

  // 小脑：塞在枕叶下方，比半球小而扁
  const cerebellum = catmullRom([
    { x: 196, y: 196 },
    { x: 220, y: 192 },
    { x: 242, y: 200 },
    { x: 248, y: 218 },
    { x: 236, y: 232 },
    { x: 212, y: 234 },
    { x: 194, y: 226 },
    { x: 188, y: 210 },
  ]);

  // 脑干：从半球底部偏后往下收窄，略向右倾
  // 上端要比半球底边再往上一点，否则看着像挂在外面的一根棍
  const brainstem = catmullRom([
    { x: 164, y: 180 },
    { x: 192, y: 186 },
    { x: 196, y: 216 },
    { x: 188, y: 244 },
    { x: 174, y: 246 },
    { x: 168, y: 212 },
  ]);

  return { cerebrum, cerebellum, brainstem };
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
