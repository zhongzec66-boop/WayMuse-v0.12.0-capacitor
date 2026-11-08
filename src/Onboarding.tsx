import { BRAND } from "./brand";
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
  RESPONSE_LENGTHS,
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
  const [profile, setProfile] = useState<UserProfile>({ ...DEFAULT_PROFILE });
  const [entering, setEntering] = useState(false);
  const steps = 5;

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
          step === 1 || step === 2 || step === 3
            ? "wr-onboard-body form"
            : "wr-onboard-body"
        }
        key={step}
      >
        {step === 0 && (
          <>
            <BotAvatar className="wr-onboard-emblem" />
            <h1>先建立你的本地档案。</h1>
            <p>
              不用注册账号。先告诉我你的学业背景，再设置 {BRAND}{" "}
              该怎么称呼你、以什么方式陪你。
            </p>
            <div className="wr-onboard-note">资料只保存在当前设备。</div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="wr-onboard-kicker">你的学业</div>
            <h1>先认识你的学习生活。</h1>
            <div className="wr-onboard-form">
              <label>
                学校
                <input
                  value={profile.school}
                  onChange={(event) => update("school", event.target.value)}
                  placeholder="例如：江南大学"
                  maxLength={80}
                />
              </label>
              <div className="wr-onboard-grid">
                <label>
                  专业
                  <input
                    value={profile.major}
                    onChange={(event) => update("major", event.target.value)}
                    placeholder="例如：计算机科学"
                    maxLength={80}
                  />
                </label>
                <label>
                  年级
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
              <label>
                主要课程
                <textarea
                  rows={3}
                  value={profile.courses}
                  onChange={(event) => update("courses", event.target.value)}
                  placeholder="例如：高等数学、数据结构、宏观经济学"
                  maxLength={600}
                />
              </label>
            </div>
            <p className="wr-onboard-hint">
              都可以先跳过，之后在设置 → 个人档案里补充。
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="wr-onboard-kicker">称呼与 WayMuse 头像</div>
            <h1>{BRAND} 该怎么称呼你？</h1>
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

        {step === 3 && (
          <>
            <div className="wr-onboard-kicker">陪伴方式</div>
            <h1>你希望 {BRAND} 以什么方式陪伴你？</h1>
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

            {profile.companionType !== "自定义" && (
              <p className="wr-onboard-hint">
                当前风格：{profile.tone} · {profile.responseLength}
                回复。之后可以在设置里调整。
              </p>
            )}
            <p className="wr-onboard-hint">
              {BRAND} 是 AI，不是真人；亲密表达会保持克制。
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <BotAvatar className="wr-onboard-emblem small" />
            <h1>你的资料，由你决定。</h1>
            <p>
              学业档案、头像、称呼和陪伴方式都只保存在本机。没有账户，也没有云端副本。
            </p>
            <div className="wr-onboard-connection">
              <Cloud />
              <span>
                <b>DeepSeek 接入</b>
                <small>可在设置 → AI 连接中填写自己的 Key</small>
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
          <div>{profile.callName || "同学"}，陪你走下一步。</div>
        </div>
      )}
    </div>
  );
}
