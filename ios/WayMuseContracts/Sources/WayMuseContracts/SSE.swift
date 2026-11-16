import Foundation

/// SSE 的一条事件。
public struct SSEEvent: Equatable, Sendable {
    public enum Kind: Equatable, Sendable {
        /// `data: {...}` 的负载（已去掉前缀与一个空格）
        case payload(String)
        /// `data: [DONE]`
        case done
    }

    public let kind: Kind
}

/// 按行切的 SSE 缓冲。
///
/// 为什么要单独一个类型：网络 chunk **不保证**按行对齐，
/// 一行 JSON 可能被拆成两个 chunk，也可能一个 chunk 里有多行。
/// 这里只做「攒够一行再交出去」，不解析业务。
public struct SSELineBuffer {
    private var pending = ""

    public init() {}

    /// 喂一段原始文本，返回这次能完整解析出的事件。
    public mutating func feed(_ chunk: String) -> [SSEEvent] {
        pending += chunk
        var events: [SSEEvent] = []

        // 注意：Swift 里 "\r\n" 是**一个 Character**（字素簇），
        // 用 Character 找 "\n" 会漏掉所有 CRLF 行。必须按 Unicode 标量找。
        while true {
            let scalars = pending.unicodeScalars
            guard let newline = scalars.firstIndex(of: "\n") else { break }

            let nextScalarIndex = scalars.index(after: newline)

            // 直接按标量视图切片：不能先 samePosition(in: pending) 再切，
            // 因为 CRLF 中间的 LF 不是 Character 边界，映射会失败并提前退出。
            var line = String(scalars[..<newline])
            pending = String(scalars[nextScalarIndex...])

            if line.hasSuffix("\r") { line.removeLast() }
            guard let event = Self.event(from: line) else { continue }
            events.append(event)
        }
        return events
    }

    /// 一条完整的行 → 事件。空行、注释行（`:` 开头）、非 `data:` 行都返回 nil。
    static func event(from line: String) -> SSEEvent? {
        guard !line.isEmpty, !line.hasPrefix(":") else { return nil }
        guard line.hasPrefix("data:") else { return nil }

        var payload = String(line.dropFirst("data:".count))
        if payload.hasPrefix(" ") { payload.removeFirst() }
        if payload.trimmingCharacters(in: .whitespaces) == "[DONE]" {
            return SSEEvent(kind: .done)
        }
        return payload.isEmpty ? nil : SSEEvent(kind: .payload(payload))
    }
}

/// 一个 SSE chunk 里能取到的增量文本。
public struct ChatDelta: Equatable, Sendable {
    public let content: String
    /// 思维链增量：按契约**不展示**，保留字段只为完整解析。
    public let reasoning: String?
}

/// 解析 `/api/ai/chat` 的单个 chunk：
/// `{ "choices": [{ "delta": { "content": "…" } }] }`
public enum ChatStreamParser {
    public static func delta(from payload: String) -> ChatDelta? {
        guard let data = payload.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data),
              let root = object as? [String: Any],
              let choices = root["choices"] as? [Any],
              let first = choices.first as? [String: Any],
              let delta = first["delta"] as? [String: Any] else { return nil }

        let content = (delta["content"] as? String) ?? ""
        let reasoning = delta["reasoning_content"] as? String
        if content.isEmpty && (reasoning?.isEmpty ?? true) { return nil }
        return ChatDelta(content: content, reasoning: reasoning)
    }
}

/// 流式聊天的结果。
public struct ChatOutcome: Equatable, Sendable {
    public let text: String
    public let sawDone: Bool
}
