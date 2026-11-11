import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Maximize2, X } from "lucide-react";
import { highlightCode } from "./highlight";

/**
 * 代码卡：语言标签 + 复制 + 全屏。
 *
 * 长代码在气泡里只有 300px 宽，读起来很痛苦；
 * 全屏页给到接近整屏，字号也大一档。
 */
export default function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const html = useMemo(() => highlightCode(code, language), [code, language]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // 老 WebView 没有 clipboard API，退回临时 textarea
      const area = document.createElement("textarea");
      area.value = code;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  const label = language.trim() || "code";
  const lineCount = code.split("\n").length;

  return (
    <>
      <div className="wr-code-card">
        <div className="wr-code-head">
          <span className="wr-code-lang">{label}</span>
          <span className="wr-code-lines">{lineCount} 行</span>
          <button
            type="button"
            className="wr-code-btn"
            onClick={() => void copy()}
            aria-label="复制代码"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "已复制" : "复制"}
          </button>
          <button
            type="button"
            className="wr-code-btn"
            onClick={() => setFullscreen(true)}
            aria-label="全屏查看代码"
          >
            <Maximize2 size={14} />
            全屏
          </button>
        </div>
        <pre className="wr-code-body">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>

      {fullscreen &&
        createPortal(
          <div
            className="wr-code-full"
            role="dialog"
            aria-modal="true"
            aria-label="代码"
          >
            <div className="wr-code-full-head">
              <span>{label}</span>
              <button
                type="button"
                className="wr-code-btn"
                onClick={() => void copy()}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "已复制" : "复制"}
              </button>
              <button
                type="button"
                className="wr-code-btn"
                onClick={() => setFullscreen(false)}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <pre className="wr-code-full-body">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>,
          document.body,
        )}
    </>
  );
}
