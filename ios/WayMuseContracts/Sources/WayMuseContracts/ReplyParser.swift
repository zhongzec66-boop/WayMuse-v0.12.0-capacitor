import Foundation

/// JSON 值的宽松取值：对齐 JS 的 `Number(x)` 语义（数字、数字字符串都认）。
enum JSONValue {
    static let clockRegex = try! NSRegularExpression(pattern: #"(\d{1,2})[:：](\d{1,2})"#)
    static let shortClockRegex = try! NSRegularExpression(pattern: #"^\d{1,2}:\d{2}$"#)
    static let dateRegex = try! NSRegularExpression(pattern: #"^\d{4}-\d{2}-\d{2}$"#)

    static func number(_ value: Any?) -> Double? {
        switch value {
        case let number as NSNumber:
            return number.doubleValue
        case let string as String:
            return Double(string.trimmingCharacters(in: .whitespaces))
        default:
            return nil
        }
    }

    static func matches(_ regex: NSRegularExpression, _ text: String) -> Bool {
        let range = NSRange(location: 0, length: (text as NSString).length)
        return regex.firstMatch(in: text, range: range) != nil
    }
}

/// 回复正文里的协议块解析，行为对齐 `src/agent.ts` 的 `parseReply`。
///
/// 顺序固定：`plans` → `memories` → `courses` → `choices` → `deadlines`，
/// 每块解析完从正文里删除；块内是 JSON 数组。
///
/// 三条必须复刻的行为：
/// 1. **未闭合**（流式中间态）时，该块内容不参与正文，正文只保留块之前的部分；
/// 2. **JSON 坏掉**时该块降级为空，不抛错、不影响其他块；
/// 3. 每块有条数上限，超出直接丢弃。
public enum ReplyParser {

    private static let plansCap = 3
    private static let memoriesCap = 3
    private static let coursesCap = 40
    private static let choicesCap = 4
    private static let deadlinesCap = 5

    /// - Parameters:
    ///   - content: 模型回复全文
    ///   - today: 本地日期键 `yyyy-MM-dd`，用于丢弃早于今天的 plan deadline
    public static func parse(_ content: String, today: String) -> Reply {
        let plansBlock = extractBlock(content, tag: "plans")
        let memoriesBlock = extractBlock(plansBlock.rest, tag: "memories")
        let coursesBlock = extractBlock(memoriesBlock.rest, tag: "courses")
        let choicesBlock = extractBlock(coursesBlock.rest, tag: "choices")
        let deadlinesBlock = extractBlock(choicesBlock.rest, tag: "deadlines")

        return Reply(
            text: deadlinesBlock.rest.trimmingCharacters(in: .whitespacesAndNewlines),
            plans: parsePlans(plansBlock.body, today: today),
            memories: parseMemories(memoriesBlock.body),
            courses: parseCourses(coursesBlock.body),
            choices: parseChoices(choicesBlock.body),
            deadlines: parseDeadlines(deadlinesBlock.body)
        )
    }

    // MARK: - 块抽取

    private struct Block {
        let rest: String
        let body: String?
    }

    private static func extractBlock(_ content: String, tag: String) -> Block {
        let open = "<\(tag)>"
        let close = "</\(tag)>"
        guard let openRange = content.range(of: open) else {
            return Block(rest: content, body: nil)
        }
        guard let closeRange = content.range(of: close, range: openRange.upperBound..<content.endIndex) else {
            // 未闭合：半个 JSON 不显示成正文
            return Block(rest: String(content[..<openRange.lowerBound]), body: String(content[openRange.upperBound...]))
        }
        let rest = content.replacingCharacters(in: openRange.lowerBound..<closeRange.upperBound, with: "")
        return Block(rest: rest, body: String(content[openRange.upperBound..<closeRange.lowerBound]))
    }

    private static func array(from body: String) -> [Any]? {
        guard let data = body.data(using: .utf8) else { return nil }
        guard let parsed = try? JSONSerialization.jsonObject(with: data) else { return nil }
        return parsed as? [Any]
    }

    // MARK: - plans

    private static func parsePlans(_ body: String?, today: String) -> [Plan] {
        guard let body, let raw = array(from: body) else { return [] }
        return raw.prefix(plansCap).compactMap { parsePlan($0, today: today) }
    }

    private static func parsePlan(_ value: Any?, today: String) -> Plan? {
        guard let record = value as? [String: Any],
              let titleRaw = record["title"] as? String else { return nil }

        let title = titleRaw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, let stepsRaw = record["steps"] as? [Any] else { return nil }

        let steps = stepsRaw
            .compactMap { $0 as? String }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .prefix(4)
            .map { String($0.prefix(80)) }
        guard !steps.isEmpty else { return nil }

        var deadline: String?
        if let raw = record["deadline"] as? String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if JSONValue.matches(JSONValue.dateRegex, trimmed), trimmed >= today {
                deadline = trimmed
            }
        }

        var time: String?
        if let raw = record["time"] as? String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if JSONValue.matches(JSONValue.shortClockRegex, trimmed) {
                time = trimmed.count < 5 ? "0" + trimmed : trimmed
            }
        }

        var remindIn: Int?
        if let raw = JSONValue.number(record["remindIn"]), raw > 0, raw <= 86_400 {
            remindIn = Int(raw.rounded())
        }

        var priority: PlanPriority?
        if let raw = record["priority"] as? String {
            priority = PlanPriority(rawValue: raw)
        }

        return Plan(
            title: String(title.prefix(24)),
            summary: String(((record["summary"] as? String) ?? "").prefix(60)),
            steps: Array(steps),
            deadline: deadline,
            time: time,
            remindIn: remindIn,
            priority: priority
        )
    }

    // MARK: - memories

    private static func parseMemories(_ body: String?) -> [MemoryEntry] {
        guard let body, let raw = array(from: body) else { return [] }

        let entries: [MemoryEntry] = raw.compactMap { item in
            if let text = item as? String {
                let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                return trimmed.isEmpty ? nil : MemoryEntry(text: String(trimmed.prefix(60)), kind: nil)
            }
            guard let record = item as? [String: Any], let text = record["text"] as? String else { return nil }
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            let kind: MemoryKind = (record["kind"] as? String) == "emotion" ? .emotion : .normal
            return MemoryEntry(text: String(trimmed.prefix(60)), kind: kind)
        }

        return Array(entries.prefix(memoriesCap))
    }

    // MARK: - courses

    private static func parseCourses(_ body: String?) -> [ParsedCourse] {
        guard let body, let raw = array(from: body) else { return [] }
        return raw.prefix(coursesCap).compactMap { CourseRecordParser.parse($0) }
    }

    // MARK: - choices

    private static func parseChoices(_ body: String?) -> [String] {
        guard let body, let raw = array(from: body) else { return [] }
        let choices = raw
            .compactMap { $0 as? String }
            .map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(24)) }
            .filter { !$0.isEmpty }
        return Array(choices.prefix(choicesCap))
    }

    // MARK: - deadlines

    private static func parseDeadlines(_ body: String?) -> [DeadlineProposal] {
        guard let body, let raw = array(from: body) else { return [] }
        return raw.prefix(deadlinesCap).compactMap { parseDeadlineProposal($0) }
    }

    private static func parseDeadlineProposal(_ value: Any?) -> DeadlineProposal? {
        guard let record = value as? [String: Any],
              let titleRaw = record["title"] as? String else { return nil }

        let title = titleRaw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return nil }

        let kind: DeadlineKind
        switch record["kind"] as? String {
        case "exam", "考试": kind = .exam
        case "assignment", "作业": kind = .assignment
        default: return nil
        }

        guard let dateRaw = record["date"] as? String else { return nil }
        let date = dateRaw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard JSONValue.matches(JSONValue.dateRegex, date) else { return nil }

        var time: String?
        if let raw = record["time"] as? String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if JSONValue.matches(JSONValue.shortClockRegex, trimmed) {
                time = trimmed.count < 5 ? "0" + trimmed : trimmed
            }
        }

        var weight: Int?
        if kind == .assignment, let raw = JSONValue.number(record["weight"]), raw > 0 {
            weight = min(100, Int(raw.rounded()))
        }

        var course: String?
        if let raw = record["course"] as? String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { course = String(trimmed.prefix(40)) }
        }

        var scope: String?
        if kind == .exam, let raw = record["scope"] as? String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { scope = String(trimmed.prefix(100)) }
        }

        return DeadlineProposal(
            kind: kind,
            title: String(title.prefix(80)),
            date: date,
            time: time,
            course: course,
            weight: weight,
            scope: scope
        )
    }
}
