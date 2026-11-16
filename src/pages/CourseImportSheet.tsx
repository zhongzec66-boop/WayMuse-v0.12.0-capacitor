import { useRef, useState } from "react";
import { ArrowLeft, Check, Sparkles, TriangleAlert, X } from "lucide-react";
import { parseCourseText, toCourses } from "../courseImport";
import { parseCourseImage } from "../api";
import type { ParsedCourse } from "../courseImport";
import { newId } from "../id";
import { readTermStart, writeTermStart } from "../term";
import type { Course } from "../types";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const SAMPLE = `高等数学 周一 08:00-09:40 教三-302
大学英语 周一 10:00-11:40 外语楼204
数据结构 周二 14:00-15:40 @A302`;

/** 从模型输出里抠出 JSON 数组，容忍 ```json 包裹和前后废话 */
/**
 * 课表导入。
 *
 * 两条路：
 * 1. 本地解析（默认，不联网、不花 token，格式规整时够用）
 * 2. AI 解析（本地认不全时手动触发，需要用户自己配了 DeepSeek Key）
 *
 * 结果先给用户确认，再写课表；认不出的行会列出来，不会静默丢弃。
 */
/** 读成 dataURL 并压到长边 1600px，避免把原图整个塞进请求体 */
async function fileToDataUrl(file: File, maxSide = 1600): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode_failed"));
      element.src = raw;
    });
    const longSide = Math.max(image.width, image.height);
    if (longSide <= maxSide) return raw;
    const scale = maxSide / longSide;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return raw;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return raw;
  }
}

export default function CourseImportSheet({
  existing,
  onClose,
  onSave,
}: {
  existing: Course[];
  onClose: () => void;
  onSave: (courses: Course[]) => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedCourse[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [showFailed, setShowFailed] = useState(false);
  const [source, setSource] = useState<"local" | "ai">("local");
  const [termStart, setTermStart] = useState(() => readTermStart());
  const [shotBusy, setShotBusy] = useState(false);
  const [shotError, setShotError] = useState("");
  const shotRef = useRef<HTMLInputElement | null>(null);

  /**
   * 课表截图识别：图片直接交给服务端的视觉模型，返回结构化课程。
   * 不再走「先 OCR 再解析」那条链，保留原文给用户核对。
   */
  const runShotParse = async (file: File) => {
    setShotBusy(true);
    setShotError("");
    try {
      const dataUrl = await fileToDataUrl(file);
      const courses = await parseCourseImage(dataUrl);
      if (!courses.length) {
        setShotError(
          "没从截图里认出课程，换一张更清晰的，或者用下面的文字导入",
        );
        return;
      }
      setParsed(
        courses.map((course) => ({
          name: course.name,
          weekday: course.weekday,
          start: course.start,
          end: course.end,
          place: course.place ?? "",
          weeks: course.weeks,
        })),
      );
      setFailed([]);
      setSource("ai");
    } catch (error) {
      setShotError(
        error instanceof Error && error.message.includes("429")
          ? "今天的识图次数用完了，明天再试，或者用文字导入"
          : "识别失败，检查网络后重试",
      );
    } finally {
      setShotBusy(false);
    }
  };

  const runParse = () => {
    const result = parseCourseText(text);
    setParsed(result.courses);
    setFailed(result.failedLines);
    setShowFailed(false);
    setSource("local");
  };

  const pending = parsed ? toCourses(parsed, existing, newId) : [];
  const duplicates = parsed ? parsed.length - pending.length : 0;

  return (
    <div className="wr-overlay">
      <div className="wr-sheet wr-course-import">
        <div className="wr-sheet-head">
          <button onClick={onClose} aria-label="返回">
            <ArrowLeft />
          </button>
          <h2>导入课表</h2>
          <button onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </div>

        <p className="wr-sheet-description">
          把课表文字直接粘在下面，我会自动帮你解析成课程表。一行一门课就行，
          认得出「第 1-2 节」「1-16 周」「单周/双周」这些写法。
        </p>

        <button
          type="button"
          className="wr-course-import-shot"
          onClick={() => shotRef.current?.click()}
          disabled={shotBusy}
        >
          <Sparkles size={16} />
          {shotBusy ? "正在识别截图…" : "上传课表截图，自动识别"}
        </button>
        <input
          ref={shotRef}
          type="file"
          accept="image/*"
          className="wr-visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void runShotParse(file);
          }}
        />
        {shotError && <p className="wr-course-import-ai-error">{shotError}</p>}

        <label className="wr-course-import-term">
          <span>开学日期（用来算教学周）</span>
          <input
            type="date"
            value={termStart}
            onChange={(event) => {
              setTermStart(event.target.value);
              if (event.target.value) writeTermStart(event.target.value);
            }}
          />
        </label>

        <textarea
          className="wr-course-import-input"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setParsed(null);
          }}
          rows={7}
          placeholder={SAMPLE}
          aria-label="课表文本"
        />

        <div className="wr-course-import-actions">
          <button
            type="button"
            className="wr-course-import-sample"
            onClick={() => setText(SAMPLE)}
          >
            填入示例
          </button>
          <button
            type="button"
            className="wr-course-import-parse"
            onClick={runParse}
            disabled={!text.trim()}
          >
            解析
          </button>
        </div>

        <button
          type="button"
          className="wr-course-import-ai"
          onClick={() => shotRef.current?.click()}
          disabled={shotBusy}
        >
          <Sparkles size={16} />
          {shotBusy ? "AI 正在识别…" : "格式太乱？直接上传截图更快"}
        </button>

        {parsed && (
          <div className="wr-course-import-result">
            {parsed.length === 0 ? (
              <p className="wr-course-import-empty">
                <TriangleAlert size={16} />{" "}
                没认出课程。检查一下每行是否包含「周几 + 时间 + 课程名」。
              </p>
            ) : (
              <>
                <div className="wr-course-import-count">
                  认出 {parsed.length} 门课
                  {source === "ai" && "（AI 补充）"}
                  {duplicates > 0 && `，其中 ${duplicates} 门已在课表里`}
                </div>
                <ul className="wr-course-import-list">
                  {parsed.map((course, index) => (
                    <li key={`${course.name}-${index}`}>
                      <span className="wr-course-import-day">
                        {WEEKDAYS[course.weekday]}
                      </span>
                      <span className="wr-course-import-time">
                        {course.start}–{course.end}
                      </span>
                      <span className="wr-course-import-name">
                        {course.name}
                      </span>
                      {course.place && (
                        <span className="wr-course-import-place">
                          {course.place}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="wr-course-import-save"
                  onClick={() => {
                    onSave(pending);
                    onClose();
                  }}
                  disabled={pending.length === 0}
                >
                  <Check size={18} /> 保存 {pending.length} 门课
                </button>
              </>
            )}

            {failed.length > 0 && (
              <div className="wr-course-import-failed">
                <button
                  type="button"
                  onClick={() => setShowFailed(!showFailed)}
                >
                  有 {failed.length} 行没认出，点这里看看
                </button>
                {showFailed && (
                  <ul>
                    {failed.slice(0, 8).map((line) => (
                      <li key={line}>{line.slice(0, 60)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
