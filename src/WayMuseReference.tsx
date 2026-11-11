import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { BRAND } from "./brand";
import { newId } from "./id";
import Onboarding from "./Onboarding";
import { haptic, readCalendarEvents } from "./nativeExtras";
import type { CalendarEvent } from "./nativeExtras";
import { subscribeChrome, useHideNativeChrome } from "./chrome";
import { installGlobalHaptics } from "./haptics";
import {
  endLiveActivity,
  startLiveActivity,
  updateLiveActivity,
} from "./liveActivity";
import { dueLabel, nextDueTask } from "./upnext";
import { syncTaskReminders } from "./reminders";
import { useKeyboardInset } from "./useKeyboardInset";
import ChatPage from "./pages/ChatPage";
import Dock from "./pages/Dock";
import MemoryPage from "./pages/MemoryPage";
import OverlaySheet from "./pages/OverlaySheet";
import PersonaPage from "./pages/PersonaPage";
import PrivacyPage from "./pages/PrivacyPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import TaskPage from "./pages/TaskPage";
import CourseImportSheet from "./pages/CourseImportSheet";
import TodayPage from "./pages/TodayPage";
import { DEFAULT_PROFILE } from "./profile";
import type { UserProfile } from "./profile";
import { storage, createMemory } from "./storage";
import { backupFileName, createBackup, restoreBackup } from "./backup";
import { useAccount } from "./useAccount";
import { refreshInsights } from "./nativeInsights";
import { academicWeek, isCourseInWeek, readTermStart } from "./term";
import type { Assignment, Exam } from "./semester";
import type { Course, Memory, Overlay, Page, Task } from "./types";
import { useNativeTabs } from "./useNativeTabs";

const seedTasks: Task[] = [];
const oldSeedMemories = new Set([
  "大二，计算机相关专业",
  "希望明年暑假找到第一份实习",
  "对产品和数据分析方向感兴趣",
]);

// 今天和课程筛选统一使用 Asia/Shanghai，避免跨时区或跨午夜时日期与星期不一致。
function getShanghaiWeekday(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(value("year"), value("month") - 1, value("day")),
  ).getUTCDay();
}

