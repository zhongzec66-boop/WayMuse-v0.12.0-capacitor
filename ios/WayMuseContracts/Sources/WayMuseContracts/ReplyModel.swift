import Foundation

/// 回复里的一个计划（`<plans>` 块）。字段与 `src/agent.ts` 的 `Plan` 对应。
public enum PlanPriority: String, Sendable, Equatable {
    case high
    case medium
    case low
}

public struct Plan: Equatable, Sendable {
    public let title: String
    public let summary: String
    public let steps: [String]
    /// 只有「不早于今天」的日期才会保留（模型偶尔给出旧日期）。
    public let deadline: String?
    public let time: String?
    /// 「多少秒后提醒」，取整；超出 0…86400 丢弃。
    public let remindIn: Int?
    public let priority: PlanPriority?
}

/// 记忆条目的类型：情绪类会单独展示。
public enum MemoryKind: String, Sendable, Equatable {
    case emotion
    case normal
}

public struct MemoryEntry: Equatable, Sendable {
    public let text: String
    public let kind: MemoryKind?
}

/// 一条课程记录（`<courses>` 块与课表导入共用同一条规范化规则）。
public struct ParsedCourse: Equatable, Sendable {
    public let name: String
    /// 0 = 周日，1…6 = 周一到周六（与 JS 侧 `weekday % 7` 一致）。
    public let weekday: Int
    public let start: String
    public let end: String
    public let place: String
    public let weeks: [Int]?
}

public enum DeadlineKind: String, Sendable, Equatable {
    case assignment
    case exam
}

/// 作业 / 考试提议：只在用户点确认后才写入。
public struct DeadlineProposal: Equatable, Sendable {
    public let kind: DeadlineKind
    public let title: String
    /// `yyyy-MM-dd`
    public let date: String
    /// `HH:mm`
    public let time: String?
    public let course: String?
    /// 仅作业：占总成绩比例 1…100。
    public let weight: Int?
    /// 仅考试：考试范围。
    public let scope: String?
}

/// 一条助手回复拆出来的全部内容。
public struct Reply: Equatable, Sendable {
    public let text: String
    public let plans: [Plan]
    public let memories: [MemoryEntry]
    public let courses: [ParsedCourse]
    public let choices: [String]
    public let deadlines: [DeadlineProposal]

    public static let empty = Reply(
        text: "", plans: [], memories: [], courses: [], choices: [], deadlines: []
    )
}
