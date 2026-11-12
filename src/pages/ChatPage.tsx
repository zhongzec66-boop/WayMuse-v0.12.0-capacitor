import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  KeyRound,
  Plus,
  RotateCcw,
  Settings,
  Search,
  X,
  Square,
  Trash2,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { ApiError, streamServerChat } from "../api";
import {
  EXAM_INSTRUCTION,
  SentenceSplitter,
  VoicePlayer,
  cleanForSpeech,
  sceneInstruction,
} from "../voice/tts";
import { localSuggestions, parseReply, planTasks } from "../agent";
import type { Assignment, Exam } from "../semester";
import DeadlineProposalCard from "./DeadlineProposalCard";

import { parseCourseText, toCourses } from "../courseImport";
import { nextClass } from "../semester";
import { academicWeek, readTermStart } from "../term";
import type { ParsedCourse } from "../courseImport";
import { BRAND } from "../brand";
import BotAvatar from "../BotAvatar";
import { useHideNativeChrome } from "../chrome";
import { haptic } from "../nativeExtras";
import { formatSearchContext, webSearch } from "../search";
import type { SearchProvider } from "../search";
import { storage, createMemory } from "../storage";
import { newId } from "../id";
import { DeepSeekError, listDeepSeekModels } from "../deepseek/client";
import { DEEPSEEK_MODELS } from "../deepseek/config";
import { buildPromptVariables } from "../promptVariables";
import MarkdownText from "../deepseek/Markdown";
import { responseTokenBudget } from "../profile";
import type { UserProfile } from "../profile";
import type {
  ChatRequestMessage,
  DeepSeekConfig,
  DeepSeekMessage,
  DeepSeekUsage,
} from "../deepseek/types";
import type { Course, Memory, Task } from "../types";
type FileBlock = {
  name: string;
  size: number;
  binary: boolean;
  content: string;
};

/** 解析消息里的 [[FILE:{...}]]…[[/FILE]] 附件块。 */
function splitFileBlock(content: string): {
  file: FileBlock | null;
  rest: string;
} {
  const start = content.indexOf("[[FILE:");
  if (start < 0) return { file: null, rest: content };
  const headerEnd = content.indexOf("]]", start);
  if (headerEnd < 0) return { file: null, rest: content };
  const endMark = content.indexOf("[[/FILE]]", headerEnd);
  const headerRaw = content.slice(start + 7, headerEnd);
  const body = endMark > 0 ? content.slice(headerEnd + 2, endMark) : "";
  let meta: { n?: unknown; s?: unknown; b?: unknown } = {};
  try {
    meta = JSON.parse(headerRaw) as typeof meta;
  } catch {
    meta = {};
  }
  const rest = (
    content.slice(0, start) + (endMark > 0 ? content.slice(endMark + 9) : "")
  ).trim();
  return {
    file: {
      name: typeof meta.n === "string" ? meta.n : "文件",
      size: typeof meta.s === "number" ? meta.s : 0,
      binary: meta.b === true,
      content: body.trim(),
    },
    rest,
  };
}

