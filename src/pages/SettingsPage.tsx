import { useRef, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import AccountPanel from "./AccountPanel";
import DeviceDataPanel from "./DeviceDataPanel";
import type { useAccount } from "../useAccount";
import AvatarPicker from "../AvatarPicker";
import { haptic } from "../nativeExtras";
import { storage } from "../storage";
import { APP_VERSION } from "../version";
import type { DeepSeekConfig } from "../deepseek/types";
import {
  COMPANION_PRESETS,
  COMPANION_TYPES,
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
  account,
  onLogin,
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
  account: ReturnType<typeof useAccount>;
  onLogin: () => void;
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [deepSeek, setDeepSeek] = useState<DeepSeekConfig>(() =>
    storage.getDeepSeekConfig(),
  );

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
            { name: "账号与配额", id: "setting-账号" },
            { name: "助理与风格", id: "setting-陪伴风格" },
            { name: "模型与连接", id: "setting-模型连接" },
            { name: "数据与关于", id: "setting-隐私与数据" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() =>
                document
                  .getElementById(item.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {item.name}
            </button>
          ))}
        </nav>
        <AccountPanel account={account} onLogin={onLogin} />

        <div className="wr-settings-label" id="setting-个人档案">
          个人档案
        </div>
        <div className="wr-settings-group">
          <label className="wr-settings-field">
            <span>怎么称呼你</span>
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
            <span>主要课程</span>
            <textarea
              rows={3}
              value={profile.courses}
              onChange={(event) => updateProfile("courses", event.target.value)}
              placeholder="例如：高等数学、数据结构、宏观经济学"
              maxLength={600}
            />
          </label>
          <p className="wr-settings-note">
            学校 / 专业 / 年级在顶部「我的信息」里统一管理，会同步到服务器，
            用于匹配同专业的学长经验。
          </p>
        </div>

        <div className="wr-settings-label" id="setting-陪伴风格">
          助理与风格
        </div>
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
          <div className="wr-settings-avatar-row">
            <AvatarPicker value={agentAvatar} onChange={onAgentAvatarChange} />
          </div>
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
            <span>
              模型服务
              <em className="wr-settings-sub">Key 保存在服务器，App 不存储</em>
            </span>
            <b className="wr-settings-status ok">已接入</b>
          </div>
          <div className="wr-settings-row">
            <span>
              用量
              <em className="wr-settings-sub">
                按账号配额计算，额度不够找我们充值
              </em>
            </span>
          </div>
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

        <div className="wr-settings-label" id="setting-隐私与数据">
          数据与关于
        </div>
        <div className="wr-settings-group">
          <DeviceDataPanel />
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

        <div className="wr-settings-group">
          <button
            type="button"
            className="wr-settings-row"
            onClick={() => void haptic("medium")}
          >
            <span>
              触感测试
              <em className="wr-settings-sub">点一下应该会震</em>
            </span>
            <span className="wr-settings-chevron">试</span>
          </button>
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
          <div className="wr-settings-row">
            <span>
              版本
              <em className="wr-settings-sub">安全区 {safeTop}px</em>
            </span>
            <b>{APP_VERSION}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
