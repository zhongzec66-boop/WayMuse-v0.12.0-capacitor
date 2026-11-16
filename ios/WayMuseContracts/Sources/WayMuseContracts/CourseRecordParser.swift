import Foundation

/// 解析单条课程记录，规则对齐 `src/courseImport.ts` 的 `parseCourseRecord`。
///
/// 关键点（不要「顺手优化」）：
/// - `weekday` 允许 1…7，`7` 会被折成 `0`（周日）；`0` 也当周日。
/// - 时间字符串里取**第一个** `h:mm` 或 `h：mm`（全角冒号也算）。
/// - 没给起止时间时，用 `period`（第几节）换算：1-2 节 08:00-09:40，每两节 +2 小时。
public enum CourseRecordParser {

    public static func parse(_ input: Any?) -> ParsedCourse? {
        guard let record = input as? [String: Any] else { return nil }

        let name = (record["name"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !name.isEmpty else { return nil }

        guard let rawWeekday = JSONValue.number(record["weekday"]) else { return nil }
        let weekday = (rawWeekday >= 1 && rawWeekday <= 7) ? Int(rawWeekday.rounded(.towardZero)) % 7 : 0

        var start = normalizeClock(record["start"])
        var end = normalizeClock(record["end"])

        if start == nil || end == nil {
            if let period = JSONValue.number(record["period"]), period >= 1, period <= 20 {
                let slot = Int(((period - 1) / 2).rounded(.down))
                let base = 8 + slot * 2
                start = start ?? String(format: "%02d:00", base)
                end = end ?? String(format: "%02d:40", base + 1)
            }
        }
        guard let startTime = start, let endTime = end else { return nil }

        var weeks: [Int]?
        if let list = record["weeks"] as? [Any] {
            let normalized = list
                .compactMap { JSONValue.number($0) }
                .filter { $0 >= 1 && $0 <= 30 && $0 == $0.rounded() }
                .map { Int($0) }
            let unique = Array(Set(normalized)).sorted()
            weeks = unique.isEmpty ? nil : unique
        }
        // 字符串形式的 weeks（如 "1-8,10"）暂未移植：现在按下表返回 nil，
        // 需要时再补 expandWeeks，别在这里猜格式。

        return ParsedCourse(
            name: String(name.prefix(40)),
            weekday: weekday,
            start: startTime,
            end: endTime,
            place: String(((record["place"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines).prefix(40)),
            weeks: weeks
        )
    }

    /// 从任意文本里取第一个 `h:mm` / `h：mm`，补成 `HH:mm`。
    static func normalizeClock(_ value: Any?) -> String? {
        guard let raw = value as? String else { return nil }
        let ns = raw as NSString
        let full = NSRange(location: 0, length: ns.length)
        guard let match = JSONValue.clockRegex.firstMatch(in: raw, range: full) else { return nil }
        let hour = Int(ns.substring(with: match.range(at: 1))) ?? 0
        let minute = Int(ns.substring(with: match.range(at: 2))) ?? 0
        return String(format: "%02d:%02d", hour, minute)
    }
}
