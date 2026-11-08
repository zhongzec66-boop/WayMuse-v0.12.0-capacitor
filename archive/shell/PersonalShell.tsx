import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ListTodo,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AvatarPicker from "../AvatarPicker";
import { BRAND } from "../brand";
import Onboarding from "../Onboarding";
import { storage } from "../storage";
import {
  DeepSeekError,
  listDeepSeekModels,
  streamDeepSeekChat,
} from "../deepseek/client";
import { buildSystemPrompt } from "../deepseek/prompt";
import { DEFAULT_DEEPSEEK_CONFIG } from "../deepseek/config";
import type { DeepSeekConfig, DeepSeekUsage } from "../deepseek/types";
import {
  COMPANION_PRESETS,
  COMPANION_TYPES,
  DEFAULT_PROFILE,
  GRADES,
  RESPONSE_LENGTHS,
  TONES,
  responseTokenBudget,
} from "../profile";
import type {
  CompanionTone,
  CompanionType,
  ResponseLength,
  UserProfile,
} from "../profile";

type Tab = "chat" | "today" | "tasks" | "memories" | "profile";
type TaskStatus = "doing" | "scheduled" | "done";

type ShellTask = {
  id: string;
  title: string;
  detail: string;
  status: TaskStatus;
};

type MemoryItem = { id: string; text: string };
type MemoryGroup = { id: string; title: string; items: MemoryItem[] };
type Brief = {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  action: string;
};

type MessageCard = {
  title: string;
  meta: string;
  action: string;
  added?: boolean;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  time: string;
  card?: MessageCard;
  memoryRefs?: string[];
  reasoning?: string;
  usage?: DeepSeekUsage;
  latencyMs?: number;
  pending?: boolean;
  error?: string;
  demo?: boolean;
};

const seedMessages = (
  [
    {
      id: "m1",
      role: "assistant",
      text: "早上好。我把今天最值得先做的一件事放到了右边。",
      time: "09:12",
    },
    {
      id: "m2",
      role: "user",
      text: "帮我把实习方向再缩小一点。",
      time: "09:14",
    },
    {
      id: "m3",
      role: "assistant",
      text: "可以。先别急着投递——你更接近产品还是数据？",
      time: "09:14",
      memoryRefs: [
        "你希望明年暑假找到第一份实习",
        "你对产品与数据分析方向感兴趣",
      ],
    },
    {
      id: "m4",
      role: "user",
      text: "更偏产品，但不想丢掉数据分析。",
      time: "09:15",
    },
    {
      id: "m5",
      role: "assistant",
      text: "那这周先做一个小实验：找 3 个产品实习，只比较它们要求的数据能力。",
      time: "09:15",
      card: {
        title: "整理 3 个产品实习方向",
        meta: "今天 18:00 前 · 预计 40 分钟",
        action: "加入任务",
      },
    },
  ] as Message[]
).map((message) => ({ ...message, demo: true }));

const seedBriefs: Brief[] = [
  {
    id: "b1",
    icon: Briefcase,
    title: "实习动态",
    summary: "你关注的产品实习有 1 条新动态",
    action: "查看",
  },
  {
    id: "b2",
    icon: CalendarDays,
    title: "日程变化",
    summary: "下午 3 点的组会改到 4 点",
    action: "已同步",
  },
  {
    id: "b3",
    icon: BookOpen,
    title: "课程提醒",
    summary: "数据结构作业今晚 23:59 截止",
    action: "去处理",
  },
];

const seedTasks: ShellTask[] = [
  {
    id: "t1",
    title: "整理实习方向清单",
    detail: "后台执行中",
    status: "doing",
  },
  {
    id: "t2",
    title: "每周复盘",
    detail: "周日 20:00",
    status: "scheduled",
  },
  {
    id: "t3",
    title: "更新简历项目描述",
    detail: "已完成",
    status: "done",
  },
];

const seedMemories: MemoryGroup[] = [
  {
    id: "g1",
    title: "目标",
    items: [
      { id: "me1", text: "明年暑假找到第一份产品实习" },
      { id: "me2", text: "这学期把数据结构稳定在 85 分以上" },
    ],
  },
  {
    id: "g2",
    title: "偏好",
    items: [
      { id: "me3", text: "更喜欢先看例子再听概念" },
      { id: "me4", text: "晚上 9 点后不想安排高强度任务" },
    ],
  },
  {
    id: "g3",
    title: "日常",
    items: [
      { id: "me5", text: "周三下午通常在图书馆" },
      { id: "me6", text: "每周日晚上做一次周复盘" },
    ],
  },
];

