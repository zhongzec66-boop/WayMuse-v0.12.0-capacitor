import { useRef, useState } from "react";
import { LoaderCircle, Trash2, Upload } from "lucide-react";
import { imageFileToAvatar } from "./avatar";
import BotAvatar from "./BotAvatar";

export default function AvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = () => inputRef.current?.click();

  return (
    <div className="wr-avatar-picker">
      <button
        type="button"
        className="wr-avatar-preview"
        onClick={choose}
        aria-label={value ? "更换头像" : "上传头像"}
      >
        {value ? <img src={value} alt="头像预览" /> : <BotAvatar />}
        {busy && (
          <span className="wr-avatar-busy">
            <LoaderCircle size={20} />
          </span>
        )}
      </button>
      <div className="wr-avatar-copy">
        <button
          type="button"
          className="wr-avatar-upload"
          onClick={choose}
          disabled={busy}
        >
          <Upload size={15} /> {value ? "更换照片" : "上传照片"}
        </button>
        {value && (
          <button
            type="button"
            className="wr-avatar-remove"
            onClick={() => {
              onChange("");
              setError("");
            }}
          >
            <Trash2 size={14} /> 移除
          </button>
        )}
        {error && <em role="alert">{error}</em>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="wr-avatar-input"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            onChange(await imageFileToAvatar(file));
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "上传失败");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
