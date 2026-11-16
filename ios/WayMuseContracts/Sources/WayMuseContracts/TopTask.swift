import Foundation

/// 契约模型：字段与 `docs/contract/*.json` 一一对应。
///
/// 只保留契约用例用到的字段（`priority` / `completedAt` 等接入真实数据时再加，
/// 加了也不影响这里——契约用例只比较 id 顺序与计数）。
public struct TopTask: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let text: String
    public let done: Bool

    /// 本地日期键 `yyyy-MM-dd`。缺失或空串都表示「没有截止日期」。
    public let deadline: String?

    public init(id: String, text: String, done: Bool, deadline: String? = nil) {
        self.id = id
        self.text = text
        self.done = done
        self.deadline = deadline
    }

    /// 空串按「无截止」处理——对应 JS 里 `task.deadline && ...` 的语义。
    public var normalizedDeadline: String? {
        guard let deadline, !deadline.isEmpty else { return nil }
        return deadline
    }
}
