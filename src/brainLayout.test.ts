import { describe, expect, it } from "vitest";
import {
  MAX_NODES_PER_REGION,
  MAX_NODES_TOTAL,
  REGIONS,
  buildBrainGraph,
  regionOf,
} from "./brainLayout";
import type { Memory } from "./types";

function memory(
  id: string,
  partial: Partial<Memory> = {},
): Memory {
  return {
    id,
    text: `记忆 ${id}`,
    weight: 2,
    createdAt: Date.now(),
    ...partial,
  };
}

describe("记忆归区", () => {
  it("待巩固 → 海马体", () => {
    expect(regionOf(memory("a", { status: "pending" }))).toBe("hippocampus");
  });

  it("已巩固 → 皮层", () => {
    expect(regionOf(memory("a", { status: "consolidated" }))).toBe("cortex");
  });

  it("情绪 → 杏仁核（无论在哪个阶段）", () => {
    expect(
      regionOf(memory("a", { kind: "emotion", status: "pending" })),
    ).toBe("amygdala");
    expect(
      regionOf(memory("a", { kind: "emotion", status: "consolidated" })),
    ).toBe("amygdala");
  });

  it("习惯 → 小脑", () => {
    expect(regionOf(memory("a", { kind: "habit" }))).toBe("cerebellum");
  });
});

describe("大脑图", () => {
  it("五个区域都在，顺序固定", () => {
    const graph = buildBrainGraph([]);
    expect(graph.regions.map((r) => r.id)).toEqual([
      "prefrontal",
      "hippocampus",
      "cortex",
      "amygdala",
      "cerebellum",
    ]);
  });

  it("节点数等于该区条数", () => {
    const graph = buildBrainGraph([
      memory("a", { status: "pending" }),
      memory("b", { status: "pending" }),
      memory("c", { status: "consolidated" }),
    ]);
    expect(graph.regions.find((r) => r.id === "hippocampus")?.nodes).toHaveLength(2);
    expect(graph.regions.find((r) => r.id === "cortex")?.nodes).toHaveLength(1);
  });

  it("坐标是稳定的：同样的输入两次结果一致", () => {
    const list = [memory("a"), memory("b"), memory("c")];
    const first = buildBrainGraph(list);
    const second = buildBrainGraph(list);
    expect(first.regions[0].nodes).toEqual(second.regions[0].nodes);
  });

  it("单区封顶 40 个节点，但计数照实报", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      memory(`m${i}`, { status: "pending" }),
    );
    const graph = buildBrainGraph(many);
    const hippocampus = graph.regions.find((r) => r.id === "hippocampus");
    expect(hippocampus?.count).toBe(60);
    expect(hippocampus?.nodes).toHaveLength(MAX_NODES_PER_REGION);
  });

  it("全图节点总量不超过 200", () => {
    const many = Array.from({ length: 600 }, (_, i) =>
      memory(`m${i}`, { status: "pending" }),
    );
    const graph = buildBrainGraph(many);
    expect(graph.totalNodes).toBeLessThanOrEqual(MAX_NODES_TOTAL);
  });

  it("节点半径在 2–4px 之间", () => {
    const graph = buildBrainGraph([memory("a")]);
    for (const region of graph.regions) {
      for (const node of region.nodes) {
        expect(node.r).toBeGreaterThanOrEqual(2);
        expect(node.r).toBeLessThanOrEqual(4);
      }
    }
  });

  it("节点落在本区域的圆内", () => {
    const graph = buildBrainGraph(
      Array.from({ length: 8 }, (_, i) => memory(`m${i}`)),
    );
    for (const region of graph.regions) {
      for (const node of region.nodes) {
        const distance = Math.hypot(node.x - region.cx, node.y - region.cy);
        expect(distance).toBeLessThanOrEqual(region.radius + 6);
      }
    }
  });

  it("每个节点最多连两条线，且不重复", () => {
    const graph = buildBrainGraph(
      Array.from({ length: 6 }, (_, i) => memory(`m${i}`)),
    );
    const region = graph.regions.find((r) => r.nodes.length === 6)!;
    const keys = region.links.map((l) => [l.from, l.to].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
    const degree = new Map<string, number>();
    for (const link of region.links) {
      degree.set(link.from, (degree.get(link.from) ?? 0) + 1);
      degree.set(link.to, (degree.get(link.to) ?? 0) + 1);
    }
    for (const value of degree.values()) expect(value).toBeLessThanOrEqual(4);
  });

  it("区域颜色与名字符合约定", () => {
    expect(REGIONS.find((r) => r.id === "hippocampus")?.color).toBe("#386CB2");
    expect(REGIONS.find((r) => r.id === "cortex")?.color).toBe("#109480");
    expect(REGIONS.find((r) => r.id === "amygdala")?.color).toBe("#D88A1C");
    expect(REGIONS.find((r) => r.id === "prefrontal")?.color).toBe("#036F3B");
    expect(REGIONS.find((r) => r.id === "cerebellum")?.color).toBe("#7A6EAC");
  });
});
