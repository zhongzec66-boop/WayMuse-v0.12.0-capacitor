import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 存储层测试。
 *
 * 环境是 node，没有 localStorage，所以这里先装一个最小的假实现。
 * 重点不是测 localStorage，而是测「坏数据进来不炸、能用的字段留下来」。
 */

class FakeStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  get length(): number {
    return this.data.size;
  }
}

const store = new FakeStorage();
vi.stubGlobal("localStorage", store);

const { storage, createMemory } = await import("./storage");

const KEY = (name: string) => `waymuse-demo-${name}`;

beforeEach(() => {
  store.clear();
});

function put(name: string, value: unknown): void {
  store.setItem(KEY(name), JSON.stringify(value));
}

describe("作业存储", () => {
  it("正常数据能存能读", () => {
    storage.setAssignments([
      {
        id: "a1",
        title: "数据结构作业",
        dueAt: "2026-11-13T23:59:00+08:00",
        weightPercent: 15,
        status: "doing",
      },
    ]);
    const list = storage.getAssignments();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("数据结构作业");
    expect(list[0].weightPercent).toBe(15);
    expect(list[0].status).toBe("doing");
  });

  it("缺标题或时间坏掉的条目被丢掉，其余保留", () => {
    put("assignments", [
      { id: "ok", title: "正常", dueAt: "2026-11-13T23:59:00+08:00" },
      { id: "no-title", dueAt: "2026-11-13T23:59:00+08:00" },
      { id: "bad-date", title: "时间坏了", dueAt: "下周三" },
      "这根本不是对象",
      null,
    ]);
    const list = storage.getAssignments();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("正常");
  });

  it("权重被夹在 0–100 并取整", () => {
    put("assignments", [
      { id: "a", title: "A", dueAt: "2026-11-13T23:59:00+08:00", weightPercent: 250 },
      { id: "b", title: "B", dueAt: "2026-11-13T23:59:00+08:00", weightPercent: -5 },
      { id: "c", title: "C", dueAt: "2026-11-13T23:59:00+08:00", weightPercent: 12.6 },
    ]);
    const list = storage.getAssignments();
    expect(list.map((item) => item.weightPercent)).toEqual([100, 0, 13]);
  });

  it("未知状态退回 todo", () => {
    put("assignments", [
      { id: "a", title: "A", dueAt: "2026-11-13T23:59:00+08:00", status: "删了这个字段" },
    ]);
    expect(storage.getAssignments()[0].status).toBe("todo");
  });

  it("拆解小步：坏条目丢掉，分钟数取整", () => {
    put("assignments", [
      {
        id: "a",
        title: "A",
        dueAt: "2026-11-13T23:59:00+08:00",
        steps: [
          { label: "读题", minutes: 20.7, done: false },
          { label: "", minutes: 10 },
          { minutes: 5 },
          "坏的",
        ],
      },
    ]);
    const steps = storage.getAssignments()[0].steps;
    expect(steps).toHaveLength(1);
    expect(steps?.[0]).toEqual({ label: "读题", minutes: 21, done: false });
  });

  it("空数组读完还是空数组", () => {
    expect(storage.getAssignments()).toEqual([]);
  });
});

describe("考试存储", () => {
  it("正常数据能存能读", () => {
    storage.setExams([
      {
        id: "e1",
        at: "2026-12-20T09:00:00+08:00",
        scope: "第 1–6 章",
        progressPercent: 40,
      },
    ]);
    const list = storage.getExams();
    expect(list).toHaveLength(1);
    expect(list[0].scope).toBe("第 1–6 章");
    expect(list[0].progressPercent).toBe(40);
  });

  it("没有时间或时间坏的考试被丢掉", () => {
    put("exams", [
      { id: "ok", at: "2026-12-20T09:00:00+08:00" },
      { id: "no-at" },
      { id: "bad", at: "十二月" },
    ]);
    expect(storage.getExams()).toHaveLength(1);
  });

  it("复习计划：日期格式不对的条目丢掉", () => {
    put("exams", [
      {
        id: "e",
        at: "2026-12-20T09:00:00+08:00",
        reviewPlan: [
          { date: "2026-12-01", topic: "第一章", done: true },
          { date: "12月1日", topic: "格式坏了" },
          { topic: "没有日期" },
        ],
      },
    ]);
    const plan = storage.getExams()[0].reviewPlan;
    expect(plan).toHaveLength(1);
    expect(plan?.[0]).toEqual({ date: "2026-12-01", topic: "第一章", done: true });
  });

  it("进度被夹在 0–100", () => {
    put("exams", [
      { id: "a", at: "2026-12-20T09:00:00+08:00", progressPercent: 999 },
    ]);
    expect(storage.getExams()[0].progressPercent).toBe(100);
  });
});

describe("互不干扰", () => {
  it("作业和考试分开存，不会串", () => {
    storage.setAssignments([
      { id: "a", title: "作业", dueAt: "2026-11-13T23:59:00+08:00", status: "todo" },
    ]);
    storage.setExams([{ id: "e", at: "2026-12-20T09:00:00+08:00" }]);
    expect(storage.getAssignments()).toHaveLength(1);
    expect(storage.getExams()).toHaveLength(1);
    expect(store.getItem(KEY("assignments"))).toContain("作业");
    expect(store.getItem(KEY("exams"))).not.toContain("作业");
  });

  it("坏 JSON 不会抛异常，读成空", () => {
    store.setItem(KEY("assignments"), "{不是 json");
    expect(storage.getAssignments()).toEqual([]);
  });
});

describe("记忆迁移（kind / status 一次加完）", () => {
  it("旧条目默认普通且已巩固，一条不丢", () => {
    put("memories", [
      { id: "m1", text: "旧记忆一", weight: 2, createdAt: 1700000000000 },
      { id: "m2", text: "旧记忆二", weight: 1, createdAt: 1700000001000 },
    ]);
    const list = storage.getMemories();
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.kind)).toEqual(["normal", "normal"]);
    expect(list.map((m) => m.status)).toEqual(["consolidated", "consolidated"]);
  });

  it("weight === 3 的旧条目记为情绪", () => {
    put("memories", [
      { id: "m1", text: "旧的重点记忆", weight: 3, createdAt: 1700000000000 },
    ]);
    expect(storage.getMemories()[0].kind).toBe("emotion");
  });

  it("旧字符串数组也迁移成已巩固的普通记忆", () => {
    put("memories", ["纯文本记忆一", "纯文本记忆二"]);
    const list = storage.getMemories();
    expect(list).toHaveLength(2);
    expect(list.every((m) => m.kind === "normal")).toBe(true);
    expect(list.every((m) => m.status === "consolidated")).toBe(true);
  });

  it("新建的记忆默认待巩固", () => {
    storage.setMemories([createMemory("刚记住的事")]);
    const list = storage.getMemories();
    expect(list[0].status).toBe("pending");
    expect(list[0].kind).toBe("normal");
  });

  it("情绪记忆能存住 kind", () => {
    storage.setMemories([createMemory("被夸了很开心", 3, "emotion")]);
    expect(storage.getMemories()[0].kind).toBe("emotion");
  });

  it("习惯签名的忽略列表能存能读", () => {
    storage.setDismissedHabitKeys(["背单词#6", "跑步#18"]);
    expect(storage.getDismissedHabitKeys()).toEqual(["背单词#6", "跑步#18"]);
  });

  it("上次巩固时间能存能读", () => {
    storage.setLastConsolidatedAt(1794398005000);
    expect(storage.getLastConsolidatedAt()).toBe(1794398005000);
  });
});