import { BRAND } from "./brand";
import { storage } from "./storage";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Cloud,
  GraduationCap,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import AvatarPicker from "./AvatarPicker";
import BotAvatar from "./BotAvatar";
import {
  COMPANION_PRESETS,
  COMPANION_TYPES,
  DEFAULT_PROFILE,
  GRADES,
  IDENTITIES,
  RESPONSE_LENGTHS,
  SCHOOL_LEVELS,
  TONES,
} from "./profile";
import type {
  CompanionTone,
  CompanionType,
  ResponseLength,
  UserProfile,
} from "./profile";

const typeCopy: Record<
  CompanionType,
  { icon: ReactNode; description: string }
> = {
  朋友: { icon: <Users />, description: "轻松、平等，可以开玩笑" },
  导师: { icon: <GraduationCap />, description: "直接、结构化，推动行动" },
  自定义: {
    icon: <SlidersHorizontal />,
    description: "自己定语气、温度与长度",
  },
};

export default function Onboarding({
  onFinish,
}: {
  onFinish: (profile: UserProfile) => void;
}) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState(() => storage.getDeepSeekKey());
  const [breezeKey, setBreezeKey] = useState(() => storage.getBreezeKey());
  const [profile, setProfile] = useState<UserProfile>({ ...DEFAULT_PROFILE });
  const [entering, setEntering] = useState(false);
  const steps = 7;

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  const chooseType = (type: CompanionType) => {
    if (type === "自定义") {
      update("companionType", type);
      return;
    }
    const preset = COMPANION_PRESETS[type];
    setProfile((current) => ({ ...current, companionType: type, ...preset }));
  };

  const next = () => {
    if (step === steps - 1) {
      // 先把 Key 存下来，再进入主界面
      if (apiKey.trim()) {
        storage.setDeepSeekKey(apiKey.trim(), true);
      }
      if (breezeKey.trim()) {
        storage.setBreezeKey(breezeKey.trim());
      }
      setEntering(true);
      const finalProfile: UserProfile = {
        ...profile,
        callName: profile.callName.trim() || "同学",
        school: profile.school.trim(),
        major: profile.major.trim(),
        courses: profile.courses.trim(),
      };
      window.setTimeout(() => onFinish(finalProfile), 850);
      return;
    }
    setStep(step + 1);
  };

  return (
    <div className="wr-onboard">
      <div className="wr-onboard-top">
        <button
          className="wr-round"
          aria-label="上一步"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft />
        </button>
        <div className="wr-progress">
          <i style={{ width: `${((step + 1) / steps) * 100}%` }} />
        </div>
      </div>
      <div className="wr-onboard-dots">
        {Array.from({ length: steps }).map((_, index) => (
          <span className={index <= step ? "active" : ""} key={index} />
        ))}
      </div>
      <div
        className={
          step === 1 || step === 2 ? "wr-onboard-body form" : "wr-onboard-body"
        }
        key={step}
      >
        {step === 0 && (
          <>
            <BotAvatar className="wr-onboard-emblem" />
            <h1>你的基本情况</h1>
            <p>不用注册。资料只存在这台手机上。</p>
          </>
        )}

        {step === 1 && (
          <>
            <div className="wr-onboard-kicker">你的学业</div>
            <h1>学业情况</h1>
            <div className="wr-onboard-form">
              <label className="wr-field-block">
                <span>学校</span>
                <input
                  value={profile.school}
                  onChange={(event) => update("school", event.target.value)}
                  placeholder="例如：江南大学"
                  maxLength={80}
                />
              </label>

              <div className="wr-onboard-grid">
                <label className="wr-field-block">
                  <span>专业</span>
                  <input
                    value={profile.major}
                    onChange={(event) => update("major", event.target.value)}
                    placeholder="例如：计算机科学"
                    maxLength={80}
                  />
                </label>
                <label className="wr-field-block">
                  <span>年级</span>
                  <select
                    value={profile.grade}
                    onChange={(event) => update("grade", event.target.value)}
                  >
                    {GRADES.map((grade) => (
                      <option value={grade} key={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="wr-onboard-grid">
                <label className="wr-field-block">
                  <span>当前身份</span>
                  <select
                    value={profile.identity}
                    onChange={(event) => update("identity", event.target.value)}
                  >
                    <option value="">请选择</option>
                    {IDENTITIES.map((value) => (
                      <option value={value} key={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wr-field-block">
                  <span>院校层次</span>
                  <select
                    value={profile.schoolLevel}
                    onChange={(event) =>
                      update("schoolLevel", event.target.value)
                    }
                  >
                    <option value="">请选择</option>
                    {SCHOOL_LEVELS.map((value) => (
                      <option value={value} key={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="wr-field-block">
                <span>主要课程</span>
                <textarea
                  rows={3}
                  value={profile.courses}
                  onChange={(event) => update("courses", event.target.value)}
                  placeholder="例如：高等数学、数据结构、宏观经济学"
                  maxLength={600}
                />
                <small>用顿号或逗号分开</small>
              </label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="wr-onboard-kicker">你的方向</div>
            <h1>最近在忙什么</h1>
            <div className="wr-onboard-form">
              <label className="wr-field-block">
                <span>目标方向</span>
                <input
                  value={profile.direction}
                  onChange={(event) => update("direction", event.target.value)}
                  placeholder="例如：找暑期实习 / 准备考研"
                  maxLength={80}
                />
              </label>

              <label className="wr-field-block">
                <span>兴趣方向</span>
                <input
                  value={profile.interest}
                  onChange={(event) => update("interest", event.target.value)}
                  placeholder="例如：产品设计、数据分析、摄影"
                  maxLength={120}
                />
                <small>随便写几个词就行，我会据此调整给建议的角度。</small>
              </label>

              <label className="wr-field-block">
                <span>所在城市</span>
                <input
                  value={profile.city}
                  onChange={(event) => update("city", event.target.value)}
                  placeholder="例如：无锡"
                  maxLength={40}
                />
                <small>只存在本机</small>
              </label>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="wr-onboard-kicker">称呼与 WayMuse 头像</div>
            <h1>怎么称呼你</h1>
            <input
              className="wr-onboard-input"
              autoFocus
              value={profile.callName}
              onChange={(event) => update("callName", event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && next()}
              placeholder="输入你的称呼"
              maxLength={24}
            />
            <div className="wr-onboard-avatar">
              <div className="wr-onboard-kicker">WayMuse 的头像</div>
              <AvatarPicker
                value={profile.avatar}
                onChange={(value) => update("avatar", value)}
              />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="wr-onboard-kicker">陪伴方式</div>
            <h1>陪伴方式</h1>
            <div className="wr-companion-grid">
              {COMPANION_TYPES.map((type) => (
                <button
                  type="button"
                  key={type}
                  className={
                    profile.companionType === type
                      ? "wr-companion-card selected"
                      : "wr-companion-card"
                  }
                  onClick={() => chooseType(type)}
                >
                  {typeCopy[type].icon}
                  <b>{type}</b>
                  <small>{typeCopy[type].description}</small>
                </button>
              ))}
            </div>

            {profile.companionType === "自定义" && (
              <div className="wr-custom-style">
                <label className="wr-onboard-label">语气</label>
                <div className="wr-tone-chips">
                  {TONES.map((tone) => (
                    <button
                      type="button"
                      key={tone}
                      className={profile.tone === tone ? "selected" : ""}
                      onClick={() => update("tone", tone as CompanionTone)}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
                <label className="wr-onboard-label">
                  表达温度
                  <b>{profile.temperature.toFixed(1)}</b>
                </label>
                <input
                  className="wr-range"
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={profile.temperature}
                  onChange={(event) =>
                    update("temperature", Number(event.target.value))
                  }
                />
                <label className="wr-onboard-label">回复长度</label>
                <div className="wr-length-seg">
                  {RESPONSE_LENGTHS.map((length) => (
                    <button
                      type="button"
                      key={length}
                      className={
                        profile.responseLength === length ? "selected" : ""
                      }
                      onClick={() =>
                        update("responseLength", length as ResponseLength)
                      }
                    >
                      {length}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="wr-onboard-hint">
              {BRAND} 是 AI，不是真人；亲密表达会保持克制。
            </p>
          </>
        )}

        {step === 6 && (
          <>
            <BotAvatar className="wr-onboard-emblem small" />
            <h1>填写 API Key</h1>
            <p>
              这一步只做一次。Key 只存在这台手机上，也会直接发给 DeepSeek，
              不经过任何中间服务器。
            </p>
            <label className="wr-onboard-field">
              <span>DeepSeek Key</span>
              <input
                type="password"
                value={apiKey}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <label className="wr-onboard-field">
              <span>Breeze Key（可选，用来朗读）</span>
              <input
                type="password"
                value={breezeKey}
                placeholder="brz_..."
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setBreezeKey(event.target.value)}
              />
            </label>
            <p className="wr-onboard-hint">
              DeepSeek Key 在 platform.deepseek.com 免费申请。
              暂时不填也能进，之后随时可以在设置里补。
            </p>
          </>
        )}

        {step === 5 && (
          <>
            <BotAvatar className="wr-onboard-emblem small" />
            <h1>数据说明</h1>
            <p>
              学业档案、头像、称呼和陪伴方式都只保存在本机。没有账户，也没有云端副本。
            </p>
            <div className="wr-onboard-connection">
              <Cloud />
              <span>
                <b>DeepSeek 接入</b>
                <small>在设置里填写自己的 Key</small>
              </span>
              <span>可选</span>
            </div>
            <div className="wr-onboard-note">
              只有你主动在聊天页发送时，对话和勾选的资料才会发给
              DeepSeek。可以随时在设置中清除全部数据。
            </div>
          </>
        )}
      </div>
      <button className="wr-onboard-next" onClick={next} disabled={entering}>
        {entering ? "正在进入…" : step === steps - 1 ? "开始使用" : "继续"}
      </button>
      {entering && (
        <div className="wr-entry">
          <BotAvatar className="wr-entry-mark" />
          <div>正在进入</div>
        </div>
      )}
    </div>
  );
}