const taskStatusLabel: Record<TaskStatus, string> = {
  doing: "进行中",
  scheduled: "定时",
  done: "已完成",
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = () => setMatches(media.matches);
    handler();
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function nowTime(): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function statusClass(status: TaskStatus): string {
  return `ps-task-dot ${status}`;
}

function toStoredTask(task: ShellTask) {
  return {
    id: task.id,
    text: task.title,
    detail: task.detail,
    status: task.status,
    done: task.status === "done",
  };
}

function isShellMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<Message>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.time === "string"
  );
}

function loadShellMessages(): Message[] {
  const stored = storage.getShellMessages();
  const messages = stored
    .filter(isShellMessage)
    .map((message) => ({ ...message, pending: false }))
    .filter((message) =>
      Boolean(message.text || message.error || message.card),
    );
  if (messages.length) return messages;

  const legacy = storage.getDeepSeekMessages();
  if (legacy.length) {
    const migrated: Message[] = legacy
      .filter((message) => message.content.trim())
      .map((message) => ({
        id: message.id,
        role: message.role,
        text: message.content,
        time: new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(message.createdAt)),
        reasoning: message.reasoning || undefined,
        usage: message.usage,
        latencyMs: message.latencyMs,
      }));
    if (migrated.length) return migrated;
  }

  return seedMessages;
}

function loadMemoryGroups(): MemoryGroup[] {
  const entries = storage.getMemoryEntries([]);
  if (!entries.length) return seedMemories;
  const groups = new Map<string, MemoryGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.category) ?? {
      id: `group-${entry.category}`,
      title: entry.category,
      items: [],
    };
    group.items.push({ id: entry.id, text: entry.text });
    groups.set(entry.category, group);
  }
  return Array.from(groups.values());
}

