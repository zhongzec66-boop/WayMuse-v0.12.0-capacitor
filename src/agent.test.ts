import { describe, expect, it } from "vitest";
import { parseReply, proposalDueAt } from "./agent";

describe("作业与考试的提议解析", () => {
  it("解析出一条作业提议", () => {
    const reply = parseReply(
      '好的。\n<deadlines>[{"kind":"assignment","title":"数据结构第三次作业","date":"2026-11-13","course":"数据结构","weight":15}]</deadlines>',
    );
    expect(reply.deadlines).toHaveLength(1);
    const item = reply.deadlines![0];
    expect(item.kind).toBe("assignment");
    expect(item.title).toBe("数据结构第三次作业");
    expect(item.weight).toBe(15);
    expect(item.course).toBe("数据结构");
  });

  it("解析出考试，带范围", () => {
    const reply = parseReply(
      '<deadlines>[{"kind":"exam","title":"高数期末","date":"2026-12-20","time":"09:00","scope":"第 1–6 章"}]</deadlines>',
    );
    expect(reply.deadlines![0].kind).toBe("exam");
    expect(reply.deadlines![0].scope).toBe("第 1–6 章");
  });

  it("提议块从正文里剥掉", () => {
    const reply = parseReply(
      '记下了。\n<deadlines>[{"kind":"assignment","title":"A","date":"2026-11-13"}]</deadlines>',
    );
    expect(reply.text).toBe("记下了。");
    expect(reply.text).not.toContain("deadlines");
  });

  it("日期不是 YYYY-MM-DD 的丢掉（不硬猜「下周三」）", () => {
    const reply = parseReply(
      '<deadlines>[{"kind":"assignment","title":"A","date":"下周三"},{"kind":"assignment","title":"B","date":"2026-11-13"}]</deadlines>',
    );
    expect(reply.deadlines).toHaveLength(1);
    expect(reply.deadlines![0].title).toBe("B");
  });

  it("kind 不认识的丢掉", () => {
    const reply = parseReply(
      '<deadlines>[{"kind":"考试","title":"可以识别","date":"2026-12-20"},{"kind":"reminder","title":"不行","date":"2026-11-13"}]</deadlines>',
    );
    expect(reply.deadlines).toHaveLength(1);
    expect(reply.deadlines![0].kind).toBe("exam");
  });

  it("坏 JSON 不会抛异常，正文照常保留", () => {
    const reply = parseReply('正文。\n<deadlines>不是 json</deadlines>');
    expect(reply.deadlines).toEqual([]);
    expect(reply.text).toBe("正文。");
  });

  it("没有提议块时是空数组", () => {
    expect(parseReply("就是一句话").deadlines).toEqual([]);
  });

  it("最多 5 条", () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      kind: "assignment",
      title: `作业 ${index}`,
      date: "2026-11-13",
    }));
    const reply = parseReply(`<deadlines>${JSON.stringify(items)}</deadlines>`);
    expect(reply.deadlines).toHaveLength(5);
  });
});

describe("proposalDueAt", () => {
  it("作业没写钟点时按当天 23:59", () => {
    const at = new Date(
      proposalDueAt({
        kind: "assignment",
        title: "A",
        date: "2026-11-13",
      }),
    );
    expect(at.getFullYear()).toBe(2026);
    expect(at.getMonth()).toBe(10);
    expect(at.getDate()).toBe(13);
    expect(at.getHours()).toBe(23);
    expect(at.getMinutes()).toBe(59);
  });

  it("考试没写钟点时按 09:00", () => {
    const at = new Date(
      proposalDueAt({ kind: "exam", title: "E", date: "2026-12-20" }),
    );
    expect(at.getHours()).toBe(9);
    expect(at.getMinutes()).toBe(0);
  });

  it("写了钟点就用写的", () => {
    const at = new Date(
      proposalDueAt({
        kind: "assignment",
        title: "A",
        date: "2026-11-13",
        time: "18:30",
      }),
    );
    expect(at.getHours()).toBe(18);
    expect(at.getMinutes()).toBe(30);
  });
});