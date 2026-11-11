import { useState } from "react";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { ApiError, requestCode, verifyCode } from "../api";
import type { AuthSession } from "../api";

/**
 * 邮箱登录。
 *
 * 用 QQ 邮箱验证码，不需要密码。
 * 人机验证（Turnstile）在服务端校验；客户端这里留了 token 位，
 * 等 Cloudflare 站点建好后接真 widget 即可。
 */
const TURNSTILE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export default function LoginPage({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: (session: AuthSession) => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("填一个有效的邮箱");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await requestCode(email.trim(), TURNSTILE_TEST_TOKEN);
      setStep("code");
      setCooldown(60);
      const timer = window.setInterval(() => {
        setCooldown((value) => {
          if (value <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 429
            ? "发得太频繁了，等一会儿再试"
            : "发送失败，检查邮箱是否正确"
          : "网络失败，稍后重试",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError("验证码是 6 位数字");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await verifyCode(email.trim(), code.trim());
      onLogin(session);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message === "code_expired"
            ? "验证码过期了，重新发一次"
            : err.message === "code_invalid"
              ? "验证码不对"
              : "登录失败"
          : "网络失败，稍后重试",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wr-page">
      <div className="wr-phone">
        <main className="wr-content wr-login">
          <button className="wr-login-back" onClick={onClose} aria-label="返回">
            <ArrowLeft size={20} />
          </button>

          <h1 className="wr-login-title">
            {step === "email" ? "登录 WayMuse" : "输入验证码"}
          </h1>
          <p className="wr-login-sub">
            {step === "email"
              ? "用邮箱收一个验证码，不需要密码。登录后换设备也能找回数据。"
              : `验证码已发到 ${email}，10 分钟内有效。`}
          </p>

          {step === "email" ? (
            <>
              <label className="wr-login-field">
                <Mail size={18} />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@qq.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <button
                className="wr-login-primary"
                onClick={() => void sendCode()}
                disabled={busy}
              >
                {busy ? <Loader2 className="spin" size={18} /> : null}
                {busy ? "发送中…" : "发送验证码"}
              </button>
            </>
          ) : (
            <>
              <label className="wr-login-field">
                <ShieldCheck size={18} />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 位验证码"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <button
                className="wr-login-primary"
                onClick={() => void submitCode()}
                disabled={busy}
              >
                {busy ? <Loader2 className="spin" size={18} /> : null}
                {busy ? "登录中…" : "登录"}
              </button>
              <button
                className="wr-login-link"
                onClick={() => void sendCode()}
                disabled={cooldown > 0 || busy}
              >
                {cooldown > 0 ? `${cooldown}s 后可重发` : "重新发送"}
              </button>
            </>
          )}

          {error && <p className="wr-login-error">{error}</p>}

          <p className="wr-login-note">
            不登录也能用：当前是设备账号，数据存在本机。换手机前记得先登录。
          </p>
        </main>
      </div>
    </div>
  );
}
