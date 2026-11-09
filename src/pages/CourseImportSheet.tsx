import { useState } from "react";
import { ArrowLeft, Check, Sparkles, TriangleAlert, X } from "lucide-react";
import { parseCourseRecord, parseCourseText, toCourses } from "../courseImport";
import type { ParsedCourse } from "../courseImport";
import { streamDeepSeekChat } from "../deepseek/client";
import { newId } from "../id";
import { storage } from "../storage";
import { readTermStart, writeTermStart } from "../term";
import type { Course } from "../types";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const SAMPLE = `高等数学 周一 08:00-09:40 教三-302
大学英语 周一 10:00-11:40 外语楼204
数据结构 周二 14:00-15:40 @A302`;

const AI_PROMPT = `你是课表解析器。把用户粘贴的课表文字转成 JSON 数组，不要输出任何解释。

每个元素字段：
- name: 课程名，去掉周次、学分、教师等杂项
- weekday: 1-7 表示周一到周日
- start / end: HH:mm 24 小时制；只有节次时按常见作息换算
- place: 地点，没有就空字符串

只输出 JSON 数组，例如：
[{"name":"高等数学","weekday":1,"start":"08:00","end":"09:40","place":"教三-302"}]

如果整段文字里没有可识别的课程，输出 []。`;


/** 从模型输出里抠出 JSON 数组，容忍 ```json 包裹和前后废话 */
function extractJsonArray(raw: string): unknown[] {
  const cleaned = raw.replace(/```json/gi, "```").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 课表导入。
 *
 * 两条路：
 * 1. 本地解析（默认，不联网、不花 token，格式规整时够用）
 * 2. AI 解析（本地认不全时手动触发，需要用户自己配了 DeepSeek Key）
 *
 * 结果先给用户确认，再写课表；认不出的行会列出来，不会静默丢弃。
 */
export default function CourseImportSheet({
  existing,
  onClose,
  onSave,
  onOpenSettings,
}: {
  existing: Course[];
  onClose: () => void;
  onSave: (courses: Course[]) => void;
  onOpenSettings?: () => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedCourse[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [showFailed, setShowFailed] = useState(false);
  const [source, setSource] = useState<"local" | "ai">("local");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [termStart, setTermStart] = useState(() => readTermStart());

  const hasKey = Boolean(storage.getDeepSeekKey().trim());

  const runParse = () => {
    const result = parseCourseText(text);
    setParsed(result.courses);
    setFailed(result.failedLines);
    setShowFailed(false);
    setSource("local");
    setAiError("");
  };

  const runAiParse = async () => {
    if (aiBusy) return;
    const key = storage.getDeepSeekKey().trim();
    if (!key) {
      // 没连模型时直接带去设置页，而不是只丢一句报错
      if (onOpenSettings) onOpenSettings();
      else setAiError("还没有连接 DeepSeek，先在设置里填 Key");
      return;
    }
    setAiBusy(true);
    setAiError("");
    try {
      const base = storage.getDeepSeekConfig();
      const result = await streamDeepSeekChat({
        config: {
          ...base,
          temperature: 0,
          maxTokens: 2000,
          thinking: false,
        },
        apiKey: key,
        messages: [
          { role: "system", content: AI_PROMPT },
          { role: "user", content: text.slice(0, 6000) },
        ],
      });
      const records = extractJsonArray(result.content)
        .map(parseCourseRecord)
        .filter((item): item is ParsedCourse => item !== null);

      if (records.length === 0) {
        setAiError("AI 也没认出可以用的课程，检查一下文字是否完整");
        return;
      }

      // 并入本地结果：本地优先，AI 只补本地没认出的
      const local = parseCourseText(text);
      const seen = new Set(
        local.courses.map((c) => `${c.name}|${c.weekday}|${c.start}`),
      );
      const merged = [...local.courses];
      for (const record of records) {
        const key2 = `${record.name}|${record.weekday}|${record.start}`;
        if (seen.has(key2)) continue;
        seen.add(key2);
        merged.push(record);
      }
      merged.sort((a, b) =>
        a.weekday === b.weekday
          ? a.start.localeCompare(b.start)
          : a.weekday - b.weekday,
      );
      setParsed(merged);
      setFailed([]);
      setSource("ai");
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message.slice(0, 80) : "AI 解析失败",
      );
    } finally {
      setAiBusy(false);
    }
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
          把教务系统的课表文字复制进来，每行一门课。支持「周一
          08:00-09:40 高等数学 教三-302」这种写法，也认「第 1-2 节」和
          「1-16 周」「单周」「双周」。
        </p>

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
            setAiError("");
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
          onClick={() => void runAiParse()}
          disabled={!text.trim() || aiBusy}
        >
          <Sparkles size={16} />
          {aiBusy
            ? "AI 正在解析…"
            : hasKey
              ? "格式太乱？让 AI 解析"
              : "格式太乱？先连接 DeepSeek"}
        </button>
        {aiError && <p className="wr-course-import-ai-error">{aiError}</p>}

        {parsed && (
          <div className="wr-course-import-result">
            {parsed.length === 0 ? (
              <p className="wr-course-import-empty">
                <TriangleAlert size={16} /> 没认出课程。检查一下每行是否包含「周几 +
                时间 + 课程名」。
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
                      <span className="wr-course-import-name">{course.name}</span>
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