export default function WayMuseReference() {
  // 键盘弹起时把被遮挡的高度写进 --kb-inset，弹层才能躲开键盘。
  useKeyboardInset();
  const [page, setPage] = useState<Page>("聊天");
  const [overlay, setOverlay] = useState<Overlay>("");
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [courseImportOpen, setCourseImportOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // 登录页是铺满屏幕的浮层：原生 Tab 栏盖在 WebView 之上，必须让它让位
  useHideNativeChrome(loginOpen);
  // 图片走视觉模型：选完直接发，先落到这里
  const [pendingImage, setPendingImage] = useState<{
    id: number;
    dataUrl: string;
  } | null>(null);
  const account = useAccount();
  // 导入层是我们自己的全屏 sheet，但原生输入框会浮在它上面：打开时一并隐藏
  useHideNativeChrome(courseImportOpen);
  const [taskMode, setTaskMode] = useState<"任务" | "课表">("任务");
  const [tasks, setTasks] = useState<Task[]>(() =>
    storage.getTasks(seedTasks).filter((task) => !task.id.startsWith("seed-")),
  );
  const [memories, setMemories] = useState<Memory[]>(() =>
    storage.getMemories().filter((memory) => !oldSeedMemories.has(memory.text)),
  );
  const [draft, setDraft] = useState("");
  const [pendingChat, setPendingChat] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const [profile, setProfile] = useState<UserProfile>(() =>
    storage.getProfile(),
  );
  const profileName = profile.callName.trim() || "同学";
  const [showTip, setShowTip] = useState(true);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [courses, setCourses] = useState<Course[]>(storage.getCourses);
  // 学期结构化数据：作业与考试
  const [assignments, setAssignments] = useState<Assignment[]>(
    storage.getAssignments,
  );
  const [exams, setExams] = useState<Exam[]>(storage.getExams);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [hasEntered, setHasEntered] = useState(storage.getEntered);
  const [agentName, setAgentName] = useState(
    () => storage.getAgentName() || BRAND,
  );
  const [agentAvatar, setAgentAvatar] = useState(
    () => storage.getAgentAvatar() || storage.getProfile().avatar,
  );

  useEffect(() => {
    if (!profile.avatar) return;
    storage.setAgentAvatar(profile.avatar);
    setAgentAvatar(profile.avatar);
    setProfile((current) => ({ ...current, avatar: "" }));
  }, [profile.avatar]);

  useEffect(() => {
    document.title = `${BRAND} · 学业助理`;
    // 启动时读一次本机状态（屏幕时间/步数）；没授权会自动跳过
    void refreshInsights();
  }, []);

  /**
   * 服务端资料 → 本地画像的单向补齐。
   *
   * 只有本地为空时才填，不覆盖用户手填的内容；
   * 否则「我的信息」里改了学校，聊天里的 system prompt 还是「学校未填写」。
   */
  useEffect(() => {
    const remote = account.me?.profile;
    if (!remote) return;
    setProfile((current) => {
      const patch: Partial<UserProfile> = {};
      if (!current.school.trim() && remote.school) patch.school = remote.school;
      if (!current.major.trim() && remote.major) patch.major = remote.major;
      if (!current.grade.trim() && remote.grade) patch.grade = remote.grade;
      if (Object.keys(patch).length === 0) return current;
      return { ...current, ...patch };
    });
  }, [account.me?.profile]);
  useEffect(() => {
    if (!hasEntered) return;
    storage.setCourses(courses);
  }, [courses, hasEntered]);
  useEffect(() => {
    if (!hasEntered) return;
    storage.setMemories(memories);
  }, [memories, hasEntered]);
  useEffect(() => {
    if (!hasEntered) return;
    storage.setTasks(tasks);
  }, [tasks, hasEntered]);
  useEffect(() => {
    if (!hasEntered) return;
    storage.setAssignments(assignments);
  }, [assignments, hasEntered]);
  useEffect(() => {
    if (!hasEntered) return;
    storage.setExams(exams);
  }, [exams, hasEntered]);
  useEffect(() => {
    if (!hasEntered) return;
    storage.setProfile(profile);
  }, [profile, hasEntered]);

  useEffect(() => {
    if (page !== "Today") return;
    let alive = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    void readCalendarEvents(start.toISOString(), end.toISOString()).then(
      (events) => {
        if (alive) setCalendarEvents(events);
      },
    );
    return () => {
      alive = false;
    };
  }, [page]);

  // 任何网页浮层打开时，让原生 Tab 栏与输入框让位
  useEffect(() => subscribeChrome(setChromeHidden), []);

  // 全局触觉反馈：任何按钮按下都给一下轻震
  useEffect(() => {
    installGlobalHaptics();
  }, []);

  // ── 计划上岛 ─────────────────────────────────────
  // 只把「最近的一件、有时间点、还没做完」的任务放上灵动岛；
  // 岛上一个时间只能显示一个活动，所以这里自己也保证只维护一个。
  useEffect(() => {
    let activeKey = "";

    const sync = () => {
      const next = nextDueTask(tasks);
      if (!next) {
        if (activeKey) {
          activeKey = "";
          void endLiveActivity("task");
        }
        return;
      }
      const key = `${next.task.id}@${next.dueAt.toISOString()}`;
      const detail = dueLabel(next);
      const iso = next.dueAt.toISOString();
      if (key === activeKey) {
        void updateLiveActivity("task", next.task.text, detail, iso);
        return;
      }
      activeKey = key;
      void startLiveActivity("task", next.task.text, detail, iso);
    };

    sync();
    const timer = window.setInterval(sync, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tasks]);

  // 本地通知：App 不运行时也要能提醒。和上岛共用同一份任务数据，
  // 但走的是两条独立通道（通知是系统调度，岛是前台/后台的实时显示）。
  useEffect(() => {
    void syncTaskReminders(tasks);
  }, [tasks]);

  const todayWeekday = getShanghaiWeekday();
  // 单双周 / 1-16 周这类课，只有「本周要上」的才出现在今天
  const termWeek = academicWeek(readTermStart());
  const todayCourses = courses
    .filter(
      (course) =>
        course.weekday === todayWeekday && isCourseInWeek(course, termWeek),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const date = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Shanghai",
  }).format(new Date());

  const submit = () => {
    if (!draft.trim()) return;
    // 原生输入框的发送键直接走这里，所以触觉反馈要加在这一层，
    // 否则从原生输入框发消息就完全没有震动。
    void haptic("light");
    if (overlay === "新增任务") {
      setTasks([{ id: newId(), text: draft.trim(), done: false }, ...tasks]);
      setOverlay("");
    } else if (overlay === "添加记忆") {
      setMemories([createMemory(draft.trim()), ...memories]);
      setOverlay("");
    } else {
      setPendingChat({ id: Date.now(), text: draft.trim() });
      setPage("聊天");
    }
    setDraft("");
  };
  const nav = (next: Page) => {
    setPage(next);
    setOverlay("");
    setAttachmentMenu(false);
  };

  // Android（含小米澎湃 HyperOS）：系统返回键/返回手势不能直接把 App 杀掉。
  // 语义：关浮层 → 回聊天页 → 再按一次才退出。
  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() ||
      Capacitor.getPlatform() !== "android"
    ) {
      return;
    }
    let listener: { remove: () => Promise<void> } | undefined;
    let disposed = false;
    void App.addListener("backButton", () => {
      if (overlay) {
        setOverlay("");
        return;
      }
      if (page !== "聊天") {
        setPage("聊天");
        return;
      }
      void App.minimizeApp();
    })
      .then((handle) => {
        if (disposed) void handle.remove();
        else listener = handle;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [overlay, page]);
  // 原生 Liquid Glass Tab 栏：iOS 上由 LiquidGlassPlugin 接管，
  // 其它环境自动回落到 Web Tab 栏（hook 内部判断平台）。
  const nativeTabsActive = useNativeTabs(
    page,
    hasEntered,
    chromeHidden ? "通话" : overlay,
    nav,
  );
  const exportDemoData = () => {
    try {
      // 导出全部键值快照（默认不含 API Key，避免备份文件被转发时泄露）
      const backup = createBackup({ includeSecrets: false });
      const payload = JSON.stringify(backup, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.alert("当前环境不支持导出，请稍后重试。");
    }
  };

  const importDemoData = async (file: File, mode: "merge" | "replace") => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const result = restoreBackup(parsed, mode);
      window.alert(result.message);
      // 导入直接改 localStorage，重载一次让所有模块读到新值
      if (result.ok) window.location.reload();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `文件读取失败：${error.message.slice(0, 80)}`
          : "文件读取失败",
      );
    }
  };
  const clearDemoData = () => {
    storage.clearAll();
    setCourses([]);
    setMemories([]);
    setTasks([]);
    setPendingChat(null);
    setDraft("");
    setProfile({ ...DEFAULT_PROFILE });
    setTaskMode("任务");
    setShowTip(true);
    setPage("Today");
    setAttachmentMenu(false);
    setOverlay("");
    setHasEntered(false);
  };

  if (!hasEntered) {
    return (
      <div className="wr-page">
        <div className="wr-phone">
          <Onboarding
            onFinish={(nextProfile) => {
              const nextAvatar = nextProfile.avatar;
              if (nextAvatar) {
                storage.setAgentAvatar(nextAvatar);
                setAgentAvatar(nextAvatar);
              }
              const cleanProfile = { ...nextProfile, avatar: "" };
              setProfile(cleanProfile);
              storage.setProfile(cleanProfile);
              storage.setName(cleanProfile.callName);
              storage.setAgentName(storage.getAgentName() || BRAND);
              storage.setEntered(true);
              setHasEntered(true);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="wr-page">
      <div className="wr-phone" data-dock="shown">
        {/* 聊天页有自己的导航条；其它页用这条渐隐带，让上滚内容在状态栏处淡出，
            而不是硬切一刀。 */}
        {page !== "聊天" && <div className="wr-topfade" aria-hidden="true" />}
        <main
          key={page}
          className={`wr-content ${page === "聊天" ? "wr-content-chat" : ""}`}
        >
          {page === "Today" && (
            <TodayPage
              profileName={profileName}
              date={date}
              tasks={tasks}
              todayCourses={todayCourses}
              calendarEvents={calendarEvents}
              assignments={assignments}
              exams={exams}
              courses={courses}
              setCourses={setCourses}
              setOverlay={setOverlay}
              onImportCourses={() => setCourseImportOpen(true)}
              nav={nav}
            />
          )}
          {page === "任务" && (
            <TaskPage
              taskMode={taskMode}
              setTaskMode={setTaskMode}
              tasks={tasks}
              setTasks={setTasks}
              courses={courses}
              setCourses={setCourses}
              assignments={assignments}
              setAssignments={setAssignments}
              exams={exams}
              setExams={setExams}
              setOverlay={setOverlay}
            />
          )}
          {page === "记忆" && (
            <MemoryPage
              showTip={showTip}
              setShowTip={setShowTip}
              memories={memories}
              setMemories={setMemories}
              nav={nav}
              setOverlay={setOverlay}
            />
          )}
          {page === "聊天" && (
            <ChatPage
              key={overlay}
              agentName={agentName}
              agentAvatar={agentAvatar}
              pendingMessage={pendingChat}
              pendingImage={pendingImage}
              onPendingConsumed={() => setPendingChat(null)}
              onPendingImageConsumed={() => setPendingImage(null)}
              profile={profile}
              memories={memories}
              courses={courses}
              tasks={tasks}
              onSettings={() => setOverlay("设置")}
              onTasksChange={setTasks}
              assignments={assignments}
              onAssignmentsChange={setAssignments}
              exams={exams}
              onExamsChange={setExams}
              onMemoriesChange={setMemories}
              onCoursesChange={setCourses}
              onViewPlans={() => nav("任务")}
            />
          )}
          {page === "角色" && (
            <PersonaPage
              profile={profile}
              agentName={agentName}
              agentAvatar={agentAvatar}
              setOverlay={setOverlay}
              nav={nav}
            />
          )}
        </main>
        <Dock
          nativeTabsActive={nativeTabsActive}
          attachmentMenu={attachmentMenu}
          setAttachmentMenu={setAttachmentMenu}
          draft={draft}
          setDraft={setDraft}
          overlay={chromeHidden ? "通话" : overlay}
          submit={submit}
          onImage={(dataUrl) => {
            setPendingImage({ id: Date.now(), dataUrl });
            setPage("聊天");
          }}
          onAttach={(payload) => {
            setPendingChat({ id: Date.now(), text: payload });
            setPage("聊天");
          }}
          page={page}
          nav={nav}
          agentName={agentName}
          agentAvatar={agentAvatar}
        />
        {overlay === "设置" && (
          <SettingsPage
            profile={profile}
            onProfileChange={setProfile}
            agentName={agentName}
            onAgentNameChange={(value) => {
              setAgentName(value);
              storage.setAgentName(value);
            }}
            agentAvatar={agentAvatar}
            onAgentAvatarChange={(value) => {
              setAgentAvatar(value);
              storage.setAgentAvatar(value);
            }}
            setOverlay={setOverlay}
            nav={nav}
            setHasEntered={setHasEntered}
            onExport={exportDemoData}
            onImport={(file, mode) => void importDemoData(file, mode)}
            account={account}
            onLogin={() => setLoginOpen(true)}
          />
        )}
        {overlay === "隐私与数据" && (
          <PrivacyPage onClose={() => setOverlay("设置")} />
        )}
        {loginOpen && (
          <div className="wr-login-overlay">
            <LoginPage
              onClose={() => setLoginOpen(false)}
              onLogin={() => {
                setLoginOpen(false);
                void account.reload();
              }}
            />
          </div>
        )}
        {courseImportOpen && (
          <CourseImportSheet
            existing={courses}
            onClose={() => setCourseImportOpen(false)}
            onSave={(list) => setCourses((current) => [...current, ...list])}
            onOpenSettings={() => {
              setCourseImportOpen(false);
              setOverlay("设置");
            }}
          />
        )}
        {overlay && overlay !== "设置" && overlay !== "隐私与数据" && (
          <OverlaySheet
            overlay={overlay}
            setOverlay={setOverlay}
            draft={draft}
            setDraft={setDraft}
            submit={submit}
            onClearData={clearDemoData}
          />
        )}
      </div>
    </div>
  );
}