function formatBytes(n: number): string {
  if (!n) return "未知大小";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type ConnectState = "idle" | "testing" | "ok" | "error";

function describeError(error: unknown): string {
  if (error instanceof DeepSeekError) {
    if (error.status === 401) return "API Key 无效或已过期（401）。";
    if (error.status === 402)
      return "账户余额不足（402），请到 DeepSeek 平台充值。";
    if (error.status === 429) return "请求过于频繁（429），请稍后再试。";
    if (error.status === 400) return `请求参数有误（400）：${error.message}`;
    if (error.status && error.status >= 500) {
      return `DeepSeek 服务异常（${error.status}），请稍后重试。`;
    }
    return error.message;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "请求已取消。";
  }
  if (error instanceof TypeError) {
    return "网络请求失败。检查网络、Base URL，或浏览器是否拦截了跨域请求。";
  }
  return "请求失败，请稍后重试。";
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function ChatPage({
  agentName,
  agentAvatar,
  pendingMessage,
  pendingImage,
  onPendingConsumed,
  onPendingImageConsumed,
  profile,
  memories,
  courses,
  tasks,
  onSettings,
  onTasksChange,
  assignments,
  onAssignmentsChange,
  exams,
  onExamsChange,
  onMemoriesChange,
  onCoursesChange,
  onViewPlans,
}: {
  agentName: string;
  agentAvatar: string;
  pendingMessage: { id: number; text: string } | null;
  pendingImage: { id: number; dataUrl: string } | null;
  onPendingConsumed: () => void;
  onPendingImageConsumed: () => void;
  profile: UserProfile;
  memories: Memory[];
  courses: Course[];
  tasks: Task[];
  onSettings: () => void;
  onTasksChange: (tasks: Task[]) => void;
  assignments: Assignment[];
  onAssignmentsChange: (assignments: Assignment[]) => void;
  exams: Exam[];
  onExamsChange: (exams: Exam[]) => void;
  onMemoriesChange: (memories: Memory[]) => void;
  onCoursesChange: (courses: Course[]) => void;
  onViewPlans: () => void;
}) {
  const [config, setConfig] = useState<DeepSeekConfig>(() =>
    storage.getDeepSeekConfig(),
  );
  const [apiKey, setApiKey] = useState(() => storage.getDeepSeekKey());
  const [rememberKey, setRememberKey] = useState(() =>
    storage.getDeepSeekRemember(),
  );
  const [showKey, setShowKey] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  /** 用户发来的课表：等确认后再写进课表 */
  const [expandedKb, setExpandedKb] = useState<string | null>(null);
  const [courseProposal, setCourseProposal] = useState<ParsedCourse[] | null>(
    null,
  );
  /** 收到图片时给一句实话：当前模型看不了图 */
  const [imageCourseHint, setImageCourseHint] = useState(false);
  /** 这一轮命中了哪些技能，给用户一个可见的信号 */
  const [activeSkills, setActiveSkills] = useState<string[]>([]);
  const [voiceOn, setVoiceOn] = useState(() => storage.getVoiceEnabled());
  // 播放状态只保留一份：哪条在播、播到哪一步。
  // 以前是全局 boolean，所有按钮都跟着变「停止」，串扰。
  const [voicePlay, setVoicePlay] = useState<{
    status: "idle" | "loading" | "playing";
    messageId: string | null;
  }>({ status: "idle", messageId: null });
  const voicePlayerRef = useRef<VoicePlayer | null>(null);
  const splitterRef = useRef<SentenceSplitter | null>(null);

  /** 单例播放器：同一时间只允许一条音频在播 */
  const player = () => {
    if (!voicePlayerRef.current) {
      voicePlayerRef.current = new VoicePlayer({
        onEnd: () => setVoicePlay({ status: "idle", messageId: null }),
      });
    }
    return voicePlayerRef.current;
  };

  const instructionFor = (skills: string[]) =>
    skills.some((name) => /考试|冲刺|突击/.test(name))
      ? EXAM_INSTRUCTION
      : sceneInstruction();

  /** 点喇叭：没开就顺手打开，然后用当前这条回复读一遍 */
  const toggleRead = (messageId: string, text: string) => {
    const engine = player();
    // 点的是正在播的那条 → 停；点的是另一条 → 先停再播新的，不排队
    if (voicePlay.messageId === messageId && voicePlay.status !== "idle") {
      engine.stop();
      setVoicePlay({ status: "idle", messageId: null });
      return;
    }
    if (voicePlay.status !== "idle") engine.stop();
    if (!voiceOn) {
      setVoiceOn(true);
      storage.setVoiceEnabled(true);
    }
    const clean = cleanForSpeech(text);
    if (!clean) return;
    setVoicePlay({ status: "playing", messageId });
    engine.enqueue(clean, instructionFor(activeSkills));
    engine.finish();
  };
  const [messages, setMessages] = useState<DeepSeekMessage[]>(() => {
    const saved = storage.getDeepSeekMessages();
    return saved.filter(
      (message, index) =>
        message.model !== "本地演示 · 示例回复" &&
        saved[index + 1]?.model !== "本地演示 · 示例回复",
    );
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [searchOn, setSearchOn] = useState(() => storage.getSearchEnabled());
  const [titleMenu, setTitleMenu] = useState(false);
  const [searchKey] = useState(() => storage.getSearchKey());
  const [searchProvider] = useState<SearchProvider>(
    () => storage.getSearchProvider() as SearchProvider,
  );
  const [error, setError] = useState("");
  const [connectState, setConnectState] = useState<ConnectState>("idle");
  const [connectText, setConnectText] = useState("");
  const [models, setModels] = useState<string[]>([]);
  // 用量只记录，不渲染（界面不显示 token / 耗时）
  const [, setUsage] = useState<DeepSeekUsage | null>(null);
  // 只用于历史兼容：现在耗时挂在消息上，不再单独维护
  const [, setLatency] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const testAbortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    storage.setDeepSeekMessages(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      testAbortRef.current?.abort();
    },
    [],
  );

  const modelOptions = Array.from(
    new Set([...DEEPSEEK_MODELS, ...models, config.model].filter(Boolean)),
  );

  const updateConfig = <K extends keyof DeepSeekConfig>(
    key: K,
    value: DeepSeekConfig[K],
  ) => setConfig((current) => ({ ...current, [key]: value }));

  const testConnection = async () => {
    if (!apiKey.trim()) {
      setConnectState("error");
      setConnectText("先填写 API Key。");
      return;
    }
    testAbortRef.current?.abort();
    const controller = new AbortController();
    testAbortRef.current = controller;
    setConnectState("testing");
    setConnectText("正在请求 /models…");
    try {
      const ids = await listDeepSeekModels({
        baseUrl: config.baseUrl,
        apiKey,
        signal: controller.signal,
      });
      setModels(ids);
      storage.setDeepSeekKey(apiKey, rememberKey);
      setConnectState("ok");
      setConnectText(
        ids.length
          ? `连接成功，可用模型：${ids.join("、")}`
          : "连接成功，但 /models 没有返回模型。",
      );
    } catch (caught) {
      if (controller.signal.aborted) return;
      setConnectState("error");
      setConnectText(describeError(caught));
    }
  };

  const saveSettings = () => {
    if (!apiKey.trim()) {
      setConnectState("error");
      setConnectText("先填写 API Key。");
      return;
    }
    storage.setDeepSeekConfig(config);
    storage.setDeepSeekKey(apiKey, rememberKey);
    setShowConfig(false);
    setConnectText("设置已保存到本机。");
  };

  const clearKey = () => {
    storage.setDeepSeekKey("", false);
    setApiKey("");
    setRememberKey(false);
    setConnectState("idle");
    setConnectText("已清除本机保存的 API Key。");
  };

  const sendMessage = async (
    text: string,
    history: DeepSeekMessage[],
    imageDataUrl?: string,
  ) => {
    const content = text.trim() || (imageDataUrl ? "看看这张图" : "");
    if (!content || streaming) return;

    // 技能命中改由服务端判断：这一轮先清空，等响应头回填名字
    setActiveSkills([]);

    // 附件或直接粘贴的课表：先本地认一遍。
    // 认出来就问一句「要不要加进课表」，而不是替用户决定，也不是当普通消息忽略。
    const fileMatch = content.match(
      /\[\[FILE:([^\]]*)\]\]([\s\S]*?)\[\[\/FILE\]\]/,
    );
    const attachMeta = fileMatch?.[1] ?? "";
    const attachBody = fileMatch ? fileMatch[2] : content;
    const isImage =
      /image\//i.test(attachMeta) ||
      /\.(png|jpe?g|webp|heic|gif|bmp)$/i.test(attachMeta);
    if (isImage) {
      setImageCourseHint(true);
      setCourseProposal(null);
    } else {
      setImageCourseHint(false);
      const parsed = parseCourseText(attachBody);
      if (parsed.courses.length >= 2) setCourseProposal(parsed.courses);
    }

    // 联网搜索：只在开关打开且有 key 时查一次，结果拼进 system prompt
    let webContext = "";
    if (searchOn && searchKey.trim()) {
      const hits = await webSearch(content, {
        provider: searchProvider,
        apiKey: searchKey,
      });
      webContext = formatSearchContext(content, hits);
    }

    // 没有本地 Key 或带图片：走服务端代理（Key 在服务器，客户端只带令牌）
    // 全量走服务端：客户端不再持有任何 Key
    {
      const userMessage: DeepSeekMessage = {
        id: newId(),
        role: "user",
        content,
        createdAt: Date.now(),
        imageDataUrl,
      };
      const assistantId = newId();
      const createdAt = Date.now();
      const startedAt = performance.now();

      setMessages([
        ...history,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt,
          model: "server",
        },
      ]);
      setError("");
      setUsage(null);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let serverContent = "";
        await streamServerChat({
          // system 由服务端按变量拼，模板不出客户端
          variables: buildPromptVariables({
            useContext: config.useContext,
            profile,
            context: { memories, courses, tasks },
            webContext,
          }),
          messages: [
            ...history.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            {
              role: "user",
              // 带图时用 OpenAI 兼容的块数组；flash 的视觉能力靠这个入口
              content: imageDataUrl
                ? [
                    { type: "text" as const, text: content },
                    {
                      type: "image_url" as const,
                      image_url: { url: imageDataUrl },
                    },
                  ]
                : content,
            },
          ],
          temperature: profile.temperature,
          maxTokens: Math.max(
            config.maxTokens,
            responseTokenBudget(profile.responseLength),
            config.thinking ? 4096 : 0,
            // flash 会先吐 reasoning，识图给少了正文会空
            imageDataUrl ? 1500 : 0,
          ),
          signal: controller.signal,
          onMeta: (meta) => {
            // 服务端告诉我们这一轮命中了哪个技能，直接显示，不内置清单
            if (meta.skillName) setActiveSkills([meta.skillName]);
            if (!meta.kbCount) return;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, kbCount: meta.kbCount, kbTags: meta.kbTags }
                  : message,
              ),
            );
          },
          onDelta: (delta) => {
            serverContent += delta;
            if (voiceOn) {
              if (!splitterRef.current)
                splitterRef.current = new SentenceSplitter();
              const engine = player();
              engine.setInstruction(instructionFor(activeSkills));
              for (const sentence of splitterRef.current.push(delta)) {
                setVoicePlay({ status: "playing", messageId: assistantId });
                engine.enqueue(sentence);
              }
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + delta }
                  : message,
              ),
            );
          },
        });

        if (!serverContent.trim()) throw new Error("服务端没有返回内容");

        const parsedServer = parseReply(serverContent).courses;
        if (parsedServer.length) setCourseProposal(parsedServer);

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  latencyMs: Math.round(performance.now() - startedAt),
                }
              : message,
          ),
        );
        setConnectState("ok");
        setConnectText("服务端代理");
        setLatency(Math.round(performance.now() - startedAt));
        if (voiceOn && splitterRef.current) {
          const engine = player();
          for (const sentence of splitterRef.current.flush()) {
            setVoicePlay({ status: "playing", messageId: assistantId });
            engine.enqueue(sentence);
          }
          engine.finish();
        }
      } catch (serverError) {
        if (serverError instanceof ApiError && serverError.status === 429) {
          setError("今天的额度用完了，明天再来；需要更多额度可以找我们充值");
          setMessages((current) =>
            current.filter((message) => message.id !== assistantId),
          );
          return;
        }

        // 服务端不可用：退回本地建议，保证还能给出可执行方案
        console.warn("[chat] server failed", serverError);
        const local = localSuggestions(content);
        const parts = [local.text];
        if (local.plans.length) {
          parts.push(`<plans>${JSON.stringify(local.plans)}</plans>`);
        }
        if (local.memories.length) {
          parts.push(`<memories>${JSON.stringify(local.memories)}</memories>`);
        }
        setMessages([
          ...history,
          userMessage,
          {
            id: assistantId,
            role: "assistant",
            content: parts.join("\n\n"),
            createdAt,
            model: "本地建议",
          },
        ]);
        setError("");
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
      return;
    }

    const userMessage: DeepSeekMessage = {
      id: newId(),
      role: "user",
      content,
      createdAt: Date.now(),
    };
    const assistantId = newId();
    const assistantMessage: DeepSeekMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      model: config.model,
    };
    setMessages([...history, userMessage, assistantMessage]);
    setError("");
    setUsage(null);
    setLatency(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();
    let firstTokenAt: number | null = null;

    const payload: ChatRequestMessage[] = [
      ...history
        .filter((message) => message.content.trim())
        .slice(-30)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
      { role: "user", content },
    ];
    const requestConfig: DeepSeekConfig = {
      ...config,
      temperature: profile.temperature,
      // 设置页里的 maxTokens 之前被写死的 1400 覆盖了；这里让设置生效。
      // 开思考模式时思考内容也吃额度，给不足就只剩「思考过程」没有正文。
      maxTokens: Math.max(
        config.maxTokens,
        responseTokenBudget(profile.responseLength),
        config.thinking ? 4096 : 0,
      ),
    };

    try {
      // ① 优先走服务端代理：Key 只在服务器，客户端只带令牌
      try {
        let serverContent = "";
        await streamServerChat({
          messages: payload.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          temperature: requestConfig.temperature,
          maxTokens: requestConfig.maxTokens,
          signal: controller.signal,
          onMeta: (meta) => {
            // 服务端告诉我们这一轮命中了哪个技能，直接显示，不内置清单
            if (meta.skillName) setActiveSkills([meta.skillName]);
            if (!meta.kbCount) return;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, kbCount: meta.kbCount, kbTags: meta.kbTags }
                  : message,
              ),
            );
          },
          onDelta: (delta) => {
            firstTokenAt ??= performance.now();
            serverContent += delta;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + delta }
                  : message,
              ),
            );
          },
        });

        if (!serverContent.trim()) {
          throw new Error("服务端没有返回内容");
        }

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  model: "server",
                  latencyMs: Math.round(performance.now() - startedAt),
                }
              : message,
          ),
        );
        const parsedServerCourses = parseReply(serverContent).courses;
        if (parsedServerCourses.length) setCourseProposal(parsedServerCourses);
        setConnectState("ok");
        setConnectText("服务端代理");
        setLatency(Math.round(performance.now() - startedAt));
        return;
      } catch (serverError) {
        // 配额用完：明确告诉用户，不要静默失败
        const status = (serverError as { status?: number } | null)?.status;
        if (status === 429) {
          setError("今天的额度用完了，明天再来；需要更多额度可以找我们充值");
          setMessages((current) =>
            current.filter(
              (message) =>
                message.id !== assistantId || Boolean(message.content.trim()),
            ),
          );
          return;
        }
        throw serverError;
      }
    } catch (caught) {
      if (controller.signal.aborted) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  stopped: true,
                  content: message.content || "（已停止，没有生成内容）",
                }
              : message,
          ),
        );
      } else {
        setError(describeError(caught));
        setMessages((current) =>
          current.filter(
            (message) =>
              message.id !== assistantId || Boolean(message.content.trim()),
          ),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  useEffect(() => {
    if (!pendingMessage) return;
    onPendingConsumed();
    if (streaming) {
      setError("正在生成，请稍候再发送。");
      return;
    }
    void sendMessage(pendingMessage.text, messages);
  }, [pendingMessage]);

  // 图片走视觉模型：直接发，省掉「先 OCR 再问」这一步
  useEffect(() => {
    if (!pendingImage) return;
    onPendingImageConsumed();
    if (streaming) {
      setError("正在生成，请稍候再发送。");
      return;
    }
    void sendMessage("", messages, pendingImage.dataUrl);
  }, [pendingImage]);

  const stop = () => abortRef.current?.abort();

  const retry = () => {
    const lastUserIndex = messages.reduce(
      (index, message, current) => (message.role === "user" ? current : index),
      -1,
    );
    if (lastUserIndex < 0) return;
    void sendMessage(
      messages[lastUserIndex].content,
      messages.slice(0, lastUserIndex),
    );
  };

  const newChat = () => {
    if (!messages.length) return;
    if (!window.confirm("清空当前对话？")) return;
    setMessages([]);
    setUsage(null);
    setLatency(null);
    setError("");
    storage.setDeepSeekMessages([]);
  };

  const exportChat = () => {
    if (!messages.length) return;
    const lines = messages.map((message) => {
      const who = message.role === "user" ? "我" : agentName;
      const reasoning = message.reasoning
        ? `\n\n<details><summary>思考过程</summary>\n\n${message.reasoning}\n\n</details>`
        : "";
      return `## ${who} · ${formatTime(
        message.createdAt,
      )}\n\n${message.content}${reasoning}`;
    });
    const blob = new Blob([`# ${BRAND} 对话\n\n${lines.join("\n\n")}\n`], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `waymuse-chat-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /**
   * 开场建议：按时段 + 年级组合，每天轮换。
   *
   * 之前是 3 条写死的文案，所有人、所有时间看到的都一样；
   * 现在至少让人感觉「它知道现在是晚上」「它知道我是大三」。
   */
  const suggestions = (() => {
    const hour = new Date().getHours();
    const timePool =
      hour < 5
        ? ["睡不着，明天还有早八，怎么办", "脑子很乱，陪我理一下明天要做什么"]
        : hour < 11
          ? ["今天课有点满，帮我排个优先级", "早八起不来，有什么办法吗"]
          : hour < 18
            ? ["下午没课，帮我安排两小时高效学习", "这道题不会，陪我拆一下思路"]
            : ["今天有点累，想聊一会儿", "帮我复盘一下今天，顺便定明天的重点"];

    const gradePool =
      profile.grade === "大一"
        ? ["想加个社团，怎么判断值不值得", "刚上大学，怎么安排学习和生活"]
        : profile.grade === "大二"
          ? ["专业方向还没定，怎么选", "想试试竞赛，从哪开始"]
          : profile.grade === "大三"
            ? ["保研和考研我该怎么选", "想准备第一份实习，有什么方案"]
            : profile.grade === "大四"
              ? ["找工作还是考研，怎么定", "毕业论文开题没思路，帮我拆一下"]
              : ["怎么跟导师沟通进度", "科研和课程时间怎么平衡"];

    const general = [
      profile.major.trim()
        ? `${profile.major.trim()}专业以后能做什么工作`
        : "我这个专业以后能做什么工作",
      "最近总是拖延，有什么办法",
    ];

    // 4 条：2×2 网格刚好一屏放得下，不用滚动也不会压到输入框
    const pool = [...timePool, ...gradePool, ...general];
    const offset = new Date().getDate() % pool.length;
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
    return rotated.slice(0, 4);
  })();

  // 胶囊里的一行：默认报下一节课，回复中报「正在回复…」
  const upcoming = nextClass(
    courses,
    new Date(),
    academicWeek(readTermStart()),
  );
  const nextClassLine = upcoming
    ? `下一节 ${upcoming.course.name} ${String(upcoming.startsAt.getHours()).padStart(2, "0")}:${String(upcoming.startsAt.getMinutes()).padStart(2, "0")}`
    : "";

  // 模型在服务端，用户不用配任何东西：没出错就是「准备就绪」，
  // 只有真出错才显示连接失败（以前这里写「未连接」，看起来像没配好）
  const statusLabel =
    connectState === "ok"
      ? "已连接"
      : connectState === "testing"
        ? "发送中"
        : connectState === "error"
          ? "连接失败"
          : "准备就绪";

  // 标题菜单打开时要隐藏原生 chrome，否则会被原生输入框盖住
  useHideNativeChrome(Boolean(titleMenu));

  return (
    <>
      {titleMenu && (
        <div
          className="wr-overlay wr-overlay-fixed"
          onClick={() => setTitleMenu(false)}
        >
          <div
            className="wr-sheet wr-titlemenu"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => {
                const next = !searchOn;
                setSearchOn(next);
                storage.setSearchEnabled(next);
                void haptic("light");
              }}
            >
              <Globe size={19} /> 联网搜索
              <em>{searchOn ? "已开" : "已关"}</em>
            </button>
            <button
              onClick={() => {
                setTitleMenu(false);
                setSearchOpen(true);
              }}
            >
              <Search size={19} /> 搜索聊天记录
            </button>
            <button onClick={() => setTitleMenu(false)}>取消</button>
          </div>
        </div>
      )}

      <div
        className={
          messages.length === 0 ? "wr-chat-head is-empty" : "wr-chat-head"
        }
      >
        <button className="wr-round" aria-label="设置" onClick={onSettings}>
          <Settings />
        </button>
        <button
          className="wr-chat-title"
          aria-label="打开快捷操作"
          onClick={() => {
            void haptic("medium");
            setTitleMenu(true);
          }}
        >
          <span className="wr-chat-orb">
            <BotAvatar source={agentAvatar} replying={streaming} />
          </span>
          <span className="wr-chat-cap-pill">
            <b>{streaming ? "正在回复…" : nextClassLine || agentName}</b>
          </span>
        </button>
        {/* 右侧留白，保证标题严格居中 */}
        <span className="wr-chat-head-spacer" aria-hidden="true" />
      </div>

      {/* 空态固定在可视区里，不参与滚动：
          以前它在滚动容器内，用户往下翻头像就没了，整页像一张长截图。 */}
      {!showConfig && messages.length === 0 && (
        <div className="wr-chat-empty">
          <button
            className="wr-chat-hero"
            aria-label="打开快捷操作"
            onClick={() => {
              void haptic("medium");
              setTitleMenu(true);
            }}
          >
            <span className="wr-hero-orb">
              <BotAvatar source={agentAvatar} replying={streaming} />
            </span>
            <b>{agentName}</b>
            <small>{statusLabel}</small>
          </button>
          <div className="wr-ai-empty">
            <p>直接说事，或者从下面挑一个</p>
            {connectState === "error" && (
              <button
                type="button"
                className="wr-ai-primary"
                onClick={onSettings}
              >
                检查连接设置
              </button>
            )}
            <div className="wr-ai-suggestions">
              {suggestions.map((text) => (
                <button
                  type="button"
                  key={text}
                  onClick={() => {
                    void sendMessage(text, messages);
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="wr-chat-scroll">
        {searchOpen && (
          <div className="wr-chat-search">
            <Search size={18} />
            <input
              autoFocus
              aria-label="搜索聊天记录"
              placeholder="搜索聊天记录…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              aria-label="关闭搜索"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            >
              <X size={20} />
            </button>
            <button
              onClick={newChat}
              disabled={!messages.length}
              aria-label="新对话"
            >
              <Plus size={20} />
            </button>
          </div>
        )}
        {searchOpen &&
          searchQuery.trim() &&
          !messages.some((m) =>
            m.content.toLowerCase().includes(searchQuery.trim().toLowerCase()),
          ) && <p className="wr-chat-search-empty">没有找到相关聊天记录</p>}

        {(apiKey || streaming) && (
          <div className="wr-chat-status-line">
            {apiKey && <span>{config.model}</span>}
            {streaming && (
              <button type="button" className="wr-chat-stop" onClick={stop}>
                <Square size={13} /> 停止
              </button>
            )}
          </div>
        )}

        {showConfig && (
          <section className="wr-ai-config">
            <div className="wr-ai-config-head">
              <div>
                <b>连接 DeepSeek</b>
                <small>配置只保存在本机；发送时才会请求 api.deepseek.com</small>
              </div>
              <KeyRound size={20} />
            </div>

            <label className="wr-ai-field">
              <span>API Key</span>
              <div className="wr-ai-key">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="sk-…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  aria-label={showKey ? "隐藏密钥" : "显示密钥"}
                  onClick={() => setShowKey((value) => !value)}
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label className="wr-ai-check">
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={(event) => setRememberKey(event.target.checked)}
              />
              记住密钥（写入本机 localStorage）
            </label>
            <p className="wr-ai-warning">
              默认只存本次会话。正式版应通过后端代理，不要把长期 Key 打进 App。
            </p>

            <label className="wr-ai-field">
              <span>Base URL</span>
              <input
                value={config.baseUrl}
                onChange={(event) =>
                  updateConfig("baseUrl", event.target.value)
                }
                placeholder="https://api.deepseek.com"
                spellCheck={false}
              />
            </label>
            <label className="wr-ai-field">
              <span>模型</span>
              <input
                list="wr-chat-models"
                value={config.model}
                onChange={(event) => updateConfig("model", event.target.value)}
                spellCheck={false}
              />
              <datalist id="wr-chat-models">
                {modelOptions.map((model) => (
                  <option value={model} key={model} />
                ))}
              </datalist>
            </label>

            <p className="wr-ai-warning">
              回复温度与长度由「设置 → 陪伴风格」决定：{profile.tone} · 温度{" "}
              {profile.temperature.toFixed(1)} · {profile.responseLength}回复。
            </p>

            <label className="wr-ai-check">
              <input
                type="checkbox"
                checked={config.thinking}
                onChange={(event) =>
                  updateConfig("thinking", event.target.checked)
                }
              />
              深度思考（更慢，会返回思考过程）
            </label>
            {config.thinking && (
              <label className="wr-ai-field">
                <span>思考强度</span>
                <select
                  value={config.reasoningEffort}
                  onChange={(event) =>
                    updateConfig(
                      "reasoningEffort",
                      event.target.value as DeepSeekConfig["reasoningEffort"],
                    )
                  }
                >
                  <option value="low">low · 更快</option>
                  <option value="high">high · 默认</option>
                  <option value="max">max · 最充分</option>
                </select>
              </label>
            )}

            <label className="wr-ai-check">
              <input
                type="checkbox"
                checked={config.useContext}
                onChange={(event) =>
                  updateConfig("useContext", event.target.checked)
                }
              />
              带入本机资料（记忆 / 课程 / 任务）
            </label>

            <div className="wr-ai-config-actions">
              <button
                type="button"
                className="wr-ai-primary"
                onClick={() => void testConnection()}
                disabled={connectState === "testing"}
              >
                {connectState === "testing" ? "测试中…" : "测试连接"}
              </button>
              <button
                type="button"
                className="wr-ai-secondary"
                onClick={saveSettings}
              >
                保存并开始
              </button>
            </div>
            <div className="wr-ai-config-actions">
              <button type="button" className="wr-ai-ghost" onClick={clearKey}>
                清除密钥
              </button>
              <button
                type="button"
                className="wr-ai-ghost danger"
                onClick={() => setShowConfig(false)}
              >
                收起设置
              </button>
            </div>

            {connectText && (
              <p
                className={`wr-ai-connect-note ${connectState}`}
                role={connectState === "error" ? "alert" : "status"}
              >
                {connectState === "ok" && <CheckCircle2 size={16} />}
                {connectState === "error" && <TriangleAlert size={16} />}
                {connectText}
              </p>
            )}
          </section>
        )}

        {!showConfig && messages.length > 0 && (
          <div className="wr-ai-toolbar">
            <span>{messages.length} 条消息</span>
            <div>
              <button type="button" onClick={exportChat}>
                <Download size={15} /> 导出
              </button>
              <button type="button" onClick={newChat}>
                <Trash2 size={15} /> 新对话
              </button>
            </div>
          </div>
        )}

        {!showConfig && (
          <>
            {messages.length > 0 && (
              <div className="wr-chat-date">
                今天 · {formatTime(messages[0].createdAt)}
              </div>
            )}
            <div className="wr-ai-messages">
              {messages
                .filter(
                  (message) =>
                    !searchOpen ||
                    !searchQuery.trim() ||
                    message.content
                      .toLowerCase()
                      .includes(searchQuery.trim().toLowerCase()),
                )
                .map((message) =>
                  message.role === "user" ? (
                    (() => {
                      const parsed = splitFileBlock(message.content);
                      return (
                        <div className="wr-ai-row user" key={message.id}>
                          {parsed.file && (
                            <div className="wr-file-card">
                              <span className="wr-file-mark">
                                <FileText size={16} />
                              </span>
                              <span className="wr-file-body">
                                <b>{parsed.file.name}</b>
                                <small>
                                  {formatBytes(parsed.file.size)}
                                  {parsed.file.binary
                                    ? " · 仅记录文件名"
                                    : " · 内容已读入对话"}
                                </small>
                              </span>
                              {!parsed.file.binary &&
                                parsed.file.content.trim() && (
                                  <button
                                    className="wr-file-remember"
                                    onClick={() =>
                                      onMemoriesChange([
                                        ...memories,
                                        createMemory(
                                          parsed
                                            .file!.content.replace(/\s+/g, " ")
                                            .trim()
                                            .slice(0, 60),
                                        ),
                                      ])
                                    }
                                  >
                                    记住这段
                                  </button>
                                )}
                            </div>
                          )}
                          {message.imageDataUrl && (
                            <img
                              className="wr-msg-image"
                              src={message.imageDataUrl}
                              alt="我发的图片"
                              loading="lazy"
                            />
                          )}
                          {parsed.rest && (
                            <div className="wr-ai-bubble user">
                              {parsed.rest}
                            </div>
                          )}
                          <small>{formatTime(message.createdAt)}</small>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="wr-ai-row assistant" key={message.id}>
                      <div className="wr-ai-bubble assistant">
                        <div className="wr-ai-who">
                          {agentName}
                          <small>{message.model ?? config.model}</small>
                        </div>
                        {message.reasoning && (
                          <details className="wr-ai-reasoning">
                            <summary>思考过程</summary>
                            <pre>{message.reasoning}</pre>
                          </details>
                        )}
                        {message.content ? (
                          <div className="wr-reply-parts">
                            {/*
                              以前是按空行切成多段分别渲染，结果围栏代码块被切断，
                              ``` 配不上对，代码只能退化成 <pre>。
                              现在整段交给 MarkdownText，它自己会切出代码块。
                            */}
                            <MarkdownText
                              text={parseReply(message.content).text}
                            />
                          </div>
                        ) : (
                          <span className="wr-ai-typing">正在生成…</span>
                        )}
                        {message.stopped && (
                          <span className="wr-ai-stopped">已停止生成</span>
                        )}
                        {message.kbCount ? (
                          <button
                            type="button"
                            className="wr-kb-chip"
                            title="这些回答参考了同专业学长学姐的真实经验，已做匿名处理"
                            onClick={() => {
                              setExpandedKb((current) =>
                                current === message.id ? null : message.id,
                              );
                            }}
                          >
                            <BookOpen size={12} />
                            参考了 {message.kbCount} 位同专业学长
                            {message.kbTags?.length ? (
                              <span className="wr-kb-more">
                                {expandedKb === message.id ? "收起" : "看看"}
                              </span>
                            ) : null}
                          </button>
                        ) : null}
                        {message.kbCount && expandedKb === message.id ? (
                          <div className="wr-kb-detail">
                            {message.kbTags?.length ? (
                              <>
                                <small>参考方向</small>
                                <div className="wr-kb-tags">
                                  {message.kbTags.map((tag) => (
                                    <span key={tag}>{tag}</span>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <small>这次命中的经验没有可展示的标签</small>
                            )}
                            <small className="wr-kb-note">
                              内容已匿名化改写，不含姓名、学校和联系方式。
                            </small>
                          </div>
                        ) : null}
                        <div className="wr-ai-meta">
                          {message.content.trim() ? (
                            <button
                              type="button"
                              className={
                                voicePlay.messageId === message.id &&
                                voicePlay.status !== "idle"
                                  ? "wr-voice-btn playing"
                                  : "wr-voice-btn"
                              }
                              onClick={() =>
                                toggleRead(
                                  message.id,
                                  parseReply(message.content).text,
                                )
                              }
                              aria-label={
                                voicePlay.messageId === message.id &&
                                voicePlay.status !== "idle"
                                  ? "停止朗读"
                                  : "朗读这条回复"
                              }
                            >
                              {voicePlay.messageId === message.id &&
                              voicePlay.status !== "idle" ? (
                                <Square size={12} />
                              ) : (
                                <Volume2 size={12} />
                              )}
                              {voicePlay.messageId === message.id &&
                              voicePlay.status !== "idle"
                                ? "停止"
                                : "朗读"}
                            </button>
                          ) : null}

                          {message.finishReason === "length" && (
                            <span className="danger">已截断</span>
                          )}
                          {message.finishReason === "content_filter" && (
                            <span className="danger">内容过滤</span>
                          )}
                          {message.finishReason ===
                            "insufficient_system_resource" && (
                            <span className="danger">服务中断</span>
                          )}
                        </div>
                      </div>
                      {(() => {
                        // 只在最后一条、且不在生成中时给出可点选项，
                        // 否则历史消息里的按钮还能点，会答非所问。
                        const isLast =
                          message.id === messages[messages.length - 1]?.id;
                        if (!isLast || streaming) return null;
                        const choices = parseReply(message.content).choices;
                        if (!choices.length) return null;
                        return (
                          <div
                            className="wr-choices"
                            role="group"
                            aria-label="可选回答"
                          >
                            {choices.map((choice) => (
                              <button
                                key={choice}
                                type="button"
                                className="wr-choice"
                                onClick={() =>
                                  void sendMessage(choice, messages)
                                }
                              >
                                {choice}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      {(!streaming ||
                        message.id !== messages[messages.length - 1]?.id) &&
                        parseReply(message.content).plans.map((plan, index) => {
                          const proposed = planTasks(message.id, index, plan);
                          const selected = proposed.some((t) =>
                            tasks.some((existing) => existing.id === t.id),
                          );
                          return (
                            <section
                              className="wr-plan-proposal"
                              key={index}
                              aria-label={plan.title}
                            >
                              <small>
                                {selected
                                  ? "已加入你的计划"
                                  : "建议方案 · 等你确认"}
                              </small>
                              <h3>{plan.title}</h3>
                              <p>{plan.summary}</p>
                              <ol>
                                {plan.steps.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                              {selected ? (
                                <div className="wr-plan-actions">
                                  <button onClick={onViewPlans}>
                                    查看计划
                                  </button>
                                  <button
                                    onClick={() =>
                                      onTasksChange(
                                        tasks.filter(
                                          (t) =>
                                            !proposed.some(
                                              (p) => p.id === t.id,
                                            ),
                                        ),
                                      )
                                    }
                                  >
                                    撤回方案
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="wr-ai-primary"
                                  onClick={() =>
                                    onTasksChange([
                                      ...tasks,
                                      ...proposed.filter(
                                        (t) =>
                                          !tasks.some(
                                            (existing) => existing.id === t.id,
                                          ),
                                      ),
                                    ])
                                  }
                                >
                                  选这个方案，加入计划
                                </button>
                              )}
                            </section>
                          );
                        })}
                      {(!streaming ||
                        message.id !== messages[messages.length - 1]?.id) &&
                        (() => {
                          const proposals =
                            parseReply(message.content).deadlines ?? [];
                          if (!proposals.length) return null;
                          return (
                            <DeadlineProposalCard
                              proposals={proposals}
                              onAssignmentsChange={(items) =>
                                onAssignmentsChange([
                                  ...assignments,
                                  ...items,
                                ] as Assignment[])
                              }
                              onExamsChange={(items) =>
                                onExamsChange([...exams, ...items] as Exam[])
                              }
                              onDismiss={() => undefined}
                            />
                          );
                        })()}
                      {(!streaming ||
                        message.id !== messages[messages.length - 1]?.id) &&
                        (() => {
                          const proposed = parseReply(
                            message.content,
                          ).memories.filter(
                            (item) =>
                              !memories.some((m) => m.text === item.text),
                          );
                          if (!proposed.length) return null;
                          return (
                            <section
                              className="wr-memory-proposal"
                              aria-label="记忆建议"
                            >
                              <small>想记住这些 · 等你确认</small>
                              <ul>
                                {proposed.map((item) => (
                                  <li key={item.text}>
                                    {item.text}
                                    {item.kind === "emotion" && (
                                      <em className="wr-memory-kind">情绪</em>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              <button
                                className="wr-ai-primary"
                                onClick={() =>
                                  onMemoriesChange([
                                    ...proposed.map((item) =>
                                      createMemory(
                                        item.text,
                                        item.kind === "emotion" ? 3 : 2,
                                        item.kind ?? "normal",
                                      ),
                                    ),
                                    ...memories,
                                  ])
                                }
                              >
                                记住这些
                              </button>
                            </section>
                          );
                        })()}
                    </div>
                  ),
                )}
              <div ref={bottomRef} />
            </div>
          </>
        )}

        {!showConfig && error && (
          <div className="wr-ai-error" role="alert">
            <TriangleAlert size={18} />
            <div>
              <b>请求失败</b>
              <p>{error}</p>
              <button type="button" onClick={retry} disabled={streaming}>
                <RotateCcw size={15} /> 重试上一条
              </button>
            </div>
          </div>
        )}

        {/* 用户发来课表（粘贴的文字或文件）后，先问一句要不要加进课表，
            而不是替他做决定，也不是把课表内容当成普通聊天忽略掉。 */}
        {!showConfig && courseProposal && (
          <section className="wr-course-proposal" aria-label="课表导入确认">
            <small>看起来是课表 · 等你确认</small>
            <h3>把你发来的 {courseProposal.length} 门课加进课表？</h3>
            <ul>
              {courseProposal.slice(0, 6).map((course, index) => (
                <li key={`${course.name}-${index}`}>
                  <span>{WEEKDAYS[course.weekday]}</span>
                  <span>
                    {course.start}–{course.end}
                  </span>
                  <b>{course.name}</b>
                  {course.place && <em>{course.place}</em>}
                </li>
              ))}
            </ul>
            {courseProposal.length > 6 && (
              <p className="wr-course-proposal-more">
                还有 {courseProposal.length - 6} 门课
              </p>
            )}
            <div className="wr-plan-actions">
              <button
                type="button"
                onClick={() => {
                  const added = toCourses(courseProposal, courses, newId);
                  if (added.length) onCoursesChange([...courses, ...added]);
                  setCourseProposal(null);
                }}
              >
                加入课表
              </button>
              <button type="button" onClick={() => setCourseProposal(null)}>
                先不用
              </button>
            </div>
          </section>
        )}

        {!showConfig && activeSkills.length > 0 && (
          <div className="wr-skill-chip" role="status">
            已启用：{activeSkills.join(" · ")}
          </div>
        )}

        {!showConfig && imageCourseHint && (
          <div className="wr-ai-error" role="status">
            <TriangleAlert size={18} />
            <div>
              <b>图片我先看不了</b>
              <p>
                当前模型不支持看图。把课表上的文字复制粘贴过来，我就能解析并排进课表。
              </p>
            </div>
          </div>
        )}

        {/* 用量与耗时只进日志/自检，不渲染到界面 */}
      </div>
    </>
  );
}
