import { BRAND } from "./brand";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  FileText,
  Mic,
  Square,
  Upload,
} from "lucide-react";

import { newId } from "./id";
import type { Course, Kind } from "./types";
const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function WayMuseIntake({
  initialKind = "课表",
  onClose,
  onSaveCourse,
  onSaveNote,
}: {
  initialKind?: Kind;
  onClose: () => void;
  onSaveCourse: (course: Course) => void;
  onSaveNote: (note: string) => void;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [course, setCourse] = useState<Omit<Course, "id">>({
    name: "",
    weekday: 1,
    start: "08:00",
    end: "09:40",
    place: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = (next: Kind) => {
    setKind(next);
    setFile(null);
    setNote("");
    setError("");
  };
  const saveCourse = () => {
    if (!course.name.trim()) {
      setError("请先填写课程名称");
      return;
    }
    if (course.end <= course.start) {
      setError("结束时间要晚于开始时间");
      return;
    }
    onSaveCourse({
      ...course,
      id: newId(),
      name: course.name.trim(),
      place: course.place.trim(),
    });
    onClose();
  };
  const saveFile = () => {
    if (!file) {
      setError("请先选择文件");
      return;
    }
    onSaveNote(
      `${kind}：${file.name}${note.trim() ? `。备注：${note.trim()}` : ""}`,
    );
    onClose();
  };
  const startRecord = async () => {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error("当前浏览器不支持录音");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      media.onstop = () => {
        const blob = new Blob(chunks.current, {
          type: media.mimeType || "audio/webm",
        });
        setFile(
          new File(
            [blob],
            `语音笔记-${new Date().toLocaleString("zh-CN")}.webm`,
            { type: blob.type },
          ),
        );
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      media.start();
      recorder.current = media;
      setRecording(true);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "无法开始录音，请检查麦克风权限",
      );
    }
  };
  const stopRecord = () => recorder.current?.stop();
  return (
    <div className="wr-intake-page">
      <div className="wr-intake-head">
        <button className="wr-round" onClick={onClose} aria-label="返回">
          <ArrowLeft />
        </button>
        <h1>添加资料</h1>
        <span />
      </div>
      <div className="wr-intake-scroll">
        <p className="wr-intake-intro">
          把课程和资料交给 {BRAND}。先预览，再由你确认保存。
        </p>
        <div className="wr-intake-tabs">
          {(["课表", "文档", "图片", "语音"] as Kind[]).map((x, i) => {
            const icons = [<BookOpen />, <FileText />, <Camera />, <Mic />];
            return (
              <button
                key={x}
                className={kind === x ? "active" : ""}
                onClick={() => choose(x)}
              >
                {icons[i]}
                {x}
              </button>
            );
          })}
        </div>
        {kind === "课表" ? (
          <div className="wr-intake-card">
            <h2>添加一节课</h2>
            <p>先手动录入。课表图片和文件的自动识别将在后续接入。</p>
            <label>
              课程名称
              <input
                value={course.name}
                onChange={(e) => setCourse({ ...course, name: e.target.value })}
                placeholder="例如：高等数学"
              />
            </label>
            <label>
              星期
              <select
                value={course.weekday}
                onChange={(e) =>
                  setCourse({ ...course, weekday: Number(e.target.value) })
                }
              >
                {days.map((label, value) => (
                  <option value={value} key={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="wr-intake-time">
              <label>
                开始时间
                <input
                  type="time"
                  value={course.start}
                  onChange={(e) =>
                    setCourse({ ...course, start: e.target.value })
                  }
                />
              </label>
              <label>
                结束时间
                <input
                  type="time"
                  value={course.end}
                  onChange={(e) =>
                    setCourse({ ...course, end: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              地点
              <input
                value={course.place}
                onChange={(e) =>
                  setCourse({ ...course, place: e.target.value })
                }
                placeholder="教学楼与教室，可留空"
              />
            </label>
            <button className="wr-intake-primary" onClick={saveCourse}>
              <Check size={19} />
              保存到课表
            </button>
          </div>
        ) : (
          <div className="wr-intake-card">
            <h2>
              {kind === "文档"
                ? "选择文档"
                : kind === "图片"
                  ? "选择图片"
                  : "录制或选择语音"}
            </h2>
            <p>
              {kind === "文档"
                ? "支持选择 PDF、Word、PPT、TXT 等文件。当前仅预览文件信息。"
                : kind === "图片"
                  ? "可选择课表或通知图片。当前显示原图，尚未自动识别文字。"
                  : "可以使用麦克风录音，或选择已有音频。当前尚未自动转写。"}
            </p>
            <input
              ref={fileInput}
              className="wr-hidden-input"
              type="file"
              accept={
                kind === "文档"
                  ? ".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv"
                  : kind === "图片"
                    ? "image/*"
                    : "audio/*"
              }
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError("");
              }}
            />
            <button
              className="wr-intake-picker"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={20} />
              {file ? "重新选择" : "选择文件"}
            </button>
            {kind === "语音" && (
              <button
                className="wr-intake-picker"
                onClick={recording ? stopRecord : startRecord}
              >
                {recording ? <Square size={19} /> : <Mic size={19} />}{" "}
                {recording ? "停止录音" : "开始录音"}
              </button>
            )}
            {file && (
              <div className="wr-intake-preview">
                <b>{file.name}</b>
                <small>
                  {(file.size / 1024).toFixed(1)} KB · 仅在当前页面预览
                </small>
                {kind === "图片" && <img src={preview} alt="所选图片预览" />}
                {kind === "语音" && <audio controls src={preview} />}
              </div>
            )}
            <label>
              补充说明
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：这是下周的课程通知"
              />
            </label>
            <button className="wr-intake-primary" onClick={saveFile}>
              <Check size={19} />
              保存资料记录
            </button>
            <div className="wr-intake-disclaimer">
              演示版只保存文件名和你的备注，不会保存文件内容或发送到服务器。关闭页面后文件预览会消失。
            </div>
          </div>
        )}
        {error && (
          <div className="wr-intake-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
