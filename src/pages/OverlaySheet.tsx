import { BRAND } from "../brand";
import { ArrowLeft, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Overlay } from "../types";

export default function OverlaySheet({
  overlay,
  setOverlay,
  draft,
  setDraft,
  submit,
  onClearData,
}: {
  overlay: Exclude<Overlay, "" | "设置" | "资料导入" | "隐私与数据">;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  submit: () => void;
  onClearData: () => void;
}) {
  const backTarget: Overlay = overlay === "清除数据" ? "设置" : "";
  return (
    <div className="wr-overlay">
      <div className="wr-sheet">
        <div className="wr-sheet-head">
          <button onClick={() => setOverlay(backTarget)} aria-label="返回">
            <ArrowLeft />
          </button>
          <h2>{overlay}</h2>
          <button onClick={() => setOverlay("")} aria-label="关闭">
            <X />
          </button>
        </div>
        {overlay === "清除数据" && (
          <div className="wr-confirm">
            <p>
              将删除本机的课程、任务、记忆、称呼和助理名，并回到首次进入。此操作无法撤销。
            </p>
            <div className="wr-confirm-actions">
              <button type="button" onClick={() => setOverlay("设置")}>
                取消
              </button>
              <button type="button" className="danger" onClick={onClearData}>
                确认清除
              </button>
            </div>
          </div>
        )}
        {(overlay === "新增任务" || overlay === "添加记忆") && (
          <form
            className="wr-create"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label>
              {overlay === "新增任务"
                ? "你想推进什么？"
                : `希望 ${BRAND} 记住什么？`}
            </label>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                overlay === "新增任务"
                  ? "例如：整理一版实习简历"
                  : "例如：我更喜欢实践型课程"
              }
            />
            <button type="submit">保存</button>
          </form>
        )}
      </div>
    </div>
  );
}
