import { useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import ConnectionsPanel from "./ConnectionsPanel";
import BotAvatar from "../BotAvatar";
import AvatarPicker from "../AvatarPicker";
import { haptic } from "../nativeExtras";
import { storage } from "../storage";
import { APP_VERSION } from "../version";
import { DeepSeekError, listDeepSeekModels } from "../deepseek/client";
import type { DeepSeekConfig } from "../deepseek/types";
import {
  COMPANION_PRESETS,
  COMPANION_TYPES,
  GRADES,
  RESPONSE_LENGTHS,
  TONES,
} from "../profile";
import type { CompanionType, UserProfile } from "../profile";
import type { Dispatch, SetStateAction } from "react";
import type { Overlay, Page } from "../types";

export default function SettingsPage({
  profile,
  onProfileChange,
  agentName,
  onAgentNameChange,
  agentAvatar,
  onAgentAvatarChange,
  setOverlay,
  nav,
  setHasEntered,
  onExport,
  onImport,
}: {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  agentName: string;
  onAgentNameChange: (name: string) => void;
  agentAvatar: string;
  onAgentAvatarChange: (value: string) => void;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
  nav: (page: Page) => void;
  setHasEntered: Dispatch<SetStateAction<boolean>>;
  onExport: () => void;
  onImport: (file: File, mode: "merge" | "replace") => void;
}) {
  const [apiKey, setApiKey] = useState(() => storage.getDeepSeekKey());
  const [rememberKey, setRememberKey] = useState(() =>
    storage.getDeepSeekRemember(),
  );
  const [showKey, setShowKey] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [deepSeek, setDeepSeek] = useState<DeepSeekConfig>(() =>
    storage.getDeepSeekConfig(),
  );
  const [deepSeekStatus, setDeepSeekStatus] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [deepSeekMessage, setDeepSeekMessage] = useState("");

  /* ── 联网搜索 ── */
  const [searchProvider, setSearchProvider] = useState(() =>
    storage.getSearchProvider(),
  );
  const [searchKey, setSearchKey] = useState(() => storage.getSearchKey());
  const [searchOn, setSearchOn] = useState(() => storage.getSearchEnabled());
  const safeTop = (() => {
    if (typeof window === "undefined") return 0;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--safe-top")
      .trim();
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? Math.round(value) : 0;
  })();

  const updateProfile = <K extends keyof UserProfile>(
    key: K,
    value: UserProfile[K],
  ) => onProfileChange({ ...profile, [key]: value });

  const chooseCompanion = (type: CompanionType) => {
    if (type === "自定义") {
      onProfileChange({ ...profile, companionType: type });
      return;
    }
    onProfileChange({
      ...profile,
      companionType: type,
      ...COMPANION_PRESETS[type],
    });
  };

  const updateDeepSeek = <K extends keyof DeepSeekConfig>(
    key: K,
    value: DeepSeekConfig[K],
  ) => setDeepSeek((current) => ({ ...current, [key]: value }));

  const deepSeekErrorText = (caught: unknown): string => {
    if (caught instanceof DeepSeekError) {
      if (caught.status === 401) return "API Key 无效或已过期（401）。";
      if (caught.status === 402) return "账户余额不足（402）。";
      if (caught.status === 429) return "请求过于频繁（429）。";
      return caught.message;
    }
    return "连接失败，请检查网络、Base URL 或 Key。";
  };

  const testDeepSeek = async () => {
    if (!apiKey.trim()) {
      setDeepSeekStatus("error");
      setDeepSeekMessage("先填写 API Key。");
      return;
    }
    setDeepSeekStatus("testing");
    setDeepSeekMessage("正在请求 /models…");
    try {
      const ids = await listDeepSeekModels({
        baseUrl: deepSeek.baseUrl,
        apiKey,
      });
      setDeepSeekStatus("ok");
      setDeepSeekMessage(
        ids.length
          ? `连接成功：${ids.join("、")}`
          : "连接成功，但没有返回模型。",
      );
    } catch (caught) {
      setDeepSeekStatus("error");
      setDeepSeekMessage(deepSeekErrorText(caught));
    }
  };

  const saveDeepSeek = () => {
    storage.setDeepSeekConfig(deepSeek);
    storage.setDeepSeekKey(apiKey, rememberKey);
    setDeepSeekStatus("ok");
    setDeepSeekMessage(
      apiKey.trim() ? "已保存，聊天页会使用这个 Key。" : "已保存；Key 为空。",
    );
  };

  const clearDeepSeekKey = () => {
    storage.setDeepSeekKey("", false);
    setApiKey("");
    setRememberKey(false);
    setDeepSeekStatus("idle");
    setDeepSeekMessage("已清除本机保存的 API Key。");
  };

  const displayName = profile.callName.trim() || "同学";

  return (
    <div
      className="wr-settings-page"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
    >
      <div className="wr-settings-top">
        <button
          className="wr-round"
          aria-label="返回"
          onClick={() => setOverlay("")}
        >
          <ArrowLeft />
        </button>
        <h1>设置</h1>
        <span />
      </div>
      <div className="wr-settings-scroll">
        <nav className="wr-settings-jump" aria-label="设置分区">
          {[
            "个人档案",
            "陪伴风格",
            "模型连接",
            "语音",
            "App 连接",
            "隐私与数据",
          ].map((name) => (
            <button
              key={name}
              onClick={() =>
                document
                  .getElementById(`setting-${name}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {name}
            </button>
          ))}
        </nav>
        <div className="wr-settings-profile">
          <div className="wr-settings-profile-head">
            <div className="wr-settings-avatar">
              <BotAvatar source={agentAvatar} />
            </div>
            <div>
              <div className="wr-settings-brand">{agentName}</div>
              <div className="wr-settings-name">
                {displayName}
                <span>{profile.companionType}</span>
              </div>
            </div>
          </div>
          <p>
            {profile.school.trim() || "学校未填写"} ·{" "}
            {profile.major.trim() || "专业未填写"} · {profile.grade}
          </p>
        </div>

        <div className="wr-settings-label">助理名字与头像</div>
        <div className="wr-settings-group">
          <label className="wr-settings-field">
            <span>助理名字</span>
            <input
              value={agentName}
              maxLength={24}
              onChange={(e) => onAgentNameChange(e.target.value)}
              placeholder="WayMuse"
            />
          </label>
        </div>
        <div className="wr-settings-group">
          <div className="wr-settings-avatar-row">
            <AvatarPicker value={agentAvatar} onChange={onAgentAvatarChange} />
          </div>
        </div>

        <div className="wr-settings-label" id="setting-个人档案">
          个人档案
        </div>
        <div className="wr-settings-group">
          <label className="wr-settings-field">
            <span>WayMuse 该怎么称呼你</span>
            <input
              value={profile.callName}
              onChange={(event) =>
                updateProfile("callName", event.target.value)
              }
              placeholder="你的称呼"
              maxLength={24}
            />
          </label>
          <label className="wr-settings-field">
            <span>学校</span>
            <input
              value={profile.school}
              onChange={(event) => updateProfile("school", event.target.value)}
              placeholder="例如：江南大学"
              maxLength={80}
            />
          </label>
          <label className="wr-settings-field">
            <span>专业</span>
            <input
              value={profile.major}
              onChange={(event) => updateProfile("major", event.target.value)}
              placeholder="例如：计算机科学"
              maxLength={80}
            />
          </label>
          <label className="wr-settings-field">
            <span>年级</span>
            <select
              value={profile.grade}
              onChange={(event) => updateProfile("grade", event.target.value)}
            >
              {GRADES.map((grade) => (
                <option value={grade} key={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </label>
          <label className="wr-settings-field">
            <span>主要课程</span>
            <textarea
              rows={3}
              value={profile.courses}
              onChange={(event) => updateProfile("courses", event.target.value)}
              placeholder="例如：高等数学、数据结构、宏观经济学"
              maxLength={600}
            />
          </label>
        </div>

        <div className="wr-settings-label" id="setting-陪伴风格">
          陪伴风格
        </div>
        <div className="wr-settings-group">
          <div className="wr-settings-choice-grid">
            {COMPANION_TYPES.map((type) => (
              <button
                type="button"
                key={type}
                className={
                  profile.companionType === type
                    ? "wr-settings-choice selected"
                    : "wr-settings-choice"
                }
                onClick={() => chooseCompanion(type)}
              >
                {type}
              </button>
            ))}
          </div>
          <label className="wr-settings-field">
            <span>语气</span>
            <select
              value={profile.tone}
              onChange={(event) =>
                updateProfile("tone", event.target.value as UserProfile["tone"])
              }
            >
              {TONES.map((tone) => (
                <option value={tone} key={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </label>
          <label className="wr-settings-field">
            <span>
              表达温度{" "}
              <b className="wr-settings-value">
                {profile.temperature.toFixed(1)}
              </b>
            </span>
            <input
              className="wr-settings-range"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={profile.temperature}
              onChange={(event) =>
                updateProfile("temperature", Number(event.target.value))
              }
            />
          </label>
          <div className="wr-settings-field">
            <span>回复长度</span>
            <div className="wr-settings-segment">
              {RESPONSE_LENGTHS.map((length) => (
                <button
                  type="button"
                  key={length}
                  className={
                    profile.responseLength === length ? "selected" : ""
                  }
                  onClick={() => updateProfile("responseLength", length)}
                >
                  {length}
                </button>
              ))}
            </div>
          </div>
          <label className="wr-settings-field">
            <span>自定义助理人格</span>
            <textarea
              rows={5}
              value={profile.persona}
              onChange={(event) => updateProfile("persona", event.target.value)}
              placeholder="例如：像耐心的学长一样交流，先听我说完，再帮我整理下一步。"
              maxLength={1500}
            />
          </label>
        </div>

        <div className="wr-settings-label" id="setting-模型连接">
          模型连接
        </div>
        <div className="wr-settings-group">
          <div className="wr-settings-row">
            <span>DeepSeek</span>
            <b
              className={
                deepSeekStatus === "error"
                  ? "wr-settings-status error"
                  : apiKey
                    ? "wr-settings-status ok"
                    : "wr-settings-status"
              }
            >
              {deepSeekStatus === "testing"
                ? "测试中"
                : deepSeekStatus === "error"
                  ? "连接失败"
                  : apiKey
                    ? "已配置"
                    : "未配置"}
            </b>
          </div>
          <label className="wr-settings-field">
            <span>API Key</span>
            <div className="wr-settings-key">
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
          </label>
          <label className="wr-settings-check">
            <input
              type="checkbox"
              checked={rememberKey}
              onChange={(event) => setRememberKey(event.target.checked)}
            />
            记住密钥（写入本机 localStorage）
          </label>
          <label className="wr-settings-field">
            <span>Base URL</span>
            <input
              value={deepSeek.baseUrl}
              onChange={(event) =>
                updateDeepSeek("baseUrl", event.target.value)
              }
              placeholder="https://api.deepseek.com"
              spellCheck={false}
            />
          </label>
          <label className="wr-settings-field">
            <span>模型</span>
            <input
              value={deepSeek.model}
              onChange={(event) => updateDeepSeek("model", event.target.value)}
              placeholder="deepseek-flash"
              spellCheck={false}
            />
          </label>
          <div className="wr-settings-actions">
            <button
              type="button"
              className="wr-settings-action primary"
              onClick={() => void testDeepSeek()}
              disabled={deepSeekStatus === "testing"}
            >
              {deepSeekStatus === "testing" ? "测试中…" : "测试连接"}
            </button>
            <button
              type="button"
              className="wr-settings-action"
              onClick={saveDeepSeek}
            >
              保存
            </button>
          </div>
          <button
            type="button"
            className="wr-settings-clear"
            onClick={clearDeepSeekKey}
          >
            清除本机密钥
          </button>
          {deepSeekMessage && (
            <p
              className={`wr-settings-connect-note ${deepSeekStatus}`}
              role={deepSeekStatus === "error" ? "alert" : "status"}
            >
              {deepSeekMessage}
            </p>
          )}
          <label className="wr-settings-check">
            <input
              type="checkbox"
              checked={deepSeek.useContext}
              onChange={(e) => updateDeepSeek("useContext", e.target.checked)}
            />
            聊天读取本机计划、课程和记忆
          </label>
          <label className="wr-settings-check">
            <input
              type="checkbox"
              checked={deepSeek.thinking}
              onChange={(e) => updateDeepSeek("thinking", e.target.checked)}
            />
            深度思考（回复更慢）
          </label>
        </div>

        <div className="wr-settings-label" id="setting-联网搜索">
          联网搜索
        </div>
        <div className="wr-settings-group">
          <label className="wr-settings-field">
            <span>
              服务商
              <small>不填 key 也能联网；填了质量更好</small>
            </span>
            <select
              value={searchProvider}
              onChange={(event) => {
                setSearchProvider(event.target.value);
                storage.setSearchProvider(event.target.value);
              }}
            >
              <option value="serper">Serper · Google 结果</option>
              <option value="tavily">Tavily · 带网页摘要</option>
            </select>
          </label>
          <label className="wr-settings-field">
            <span>
              搜索 API Key（可选）
              <small>
                serper.dev 每月 2500 次免费 · tavily.com 每月 1000 次免费
              </small>
            </span>
            <input
              type="password"
              value={searchKey}
              placeholder={
                searchProvider === "tavily" ? "tvly-…" : "粘贴 Serper key"
              }
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setSearchKey(event.target.value);
                storage.setSearchKey(event.target.value);
              }}
            />
          </label>
          <label className="wr-settings-check">
            <input
              type="checkbox"
              checked={searchOn}
              onChange={(event) => {
                setSearchOn(event.target.checked);
                storage.setSearchEnabled(event.target.checked);
              }}
            />
            聊天时默认联网（每次提问多一次搜索请求）
          </label>
          <p className="wr-settings-note">
            不填 key 也能联网：默认走 DuckDuckGo 和维基百科的免费接口，
            不需要注册。想要更完整的网页结果再填上面的 key。
          </p>
        </div>

        <div className="wr-settings-label" id="setting-触感">
          触感
        </div>
        <div className="wr-settings-group">
          <button
            type="button"
            className="wr-settings-test"
            onClick={() => void haptic("medium")}
          >
            试一下震动
          </button>
          <p className="wr-settings-note">
            没反应的话，先检查系统是否开了「低电量模式」。
            <br />
            顶部安全区：{safeTop}px
          </p>
        </div>

        <div className="wr-settings-label" id="setting-App 连接">
          App 连接
        </div>
        <div className="wr-settings-group">
          <ConnectionsPanel />
        </div>
        <div className="wr-settings-label">通用</div>
        <div className="wr-settings-group">
          <button
            className="wr-settings-row"
            onClick={() => {
              setOverlay("");
              nav("记忆");
            }}
          >
            <span>管理记忆</span>
            <ChevronRight />
          </button>
        </div>

        <div className="wr-settings-label" id="setting-隐私与数据">
          隐私与数据
        </div>
        <div className="wr-settings-group">
          <button
            className="wr-settings-row"
            onClick={() => setOverlay("隐私与数据")}
          >
            <span>隐私说明</span>
            <ChevronRight />
          </button>
          <button className="wr-settings-row" onClick={onExport}>
            <span>导出备份文件</span>
            <ChevronRight />
          </button>
          <button
            className="wr-settings-row"
            onClick={() => importInputRef.current?.click()}
          >
            <span>
              从备份恢复
              <em className="wr-settings-sub">
                {importMode === "merge" ? "合并（推荐）" : "覆盖"}
              </em>
            </span>
            <ChevronRight />
          </button>
          <button
            className="wr-settings-row"
            onClick={() =>
              setImportMode((mode) => (mode === "merge" ? "replace" : "merge"))
            }
          >
            <span>
              导入方式
              <em className="wr-settings-sub">
                {importMode === "merge"
                  ? "保留现有，补齐缺失"
                  : "用备份替换现有"}
              </em>
            </span>
            <ChevronRight />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="wr-visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImport(file, importMode);
            }}
          />
          <button
            className="wr-settings-row wr-settings-danger"
            onClick={() => setOverlay("清除数据")}
          >
            <span>清除全部数据</span>
            <ChevronRight />
          </button>
        </div>

        <div className="wr-settings-label">首次进入</div>
        <div className="wr-settings-group">
          <button
            className="wr-settings-row"
            onClick={() => {
              storage.setEntered(false);
              setOverlay("");
              setHasEntered(false);
            }}
          >
            <span>重新体验首次进入</span>
            <ChevronRight />
          </button>
        </div>

        <div className="wr-settings-label">关于</div>
        <div className="wr-settings-group">
          <div className="wr-settings-row">
            <span>版本</span>
            <b>{APP_VERSION}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