export default function PersonalShell() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");

  const [profile, setProfile] = useState<UserProfile>(() =>
    storage.getProfile(),
  );
  const [entered, setEntered] = useState(() => storage.getEntered());
  const [deepseek, setDeepseek] = useState<DeepSeekConfig>(() =>
    storage.getDeepSeekConfig(),
  );
  const [apiKey, setApiKey] = useState(() => storage.getDeepSeekKey());
  const [showKey, setShowKey] = useState(false);
  const [connState, setConnState] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [connText, setConnText] = useState("");
  const [agentName, setAgentName] = useState(
    () => storage.getAgentName() || BRAND,
  );
  const [agentAvatar, setAgentAvatar] = useState(() =>
    storage.getAgentAvatar(),
  );
  const [messages, setMessages] = useState<Message[]>(loadShellMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [today] = useState<Brief[]>(seedBriefs);
  const [readBriefs, setReadBriefs] = useState<Set<string>>(new Set());
  const [tasks, setTasks] = useState<ShellTask[]>(() =>
    storage.getStoredTasks(seedTasks.map(toStoredTask)).map((task) => ({
      id: task.id,
      title: task.text,
      detail: task.detail,
      status: task.status,
    })),
  );
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [memories, setMemories] = useState<MemoryGroup[]>(loadMemoryGroups);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [memoryQuery, setMemoryQuery] = useState("");
  const [searchMemories, setSearchMemories] = useState(false);
  const [editing, setEditing] = useState<{
    groupId: string;
    itemId: string;
    text: string;
  } | null>(null);
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsName, setSettingsName] = useState(agentName);
  const [settingsAvatar, setSettingsAvatar] = useState(agentAvatar);
  const [settingsType, setSettingsType] = useState<CompanionType>(
    profile.companionType,
  );
  const [settingsTone, setSettingsTone] = useState<CompanionTone>(profile.tone);
  const [settingsCallName, setSettingsCallName] = useState(profile.callName);
  const [settingsSchool, setSettingsSchool] = useState(profile.school);
  const [settingsMajor, setSettingsMajor] = useState(profile.major);
  const [settingsGrade, setSettingsGrade] = useState(profile.grade);
  const [settingsCourses, setSettingsCourses] = useState(profile.courses);
  const [settingsTemperature, setSettingsTemperature] = useState(
    profile.temperature,
  );
  const [settingsLength, setSettingsLength] = useState<ResponseLength>(
    profile.responseLength,
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, sending, tab]);

  useEffect(() => {
    if (!entered) return;
    storage.setStoredTasks(tasks.map(toStoredTask));
  }, [tasks, entered]);

  useEffect(() => {
    if (!entered) return;
    storage.setMemoryEntries(
      memories.flatMap((group) =>
        group.items.map((item) => ({
          id: item.id,
          category: group.title,
          text: item.text,
        })),
      ),
    );
  }, [memories, entered]);

  useEffect(() => {
    if (!entered) return;
    const timer = window.setTimeout(
      () => storage.setShellMessages(messages),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [messages, entered]);

  const addTask = (title: string, detail = "刚刚添加") => {
    if (!title.trim()) return;
    setTasks((current) => [
      {
        id: `t-${Date.now()}`,
        title: title.trim(),
        detail,
        status: "doing",
      },
      ...current,
    ]);
  };

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              status: task.status === "done" ? "doing" : "done",
              detail: task.status === "done" ? "重新开始" : "已完成",
            }
          : task,
      ),
    );
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const history = messages;
    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      time: nowTime(),
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setSending(true);
    if (composerRef.current) composerRef.current.style.height = "auto";

    if (!apiKey.trim()) {
      window.setTimeout(() => {
        const wantsTask = /任务|安排|清单|拆/.test(text);
        const reply: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          time: nowTime(),
          text: wantsTask
            ? "好，我把它拆成一个小任务，先放到右边，今天只推进第一步。"
            : "我记下了。结合你的课程和最近的记忆，我建议先把范围缩小，再决定下一步。",
          memoryRefs: ["你希望明年暑假找到第一份实习", "本周的课程与截止日期"],
          card: wantsTask
            ? {
                title: "拆出今天能完成的第一步",
                meta: "今天 · 预计 25 分钟",
                action: "加入任务",
              }
            : undefined,
        };
        setMessages((current) => [...current, reply]);
        setSending(false);
      }, 700);
      return;
    }

    const assistantId = `a-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      time: nowTime(),
      text: "",
      pending: true,
    };
    setMessages((current) => [...current, assistantMessage]);
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();
    const memoryTexts = memories.flatMap((group) =>
      group.items.map((item) => item.text),
    );
    const runtimeTasks = tasks.map((task) => ({
      text: task.title,
      done: task.status === "done",
    }));

    try {
      const result = await streamDeepSeekChat({
        config: {
          ...deepseek,
          temperature: profile.temperature,
          maxTokens: responseTokenBudget(profile.responseLength),
        },
        apiKey,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(deepseek, profile, {
              memories: memoryTexts,
              courses: [],
              tasks: runtimeTasks,
            }),
          },
          ...history
            .filter((message) => message.text?.trim() && !message.demo)
            .slice(-20)
            .map((message) => ({
              role: message.role,
              content: message.text ?? "",
            })),
          { role: "user", content: text },
        ],
        signal: controller.signal,
        onDelta: (delta) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, text: `${message.text ?? ""}${delta}` }
                : message,
            ),
          );
        },
        onReasoning: (delta) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    reasoning: `${message.reasoning ?? ""}${delta}`,
                  }
                : message,
            ),
          );
        },
      });
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                text: result.content || message.text || "（没有返回内容）",
                reasoning: result.reasoning || message.reasoning,
                usage: result.usage ?? undefined,
                latencyMs: Math.round(performance.now() - startedAt),
                pending: false,
              }
            : message,
        ),
      );
    } catch (caught) {
      const aborted = controller.signal.aborted;
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                pending: false,
                text: message.text ?? "",
                error: aborted
                  ? "已停止生成"
                  : caught instanceof DeepSeekError
                    ? caught.message
                    : "请求失败，请检查网络或 API Key。",
              }
            : message,
        ),
      );
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  };

  const stop = () => abortRef.current?.abort();

  const testConnection = async () => {
    if (!apiKey.trim()) {
      setConnState("error");
      setConnText("先填写 DeepSeek API Key。");
      return;
    }
    setConnState("testing");
    setConnText("正在请求 /models…");
    try {
      const ids = await listDeepSeekModels({
        baseUrl: deepseek.baseUrl,
        apiKey,
      });
      setConnState("ok");
      setConnText(
        ids.length
          ? `连接成功：${ids.join("、")}`
          : "连接成功，但没有返回模型。",
      );
    } catch (caught) {
      setConnState("error");
      setConnText(
        caught instanceof DeepSeekError
          ? caught.status === 401
            ? "API Key 无效或已过期（401）。"
            : caught.message
          : "连接失败，请检查网络或 Base URL。",
      );
    }
  };

  const saveConnection = () => {
    storage.setDeepSeekConfig(deepseek);
    storage.setDeepSeekKey(apiKey, storage.getDeepSeekRemember());
    setConnState(apiKey.trim() ? "ok" : "idle");
    setConnText(
      apiKey.trim()
        ? "已保存。聊天会用你的 DeepSeek Key。"
        : "未填写 Key，继续使用演示回复。",
    );
  };

  const addCardTask = (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message?.card || message.card.added) return;
    addTask(message.card.title, "来自对话");
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId && item.card
          ? { ...item, card: { ...item.card, added: true } }
          : item,
      ),
    );
  };

  const closeNewTask = () => {
    setNewTaskOpen(false);
    setNewTask("");
  };

  const openSettings = () => {
    setSettingsName(agentName);
    setSettingsAvatar(agentAvatar);
    setSettingsType(profile.companionType);
    setSettingsTone(profile.tone);
    setSettingsCallName(profile.callName);
    setSettingsSchool(profile.school);
    setSettingsMajor(profile.major);
    setSettingsGrade(profile.grade);
    setSettingsCourses(profile.courses);
    setSettingsTemperature(profile.temperature);
    setSettingsLength(profile.responseLength);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    const name = settingsName.trim() || BRAND;
    const preset =
      settingsType === "自定义" ? null : COMPANION_PRESETS[settingsType];
    const nextProfile: UserProfile = {
      ...profile,
      ...(preset ?? {}),
      callName: settingsCallName.trim(),
      school: settingsSchool.trim(),
      major: settingsMajor.trim(),
      grade: settingsGrade,
      courses: settingsCourses.trim(),
      companionType: settingsType,
      tone: settingsTone,
      temperature: settingsTemperature,
      responseLength: settingsLength,
    };
    setProfile(nextProfile);
    setAgentName(name);
    setAgentAvatar(settingsAvatar);
    storage.setProfile(nextProfile);
    storage.setAgentName(name);
    storage.setAgentAvatar(settingsAvatar);
    storage.setDeepSeekConfig(deepseek);
    storage.setDeepSeekKey(apiKey, storage.getDeepSeekRemember());
    setSettingsOpen(false);
  };

  const exportData = () => {
    try {
      const blob = new Blob([JSON.stringify(storage.exportData(), null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `waymuse-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.alert("当前环境不支持导出。");
    }
  };

  const clearAllData = () => {
    if (!window.confirm("清除本机的档案、对话、任务、记忆与 API Key？")) return;
    storage.clearAll();
    setProfile({ ...DEFAULT_PROFILE });
    setAgentName(BRAND);
    setAgentAvatar("");
    setDeepseek({ ...DEFAULT_DEEPSEEK_CONFIG });
    setApiKey("");
    setMessages(seedMessages);
    setTasks(seedTasks);
    setMemories(seedMemories);
    setReadBriefs(new Set());
    setEditing(null);
    setConnState("idle");
    setConnText("");
    setSettingsOpen(false);
    setTab("chat");
    setEntered(false);
  };

  const visibleGroups = memories
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.text.toLowerCase().includes(memoryQuery.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const commitMemoryEdit = () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) {
      setEditing(null);
      return;
    }
    setMemories((current) =>
      current.map((group) =>
        group.id === editing.groupId
          ? {
              ...group,
              items: group.items.map((item) =>
                item.id === editing.itemId ? { ...item, text } : item,
              ),
            }
          : group,
      ),
    );
    setEditing(null);
  };

  const deleteMemory = (groupId: string, itemId: string) => {
    setMemories((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: group.items.filter((item) => item.id !== itemId),
            }
          : group,
      ),
    );
  };

  const displayName = profile.callName.trim() || "同学";
  const personality = `${profile.companionType} · ${profile.tone}`;

  const renderMemoryNote = (message: Message) => {
    if (!message.memoryRefs?.length) return null;
    const open = expandedMemory === message.id;
    return (
      <div className="ps-memory-note">
        <button
          type="button"
          onClick={() => setExpandedMemory(open ? null : message.id)}
        >
          <Brain size={12} />
          已读取 {message.memoryRefs.length} 条相关记忆
          <ChevronDown
            size={12}
            className={open ? "ps-chevron open" : "ps-chevron"}
          />
        </button>
        {open && (
          <ul>
            {message.memoryRefs.map((memory) => (
              <li key={memory}>{memory}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const renderChat = () => (
    <section className="ps-chat">
      <header className="ps-chat-head">
        {isTablet ? (
          <button
            className="ps-icon-btn"
            aria-label="打开个人面板"
            onClick={() => setPanelOpen(true)}
          >
            <ListTodo size={19} />
          </button>
        ) : (
          <span className="ps-head-spacer" />
        )}
        <button
          type="button"
          className="ps-head-center"
          onClick={openSettings}
          aria-label="AI 伙伴设置"
        >
          <span className="ps-avatar">
            {agentAvatar ? (
              <img src={agentAvatar} alt="" />
            ) : (
              <Sparkles size={15} />
            )}
          </span>
          <b>{agentName}</b>
        </button>
        <button
          className="ps-icon-btn"
          aria-label="设置"
          onClick={openSettings}
        >
          <Settings2 size={19} />
        </button>
      </header>

      <div className="ps-chat-scroll" ref={scrollRef}>
        <div className="ps-thread">
          <div className="ps-date">今天 · {nowTime()}</div>
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const grouped = previous?.role === message.role;
            return (
              <div
                className={`ps-msg-row ${message.role} ${
                  grouped ? "grouped" : ""
                }`}
                key={message.id}
              >
                {renderMemoryNote(message)}
                <div className={`ps-bubble ${message.role}`}>
                  {message.role === "assistant" && message.reasoning && (
                    <details className="ps-reasoning">
                      <summary>思考过程</summary>
                      <pre>{message.reasoning}</pre>
                    </details>
                  )}
                  {message.text && <p>{message.text}</p>}
                  {!message.text && message.pending && (
                    <span className="ps-generating">正在生成…</span>
                  )}
                  {message.error && (
                    <p className="ps-msg-error">{message.error}</p>
                  )}
                  {message.card && (
                    <div className="ps-msg-card">
                      <div className="ps-msg-card-top">
                        <CheckCircle2 size={15} />
                        <b>{message.card.title}</b>
                      </div>
                      <small>{message.card.meta}</small>
                      <button
                        type="button"
                        onClick={() => addCardTask(message.id)}
                        disabled={message.card.added}
                      >
                        {message.card.added
                          ? "已加入任务"
                          : message.card.action}
                        {!message.card.added && <ChevronRight size={13} />}
                      </button>
                    </div>
                  )}
                  {(message.usage || message.latencyMs) && (
                    <div className="ps-msg-meta">
                      {message.usage && (
                        <span>{message.usage.total_tokens} tokens</span>
                      )}
                      {message.latencyMs && <span>{message.latencyMs} ms</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {sending && !messages.some((message) => message.pending) && (
            <div className="ps-msg-row assistant">
              <div className="ps-bubble assistant ps-typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ps-compose-wrap">
        {sending && (
          <div className="ps-checking">
            <span />
            {apiKey ? "正在连接 DeepSeek…" : "正在检查 Memory…"}
            {apiKey && (
              <button type="button" className="ps-stop" onClick={stop}>
                停止
              </button>
            )}
          </div>
        )}
        <div className="ps-composer">
          <button className="ps-plus" type="button" aria-label="附件">
            <Plus size={18} />
          </button>
          <textarea
            ref={composerRef}
            rows={1}
            value={draft}
            placeholder={`给 ${agentName} 发消息…`}
            onChange={(event) => setDraft(event.target.value)}
            onInput={(event) => {
              const target = event.currentTarget;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 108)}px`;
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button
            className="ps-send"
            type="button"
            aria-label="发送"
            onClick={send}
            disabled={!draft.trim() || sending}
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </section>
  );

  const renderToday = () => (
    <section className="ps-section">
      <div className="ps-section-head">
        <h2>今天</h2>
        <span>11月6日 周五</span>
      </div>
      <div className="ps-brief-list">
        {today.map((brief) => {
          const Icon = brief.icon;
          const read = readBriefs.has(brief.id);
          return (
            <article className="ps-brief" key={brief.id}>
              <span className="ps-brief-icon">
                <Icon size={15} />
              </span>
              <div>
                <b>{brief.title}</b>
                <p>{brief.summary}</p>
                <button
                  type="button"
                  onClick={() =>
                    setReadBriefs((current) => {
                      const next = new Set(current);
                      next.add(brief.id);
                      return next;
                    })
                  }
                >
                  {read ? "已处理" : brief.action}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  const renderTasks = () => (
    <section className="ps-section">
      <div className="ps-section-head">
        <h2>任务</h2>
        <button
          type="button"
          className="ps-text-btn"
          onClick={() => setNewTaskOpen((value) => !value)}
        >
          <Plus size={13} /> 新建任务
        </button>
      </div>
      {newTaskOpen && (
        <form
          className="ps-new-task"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newTask.trim()) return;
            addTask(newTask);
            setNewTask("");
            closeNewTask();
          }}
        >
          <input
            autoFocus
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            placeholder="新建一个任务…"
          />
          <button type="submit" aria-label="保存任务">
            <Check size={15} />
          </button>
        </form>
      )}
      <div className="ps-task-groups">
        {(["doing", "scheduled", "done"] as TaskStatus[]).map((status) => {
          const items = tasks.filter((task) => task.status === status);
          return (
            <div className="ps-task-group" key={status}>
              <div className="ps-task-group-head">
                <span>{taskStatusLabel[status]}</span>
                <em>{items.length}</em>
              </div>
              {items.map((task) => (
                <div className="ps-task-row" key={task.id}>
                  <button
                    type="button"
                    className={statusClass(task.status)}
                    aria-label={`切换 ${task.title} 状态`}
                    onClick={() => toggleTask(task.id)}
                  />
                  <div>
                    <b className={task.status === "done" ? "done" : ""}>
                      {task.title}
                    </b>
                    <small>{task.detail}</small>
                  </div>
                  {task.status === "doing" && (
                    <span className="ps-task-live">后台</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderMemories = () => (
    <section className="ps-section">
      <div className="ps-section-head">
        <h2>记忆</h2>
        <button
          type="button"
          className="ps-icon-btn small"
          aria-label="搜索记忆"
          onClick={() => setSearchMemories((value) => !value)}
        >
          <Search size={15} />
        </button>
      </div>
      {searchMemories && (
        <input
          className="ps-memory-search"
          value={memoryQuery}
          onChange={(event) => setMemoryQuery(event.target.value)}
          placeholder="搜索事实…"
          autoFocus
        />
      )}
      <div className="ps-memory-groups">
        {visibleGroups.map((group) => {
          const collapsed = collapsedGroups[group.id];
          return (
            <div className="ps-memory-group" key={group.id}>
              <button
                type="button"
                className="ps-memory-group-head"
                onClick={() =>
                  setCollapsedGroups((current) => ({
                    ...current,
                    [group.id]: !current[group.id],
                  }))
                }
              >
                <span>
                  {group.title}
                  <em>{group.items.length}</em>
                </span>
                <ChevronDown
                  size={14}
                  className={collapsed ? "ps-chevron" : "ps-chevron open"}
                />
              </button>
              {!collapsed &&
                group.items.map((item) => (
                  <div className="ps-memory-row" key={item.id}>
                    {editing?.itemId === item.id ? (
                      <input
                        className="ps-memory-edit"
                        value={editing.text}
                        autoFocus
                        onChange={(event) =>
                          setEditing({ ...editing, text: event.target.value })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitMemoryEdit();
                          if (event.key === "Escape") setEditing(null);
                        }}
                      />
                    ) : (
                      <span>{item.text}</span>
                    )}
                    <div className="ps-memory-actions">
                      {editing?.itemId === item.id ? (
                        <>
                          <button
                            type="button"
                            aria-label="保存"
                            onClick={commitMemoryEdit}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label="取消"
                            onClick={() => setEditing(null)}
                          >
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label="编辑记忆"
                            onClick={() =>
                              setEditing({
                                groupId: group.id,
                                itemId: item.id,
                                text: item.text,
                              })
                            }
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label="删除记忆"
                            onClick={() => deleteMemory(group.id, item.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
        {!visibleGroups.length && <p className="ps-empty">没有匹配的记忆。</p>}
      </div>
    </section>
  );

  const renderCompanion = () => (
    <section className="ps-section ps-companion-section">
      <div className="ps-section-head">
        <h2>AI 伙伴</h2>
        <span className="ps-soft-badge">已陪伴 12 天</span>
      </div>
      <div className="ps-companion">
        <span className="ps-avatar lg">
          {agentAvatar ? (
            <img src={agentAvatar} alt="" />
          ) : (
            <Sparkles size={21} />
          )}
        </span>
        <div className="ps-companion-copy">
          <b>{agentName}</b>
          <span>{personality}</span>
        </div>
        <button type="button" className="ps-text-btn" onClick={openSettings}>
          个性化
        </button>
      </div>
      <p className="ps-diary">
        “今天你两次提到实习，我把语气放轻了一点，先陪你缩小范围。”
      </p>
      <div className="ps-companion-meta">
        <span>{profile.responseLength}回复</span>
        <span>{apiKey ? "DeepSeek 已连接" : "演示模式"}</span>
        <span>
          {displayName} · {profile.grade}
        </span>
      </div>
    </section>
  );
  const renderDashboard = () => (
    <aside className="ps-dashboard">
      <div className="ps-dash-scroll">
        {renderToday()}
        {renderTasks()}
        {renderMemories()}
        {renderCompanion()}
      </div>
    </aside>
  );

  const renderMobilePage = () => {
    if (tab === "today") {
      return (
        <div className="ps-mobile-page">
          <div className="ps-mobile-scroll">{renderToday()}</div>
        </div>
      );
    }
    if (tab === "tasks") {
      return (
        <div className="ps-mobile-page">
          <div className="ps-mobile-scroll">{renderTasks()}</div>
        </div>
      );
    }
    if (tab === "memories") {
      return (
        <div className="ps-mobile-page">
          <div className="ps-mobile-scroll">{renderMemories()}</div>
        </div>
      );
    }
    return (
      <div className="ps-mobile-page">
        <header className="ps-page-head">
          <h1>我的</h1>
          <button
            type="button"
            className="ps-icon-btn"
            onClick={openSettings}
            aria-label="AI 伙伴设置"
          >
            <Settings2 size={19} />
          </button>
        </header>
        <div className="ps-mobile-scroll">
          {renderCompanion()}
          <section className="ps-section">
            <div className="ps-section-head">
              <h2>我的档案</h2>
            </div>
            <div className="ps-profile-card">
              <span className="ps-avatar lg">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" />
                ) : (
                  <UserRound size={20} />
                )}
              </span>
              <div>
                <b>{displayName}</b>
                <small>
                  {profile.school.trim() || "学校未填写"} ·{" "}
                  {profile.major.trim() || "专业未填写"} · {profile.grade}
                </small>
              </div>
            </div>
          </section>
          <section className="ps-section">
            <div className="ps-section-head">
              <h2>连接与设备</h2>
            </div>
            <div className="ps-setting-row">
              <span>连接器</span>
              <em>规划中</em>
            </div>
            <div className="ps-setting-row">
              <span>设备</span>
              <em>本机 · 浏览器</em>
            </div>
          </section>
        </div>
      </div>
    );
  };

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "today", label: "Today", icon: Sun },
    { key: "tasks", label: "Tasks", icon: ListTodo },
    { key: "memories", label: "Memories", icon: Brain },
    { key: "profile", label: "我的", icon: UserRound },
  ];

  if (!entered) {
    return (
      <div className="ps-boot">
        <Onboarding
          onFinish={(nextProfile) => {
            if (nextProfile.avatar) {
              storage.setAgentAvatar(nextProfile.avatar);
              setAgentAvatar(nextProfile.avatar);
            }
            const cleanProfile = { ...nextProfile, avatar: "" };
            storage.setProfile(cleanProfile);
            storage.setName(cleanProfile.callName);
            storage.setEntered(true);
            setProfile(cleanProfile);
            setEntered(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="ps-app">
      {isMobile ? (
        <div className="ps-mobile">
          <div className="ps-mobile-body">
            {tab === "chat" ? renderChat() : renderMobilePage()}
          </div>
          <nav className="ps-tabs" aria-label="主导航">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                key={key}
                className={tab === key ? "active" : ""}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => setTab(key)}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div className={isTablet ? "ps-shell ps-shell-tablet" : "ps-shell"}>
          {renderChat()}
          {!isTablet && renderDashboard()}
        </div>
      )}

      {isTablet && panelOpen && (
        <div className="ps-drawer-backdrop" onClick={() => setPanelOpen(false)}>
          <div
            className="ps-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="ps-icon-btn ps-drawer-close"
              aria-label="关闭个人面板"
              onClick={() => setPanelOpen(false)}
            >
              <X size={18} />
            </button>
            {renderDashboard()}
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="ps-modal-backdrop"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="ps-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ps-modal-head">
              <b>AI 伙伴设置</b>
              <button
                type="button"
                className="ps-icon-btn"
                aria-label="关闭"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="ps-modal-body">
              <AvatarPicker
                value={settingsAvatar}
                onChange={setSettingsAvatar}
              />
              <label className="ps-field">
                <span>名称</span>
                <input
                  value={settingsName}
                  onChange={(event) => setSettingsName(event.target.value)}
                  maxLength={24}
                />
              </label>

              <p className="ps-modal-section">我的档案</p>
              <label className="ps-field">
                <span>WayMuse 该怎么称呼你</span>
                <input
                  value={settingsCallName}
                  onChange={(event) => setSettingsCallName(event.target.value)}
                  maxLength={24}
                  placeholder="你的称呼"
                />
              </label>
              <label className="ps-field">
                <span>学校</span>
                <input
                  value={settingsSchool}
                  onChange={(event) => setSettingsSchool(event.target.value)}
                  maxLength={80}
                  placeholder="例如：江南大学"
                />
              </label>
              <div className="ps-field-row">
                <label className="ps-field">
                  <span>专业</span>
                  <input
                    value={settingsMajor}
                    onChange={(event) => setSettingsMajor(event.target.value)}
                    maxLength={80}
                    placeholder="例如：计算机科学"
                  />
                </label>
                <label className="ps-field">
                  <span>年级</span>
                  <select
                    value={settingsGrade}
                    onChange={(event) => setSettingsGrade(event.target.value)}
                  >
                    {GRADES.map((grade) => (
                      <option value={grade} key={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="ps-field">
                <span>主要课程</span>
                <textarea
                  rows={2}
                  value={settingsCourses}
                  onChange={(event) => setSettingsCourses(event.target.value)}
                  maxLength={600}
                  placeholder="例如：数据结构、高等数学、机器学习"
                />
              </label>

              <p className="ps-modal-section">陪伴风格</p>
              <div className="ps-field">
                <span>性格</span>
                <div className="ps-choice-grid">
                  {COMPANION_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type}
                      className={settingsType === type ? "selected" : ""}
                      onClick={() => {
                        setSettingsType(type);
                        if (type !== "自定义") {
                          const preset = COMPANION_PRESETS[type];
                          setSettingsTone(preset.tone);
                          setSettingsTemperature(preset.temperature);
                          setSettingsLength(preset.responseLength);
                        }
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <label className="ps-field">
                <span>语气</span>
                <select
                  value={settingsTone}
                  onChange={(event) =>
                    setSettingsTone(event.target.value as CompanionTone)
                  }
                >
                  {TONES.map((tone) => (
                    <option value={tone} key={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ps-field">
                <span>
                  表达温度
                  <b className="ps-field-value">
                    {settingsTemperature.toFixed(1)}
                  </b>
                </span>
                <input
                  className="ps-range"
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settingsTemperature}
                  onChange={(event) =>
                    setSettingsTemperature(Number(event.target.value))
                  }
                />
              </label>
              <div className="ps-field">
                <span>回复长度</span>
                <div className="ps-pill-row">
                  {RESPONSE_LENGTHS.map((length) => (
                    <button
                      type="button"
                      key={length}
                      className={settingsLength === length ? "selected" : ""}
                      onClick={() => setSettingsLength(length)}
                    >
                      {length}
                    </button>
                  ))}
                </div>
              </div>
              <p className="ps-modal-section">DeepSeek 连接</p>
              <div className="ps-modal-divider" />
              <div className="ps-field">
                <span>DeepSeek API Key</span>
                <div className="ps-key">
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
                    {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div className="ps-field-row">
                <label className="ps-field">
                  <span>Base URL</span>
                  <input
                    value={deepseek.baseUrl}
                    onChange={(event) =>
                      setDeepseek((current) => ({
                        ...current,
                        baseUrl: event.target.value,
                      }))
                    }
                    spellCheck={false}
                  />
                </label>
                <label className="ps-field">
                  <span>模型</span>
                  <input
                    value={deepseek.model}
                    onChange={(event) =>
                      setDeepseek((current) => ({
                        ...current,
                        model: event.target.value,
                      }))
                    }
                    spellCheck={false}
                  />
                </label>
              </div>
              <div className="ps-conn-actions">
                <button
                  type="button"
                  onClick={() => void testConnection()}
                  disabled={connState === "testing"}
                >
                  {connState === "testing" ? "测试中…" : "测试连接"}
                </button>
                <button type="button" onClick={saveConnection}>
                  保存连接
                </button>
              </div>
              {connText && (
                <p className={`ps-conn-note ${connState}`} role="status">
                  {connText}
                </p>
              )}
              <p className="ps-modal-hint">
                不填 Key 时使用本地演示回复；Key 默认只存本次会话。
              </p>
              <p className="ps-modal-section">数据</p>
              <div className="ps-data-actions">
                <button type="button" onClick={exportData}>
                  导出 JSON
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void clearAllData()}
                >
                  清除全部数据
                </button>
              </div>
              <p className="ps-modal-section">隐私</p>
              <p className="ps-privacy-note">
                档案、头像、任务、记忆和对话只保存在本机。只有你配置 DeepSeek
                Key 并发送消息时，对话和你带入的档案/记忆/任务才会发往
                api.deepseek.com。清除全部数据会删除本机内容。
              </p>
            </div>
            <div className="ps-modal-actions">
              <button
                type="button"
                className="ps-btn"
                onClick={() => setSettingsOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="ps-btn primary"
                onClick={saveSettings}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
