import Foundation

struct ChatMessage: Identifiable {
    enum Role: String { case user, assistant }
    let id = UUID()
    let role: Role
    var text: String
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
    @Published private(set) var isSending = false
    @Published var errorMessage: String?

    private let baseURL = URL(string: "https://waymuse.duckdns.org")!
    private var accessToken: String?
    private let deviceId: String

    init() {
        if let existing = UserDefaults.standard.string(forKey: "waymuseDeviceId") {
            deviceId = existing
        } else {
            let created = UUID().uuidString
            UserDefaults.standard.set(created, forKey: "waymuseDeviceId")
            deviceId = created
        }
    }

    func startNewConversation() {
        guard !isSending else { return }
        messages = []
        errorMessage = nil
    }

    func send(_ rawText: String) async {
        let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }
        errorMessage = nil
        isSending = true
        defer { isSending = false }

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
