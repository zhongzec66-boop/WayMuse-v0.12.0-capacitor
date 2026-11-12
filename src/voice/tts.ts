import { Capacitor } from "@capacitor/core";
import { synthesizeSpeech } from "../api";

/**
 * 语音朗读（一期）。
 *
 * 三条约束：
 * 1. 不用系统 TTS，也不在客户端放任何 key —— 音频全部来自 /api/voice/tts
 * 2. 边收边分句：第一句（12 字以上）先合成，后续按标点切
 * 3. 打断要快：停止声源 + 清队列 + 取消在途请求，300ms 内静音
 */

const TTS_MAX_CHARS = 300;

/** 场景语气：服务端技能命中「考试/冲刺」时用第二种 */
export const EXAM_INSTRUCTION = "坚定、鼓励，节奏稍快";
export const EVENING_INSTRUCTION = "放缓、温和，像夜里聊天";
export const DAILY_INSTRUCTION = "亲切自然，像朋友聊天";

export function sceneInstruction(now = new Date()): string {
  const hour = now.getHours();
  if (hour >= 22 || hour < 5) return EVENING_INSTRUCTION;
  return DAILY_INSTRUCTION;
}

/* ── 清洗：朗读前去掉一切不该念的东西 ─────────────────── */

export function cleanForSpeech(input: string): string {
  let text = input;

  // 协议块整段删掉（卡片内容不朗读）
  text = text.replace(
    /<(plans|memories|courses|choices|deadlines)>[\s\S]*?<\/\1>/g,
    "",
  );
  // 文件块
  text = text.replace(/\[\[FILE:[\s\S]*?\[\[\/FILE\]\]/g, "");
  // 代码块
  text = text.replace(/```[\s\S]*?(```|$)/g, "");
  // 行内代码、粗斜体、删除线
  text = text.replace(/`([^`]*)`/g, "$1");
  text = text.replace(/(\*\*|__|\*|_|~~)/g, "");
  // 标题 / 列表 / 引用前缀
  text = text.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "");
  // 公式
  text = text.replace(/\$\$[\s\S]*?\$\$/g, "");
  text = text.replace(/\$[^$\n]+\$/g, "");
  // 链接只留文字，裸 URL 删掉
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/https?:\/\/\S+/g, "");
  // 表格竖线
  text = text.replace(/\|/g, " ");
  // 连续空白
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{2,}/g, "\n");

  return text.trim().slice(0, TTS_MAX_CHARS);
}

/* ── 分句：流式增量 → 可朗读的句子 ───────────────────── */

const SENTENCE_END = /[。！？；!?;\n]/;
const FIRST_CHUNK = 12;
const MIN_CHUNK = 10;
const MAX_CHUNK = 80;

export class SentenceSplitter {
  private buffer = "";
  private emitted = 0;

  /** 收到一段增量，返回这次凑齐的句子 */
  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];
    let changed = true;

    while (changed) {
      changed = false;
      const text = this.buffer;

      // 首句：只要够 12 字就先切，换来更快出声
      if (this.emitted === 0 && text.length >= FIRST_CHUNK) {
        const cut = this.findCut(text, FIRST_CHUNK);
        if (cut > 0) {
          const piece = text.slice(0, cut);
          const rest = text.slice(cut);
          if (this.useful(piece)) {
            out.push(piece);
            this.buffer = rest;
            this.emitted += 1;
            changed = true;
            continue;
          }
        }
      }

      const end = this.findSentenceEnd(text);
      if (end > 0) {
        const piece = text.slice(0, end);
        const rest = text.slice(end);
        if (this.useful(piece)) {
          out.push(piece);
          this.buffer = rest;
          this.emitted += 1;
          changed = true;
          continue;
        }
        // 太短就和后面的合并
        this.buffer = text;
      }

      // 超长没有标点：在逗号处切
      if (text.length > MAX_CHUNK) {
        const comma = Math.max(
          text.lastIndexOf("，", MAX_CHUNK),
          text.lastIndexOf("、", MAX_CHUNK),
          text.lastIndexOf(",", MAX_CHUNK),
        );
        const cut = comma > MIN_CHUNK ? comma + 1 : MAX_CHUNK;
        const piece = text.slice(0, cut);
        if (this.useful(piece)) {
          out.push(piece);
          this.buffer = text.slice(cut);
          this.emitted += 1;
          changed = true;
        }
      }
    }

    return out.map((s) => s.trim()).filter(Boolean);
  }

  /** 回复结束：把剩下的吐出来 */
  flush(): string[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (!rest) return [];
    return rest.length >= 1 ? [rest] : [];
  }

  reset(): void {
    this.buffer = "";
    this.emitted = 0;
  }

  /**
   * 首句切点：优先往回找 6~12 字之间的标点，
   * 这样第一句更短、合成更快（首句只求快，不求完整）。
   */
  private findCut(text: string, start: number): number {
    for (let i = start; i >= 6; i -= 1) {
      const ch = text[i];
      if (SENTENCE_END.test(ch) || ch === "，" || ch === "、" || ch === ",") {
        return i + 1;
      }
    }
    for (let i = start; i < Math.min(text.length, start + 8); i += 1) {
      const ch = text[i];
      if (SENTENCE_END.test(ch) || ch === "，" || ch === "、" || ch === ",") {
        return i + 1;
      }
    }
    return start;
  }

  private findSentenceEnd(text: string): number {
    for (let i = 0; i < text.length; i += 1) {
      if (SENTENCE_END.test(text[i])) {
        // 太短的句子不单独成句，继续往后找
        if (i + 1 >= MIN_CHUNK) return i + 1;
      }
    }
    return -1;
  }

  private useful(piece: string): boolean {
    return cleanForSpeech(piece).length >= 2;
  }
}

/* ── 播放器 ───────────────────────────────────────────── */

export class VoicePlayer {
  private ctx: AudioContext | null = null;
  private queue: string[] = [];
  private controllers = new Set<AbortController>();
  private sources = new Set<AudioBufferSourceNode>();
  private running = false;
  private stopped = false;
  private instruction = "";
  private onEnd?: () => void;
  private onError?: () => void;

  constructor(options: { onEnd?: () => void; onError?: () => void } = {}) {
    this.onEnd = options.onEnd;
    this.onError = options.onError;
  }

  private context(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  setInstruction(instruction: string): void {
    this.instruction = instruction;
  }

  /** 追加一句并确保播放循环在跑 */
  enqueue(sentence: string, instruction = this.instruction): void {
    const text = cleanForSpeech(sentence);
    if (!text) return;
    this.instruction = instruction;
    this.queue.push(text);
    if (!this.running) void this.loop();
  }

  /** 一轮结束 */
  finish(): void {
    if (!this.running) this.onEnd?.();
  }

  /** 立刻停：声源、队列、在途请求全部清掉 */
  stop(): void {
    this.stopped = true;
    this.queue = [];
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    for (const source of this.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // 已经停了
      }
    }
    this.sources.clear();
    this.running = false;
    this.onEnd?.();
  }

  private async loop(): Promise<void> {
    this.running = true;
    this.stopped = false;

    while (this.queue.length && !this.stopped) {
      const sentence = this.queue[0]!;
      // 播放当前句的同时预取下一句
      const nextSentence = this.queue[1];
      const nextAudio = nextSentence ? this.fetchAudio(nextSentence) : null;

      try {
        const audio = await this.fetchAudio(sentence);
        this.queue.shift();
        if (this.stopped) break;
        if (audio) await this.play(audio);
        if (nextAudio) await nextAudio.catch(() => null);
      } catch {
        // 这一句失败就跳过，不打断整轮
        this.queue.shift();
        this.onError?.();
      }
    }

    this.running = false;
    if (!this.stopped) this.onEnd?.();
  }

  private async fetchAudio(text: string): Promise<ArrayBuffer | null> {
    const controller = new AbortController();
    this.controllers.add(controller);
    try {
      return await synthesizeSpeech(text, this.instruction, controller.signal);
    } finally {
      this.controllers.delete(controller);
    }
  }

  private async play(audio: ArrayBuffer): Promise<void> {
    const ctx = this.context();
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await ctx.decodeAudioData(audio.slice(0));
    if (this.stopped) return;

    await new Promise<void>((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        this.sources.delete(source);
        resolve();
      };
      this.sources.add(source);
      source.start();
    });
  }
}

export function nativeAudioReady(): boolean {
  return !Capacitor.isNativePlatform() || true;
}
