import Foundation

struct ChatMessage: Identifiable, Codable {
    enum Role: String, Codable { case user, assistant }
    let id: UUID
    let role: Role
    var text: String

    init(role: Role, text: String) {
        id = UUID()
        self.role = role
        self.text = text
    }
}

struct ChatThread: Identifiable, Codable {
    let id: UUID
    var title: String
    var updatedAt: Date
    var messages: [ChatMessage]
}

enum ChatFailure: LocalizedError {
    case invalidResponse
    case http(Int, String)
    case noContent

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "服务暂时没有返回有效响应。"
        case let .http(code, reason):
            if code == 429 { return "今天的使用额度已达到上限，请稍后再试。" }
            return reason.isEmpty ? "请求失败（\(code)）。" : "请求失败（\(code)）：\(reason)"
        case .noContent: return "这次没有收到回复，请重试。"
        }
    }
}

@MainActor
final class ChatSession: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var threads: [ChatThread] = []
    @Published private(set) var isSending = false
    @Published var errorMessage: String?
    @Published var displayName: String {
        didSet { UserDefaults.standard.set(displayName, forKey: "waymuseDisplayName") }
    }
    @Published private(set) var quotaSummary = "额度加载中"

    private let baseURL = URL(string: "https://waymuse.duckdns.org")!
    private var accessToken: String?
    private let deviceId: String
    private var currentThreadID = UUID()
    private let threadsKey = "waymuseNativeThreads"

    init() {
        displayName = UserDefaults.standard.string(forKey: "waymuseDisplayName") ?? "访客"
        if let existing = UserDefaults.standard.string(forKey: "waymuseDeviceId") {
            deviceId = existing
        } else {
            let created = UUID().uuidString
            UserDefaults.standard.set(created, forKey: "waymuseDeviceId")
            deviceId = created
        }
        if let data = UserDefaults.standard.data(forKey: threadsKey),
           let saved = try? JSONDecoder().decode([ChatThread].self, from: data) {
            threads = saved.sorted { $0.updatedAt > $1.updatedAt }
            if let first = threads.first {
                currentThreadID = first.id
                messages = first.messages
            }
        }
        Task { await refreshQuota() }
    }

    func startNewConversation() {
        guard !isSending else { return }
        saveCurrentConversation()
        currentThreadID = UUID()
        messages = []
        errorMessage = nil
    }

    func selectConversation(_ id: UUID) {
        guard !isSending, id != currentThreadID,
              let thread = threads.first(where: { $0.id == id }) else { return }
        saveCurrentConversation()
        currentThreadID = id
        messages = thread.messages
        errorMessage = nil
    }

    var selectedThreadID: UUID { currentThreadID }

    private func saveCurrentConversation() {
        guard !messages.isEmpty else { return }
        let title = messages.first(where: { $0.role == .user })?.text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .prefix(28).description ?? "新对话"
        let thread = ChatThread(id: currentThreadID, title: title, updatedAt: Date(), messages: messages)
        if let index = threads.firstIndex(where: { $0.id == currentThreadID }) {
            threads[index] = thread
        } else {
            threads.append(thread)
        }
        threads.sort { $0.updatedAt > $1.updatedAt }
        if let data = try? JSONEncoder().encode(threads) {
            UserDefaults.standard.set(data, forKey: threadsKey)
        }
    }

    func send(_ rawText: String) async {
        let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }
        errorMessage = nil
        isSending = true
        defer {
            isSending = false
            saveCurrentConversation()
            Task { await refreshQuota() }
        }

        messages.append(ChatMessage(role: .user, text: text))
        let responseIndex = messages.count
        messages.append(ChatMessage(role: .assistant, text: ""))

        do {
            try await streamReply(at: responseIndex, retryAuth: true)
            if messages[responseIndex].text.isEmpty { throw ChatFailure.noContent }
        } catch {
            if messages.indices.contains(responseIndex), messages[responseIndex].text.isEmpty {
                messages.remove(at: responseIndex)
            }
            errorMessage = error.localizedDescription
        }
    }

    private func streamReply(at index: Int, retryAuth: Bool) async throws {
        if accessToken == nil { try await signInAsGuest() }
        var request = URLRequest(url: baseURL.appendingPathComponent("api/ai/chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken ?? "")", forHTTPHeaderField: "Authorization")
        let history = messages.prefix(index).map { ["role": $0.role.rawValue, "content": $0.text] }
        let payload: [String: Any] = [
            "messages": history,
            "useServerPrompt": true,
            "variables": [:],
            "model": "deepseek-flash",
            "maxTokens": 2048
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let http = response as? HTTPURLResponse else { throw ChatFailure.invalidResponse }
        if http.statusCode == 401 && retryAuth {
            accessToken = nil
            try await signInAsGuest()
            try await streamReply(at: index, retryAuth: false)
            return
        }
        guard http.statusCode == 200 else { throw ChatFailure.http(http.statusCode, "") }

        var accumulated = ""
        for try await line in bytes.lines {
            guard line.hasPrefix("data:") else { continue }
            let dataLine = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            if dataLine == "[DONE]" { break }
            guard let data = dataLine.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let choices = json["choices"] as? [[String: Any]],
                  let delta = choices.first?["delta"] as? [String: Any],
                  let content = delta["content"] as? String else { continue }
            accumulated += content
            messages[index].text = Self.visibleText(accumulated)
        }
    }

    private func signInAsGuest() async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/auth/guest"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "deviceId": deviceId,
            "deviceName": "WayMuse iPhone"
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ChatFailure.invalidResponse }
        guard http.statusCode == 200 else { throw ChatFailure.http(http.statusCode, "") }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = json["accessToken"] as? String else { throw ChatFailure.invalidResponse }
        accessToken = token
    }

    func refreshQuota() async {
        do {
            if accessToken == nil { try await signInAsGuest() }
            var request = URLRequest(url: baseURL.appendingPathComponent("api/me/quota"))
            request.setValue("Bearer \(accessToken ?? "")", forHTTPHeaderField: "Authorization")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let limit = json["dailyLimit"] as? Int,
                  let used = json["dailyUsed"] as? Int else {
                quotaSummary = "额度暂不可用"
                return
            }
            quotaSummary = "DeepSeek 今日剩余 \(max(0, limit - used)) / \(limit)"
        } catch {
            quotaSummary = "额度暂不可用"
        }
    }

    private static func visibleText(_ raw: String) -> String {
        let tags = ["plans", "memories", "courses", "choices", "deadlines"]
        var text = raw
        for tag in tags {
            let pattern = "<\(tag)>(?:[\\s\\S]*?</\(tag)>|[\\s\\S]*)"
            text = text.replacingOccurrences(of: pattern, with: "", options: .regularExpression)
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
