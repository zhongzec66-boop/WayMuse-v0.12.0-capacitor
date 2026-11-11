import { useEffect, useState } from "react";
import {
  AccountInfo,
  ApiError,
  Quota,
  fetchMe,
  fetchQuota,
  guestLogin,
  readSession,
  saveProfile,
  writeSession,
} from "./api";
import type { AuthSession } from "./api";

/**
 * 账号状态。
 *
 * 启动时如果本地没有会话，直接用设备号静默创建游客账号——
 * 用户不需要注册就能用，配额按账号算。
 */
export function useAccount() {
  const [session, setSession] = useState<AuthSession | null>(() =>
    readSession(),
  );
  const [me, setMe] = useState<AccountInfo | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [info, q] = await Promise.all([fetchMe(), fetchQuota()]);
      setMe(info);
      setQuota(q);
      setSession(readSession());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "连接服务器失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        if (!readSession()) {
          const created = await guestLogin();
          if (alive) setSession(created);
        }
        if (!alive) return;
        await reload();
      } catch {
        if (alive) setError("无法连接服务器，当前使用本地模式");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signOut = () => {
    writeSession(null);
    setSession(null);
    setMe(null);
    setQuota(null);
  };

  const applyProfile = async (profile: {
    school: string;
    major: string;
    grade: string;
    direction: string;
  }) => {
    await saveProfile(profile);
    await reload();
  };

  return {
    session,
    me,
    quota,
    loading,
    error,
    reload,
    signOut,
    applyProfile,
    setSession,
  };
}
