import { useEffect, useState } from "react";
import { BRAND } from "./brand";
import { newId } from "./id";
import Onboarding from "./Onboarding";
import { useKeyboardInset } from "./useKeyboardInset";
import WayMuseIntake from "./WayMuseIntake";
import ChatPage from "./pages/ChatPage";
import Dock from "./pages/Dock";
import MemoryPage from "./pages/MemoryPage";
import OverlaySheet from "./pages/OverlaySheet";
import PersonaPage from "./pages/PersonaPage";
import PrivacyPage from "./pages/PrivacyPage";
import SettingsPage from "./pages/SettingsPage";
import TaskPage from "./pages/TaskPage";
import TodayPage from "./pages/TodayPage";
import { DEFAULT_PROFILE } from "./profile";
import type { UserProfile } from "./profile";
import { storage, createMemory } from "./storage";
import type { Course, Kind, Memory, Overlay, Page, Task } from "./types";
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
  const [intakeKind, setIntakeKind] = useState<Kind>("课表");
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
  const [courses, setCourses] = useState<Course[]>(storage.getCourses);
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
    document.title = `${BRAND} · 你的大学生活 AI 助理`;
  }, []);
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
    storage.setProfile(profile);
  }, [profile, hasEntered]);

  const todayWeekday = getShanghaiWeekday();
  const todayCourses = courses
    .filter((course) => course.weekday === todayWeekday)
    .sort((a, b) => a.start.localeCompare(b.start));
  const date = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Shanghai",
  }).format(new Date());

  const submit = () => {
    if (!draft.trim()) return;
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
  // 原生 Liquid Glass Tab 栏：iOS 上由 LiquidGlassPlugin 接管，
  // 其它环境自动回落到 Web Tab 栏（hook 内部判断平台）。
  const nativeTabsActive = useNativeTabs(page, hasEntered, overlay, nav);
  const openIntake = (kind: Kind) => {
    setIntakeKind(kind);
    setAttachmentMenu(false);
    setOverlay("资料导入");
  };
  const exportDemoData = () => {
    try {
      const payload = JSON.stringify(storage.exportData(), null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `waymuse-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.alert("当前环境不支持导出，请稍后重试。");
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
    setIntakeKind("课表");
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
      <div className="wr-phone">
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
              memories={memories}
              tasks={tasks}
              todayCourses={todayCourses}
              courses={courses}
              setCourses={setCourses}
              setOverlay={setOverlay}
              openIntake={openIntake}
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
              setOverlay={setOverlay}
            />
          )}
          {page === "记忆" && (
            <MemoryPage
              showTip={showTip}
              setShowTip={setShowTip}
              memories={memories}
              setMemories={setMemories}
              profile={profile}
              profileName={profileName}
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
              onPendingConsumed={() => setPendingChat(null)}
              profile={profile}
              memories={memories}
              courses={courses}
              tasks={tasks}
              onSettings={() => setOverlay("设置")}
              onTasksChange={setTasks}
              onMemoriesChange={setMemories}
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
          overlay={overlay}
          submit={submit}
          openIntake={openIntake}
          page={page}
          nav={nav}
          agentName={agentName}
          agentAvatar={agentAvatar}
        />
        {overlay === "资料导入" && (
          <WayMuseIntake
            key={intakeKind}
            initialKind={intakeKind}
            onClose={() => setOverlay("")}
            onSaveCourse={(course) => setCourses([...courses, course])}
            onSaveNote={(note) =>
              setMemories([createMemory(note), ...memories])
            }
          />
        )}
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
          />
        )}
        {overlay === "隐私与数据" && (
          <PrivacyPage onClose={() => setOverlay("设置")} />
        )}
        {overlay &&
          overlay !== "设置" &&
          overlay !== "资料导入" &&
          overlay !== "隐私与数据" && (
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
