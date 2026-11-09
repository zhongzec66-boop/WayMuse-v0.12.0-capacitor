import { useState } from "react";
import { ArrowLeft, Check, TriangleAlert, X } from "lucide-react";
import { parseCourseText, toCourses } from "../courseImport";
import type { ParsedCourse } from "../courseImport";
import { newId } from "../id";
import type { Course } from "../types";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const SAMPLE = `高等数学 周一 08:00-09:40 教三-302
大学英语 周一 10:00-11:40 外语楼204
数据结构 周二 14:00-15:40 @A302`;

/**
 * 课表导入。
 *
 * 只用本地解析，不联网：解析结果先给用户看，确认后才写入课表。
 * 认不出来的行会明确列出来，而不是悄悄丢掉。
 */
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

  const runParse = () => {
    const result = parseCourseText(text);
    setParsed(result.courses);
    setFailed(result.failedLines);
    setShowFailed(false);
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
          08:00-09:40 高等数学 教三-302」这种写法，也认「第 1-2 节」。
        </p>

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
                  {duplicates > 0 && `（${duplicates} 门已在课表里，会跳过）`}
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
