import { useEffect, useState } from "react";
import { GraduationCap, LogOut, Mail, Smartphone } from "lucide-react";
import type { useAccount } from "../useAccount";

type AccountApi = ReturnType<typeof useAccount>;

function formatTokens(value: number): string {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)} 万`;
  return String(Math.max(0, Math.round(value)));
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

/**
 * 设置页顶部的三块：账号 / 配额 / 我的信息。
 *
 * 「我的信息」不是装饰：学长学姐经验库要靠学校、专业、年级做匹配。
 */
export default function AccountPanel({
  account,
  onLogin,
}: {
  account: AccountApi;
  onLogin: () => void;
}) {
  const { me, quota, session, loading, signOut, applyProfile } = account;
  const user = me?.user ?? session?.user ?? null;
  const isGuest = user?.is_guest ?? true;

  const [editing, setEditing] = useState(false);
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [grade, setGrade] = useState("");
  const [direction, setDirection] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const profile = me?.profile;
    if (!profile) return;
    setSchool(profile.school);
    setMajor(profile.major);
    setGrade(profile.grade);
    setDirection(profile.direction);
  }, [me?.profile]);

  const monthlyUsed = quota?.monthlyUsed ?? 0;
  const monthlyLimit = quota?.monthlyLimit ?? 300_000;
  const percent = Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100));
  const dailyLeft = Math.max(0, (quota?.dailyLimit ?? 30_000) - (quota?.dailyUsed ?? 0));

  const save = async () => {
    setSaving(true);
    try {
      await applyProfile({ school, major, grade, direction });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="wr-settings-label">账号</div>
      <div className="wr-settings-group">
        <div className="wr-account-row">
          <span className="wr-account-avatar">
            {isGuest ? <Smartphone size={18} /> : <Mail size={18} />}
          </span>
          <div className="wr-account-main">
            <b>{isGuest ? "设备账号" : (user?.email ?? "已登录")}</b>
            <small>
              {isGuest
                ? "未登录 · 数据只在本机，换手机前请登录"
                : `${me?.devices.length ?? 1} 台设备在线`}
            </small>
          </div>
          {isGuest ? (
            <button className="wr-account-action" onClick={onLogin}>
              登录
            </button>
          ) : (
            <button className="wr-account-action" onClick={signOut}>
              <LogOut size={14} /> 退出
            </button>
          )}
        </div>
        <div className="wr-quota">
          <div className="wr-quota-head">
            <span>
              本月 {formatTokens(monthlyUsed)} / {formatTokens(monthlyLimit)}
            </span>
            <em>{loading ? "同步中…" : `${percent}%`}</em>
          </div>
          <div className="wr-quota-bar" aria-hidden="true">
            <i style={{ width: `${percent}%` }} data-high={percent > 80} />
          </div>
          <div className="wr-quota-foot">
            <span>今日剩余 {formatTokens(dailyLeft)}</span>
            <span>{formatDate(quota?.resetMonthlyAt)} 重置</span>
          </div>
        </div>
      </div>

      <div className="wr-settings-label">我的信息</div>
      <div className="wr-settings-group">
        {editing ? (
          <div className="wr-profile-edit">
            {[
              { label: "学校", value: school, set: setSchool },
              { label: "专业", value: major, set: setMajor },
              { label: "年级", value: grade, set: setGrade },
              { label: "目标方向", value: direction, set: setDirection },
            ].map((field) => (
              <label key={field.label} className="wr-profile-field">
                <span>{field.label}</span>
                <input
                  value={field.value}
                  onChange={(event) => field.set(event.target.value)}
                  placeholder={`填你的${field.label}`}
                />
              </label>
            ))}
            <button
              className="wr-profile-save"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        ) : (
          <button
            className="wr-settings-row"
            onClick={() => setEditing(true)}
          >
            <span>
              <GraduationCap size={16} /> 学校 / 专业 / 年级
              <em className="wr-settings-sub">
                {[school || "未填", major || "未填", grade || "未填"]
                  .filter(Boolean)
                  .join(" · ")}
              </em>
            </span>
            <span className="wr-settings-chevron">编辑</span>
          </button>
        )}
      </div>
    </>
  );
}
