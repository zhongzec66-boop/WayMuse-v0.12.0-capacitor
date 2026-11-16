import Foundation

public struct APIConfig: Sendable {
    public let baseURL: URL

    public init(baseURL: URL = URL(string: "https://waymuse.duckdns.org")!) {
        self.baseURL = baseURL
    }
}

public struct AuthTokens: Codable, Equatable, Sendable {
    public var accessToken: String
    public var refreshToken: String

    public init(accessToken: String, refreshToken: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }
}

/// 令牌存取。App 里换成 Keychain 实现即可，接口不变。
public final class TokenStore: @unchecked Sendable {
    private let lock = NSLock()
    private var tokens: AuthTokens?

    public init(tokens: AuthTokens? = nil) {
        self.tokens = tokens
    }

    public func read() -> AuthTokens? {
        lock.lock(); defer { lock.unlock() }
        return tokens
    }

    public func write(_ value: AuthTokens?) {
        lock.lock(); defer { lock.unlock() }
        tokens = value
    }
}

/// 网络层抽象：测试里注入假实现，生产用 `URLSessionTransport`。
public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
    /// 逐行吐出（不含行尾换行）；行内不保证是完整 JSON。
    func streamLines(_ request: URLRequest) -> AsyncThrowingStream<String, Error>
}

public struct URLSessionTransport: HTTPTransport {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError(status: -1, code: "not_http")
        }
        return (data, http)
    }

    public func streamLines(_ request: URLRequest) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let (bytes, response) = try await session.bytes(for: request)
                    guard let http = response as? HTTPURLResponse else {
                        continuation.finish(throwing: APIError(status: -1, code: "not_http"))
                        return
                    }
                    if !(200..<300).contains(http.statusCode) {
                        var body = ""
                        for try await line in bytes.lines { body += line }
                        continuation.finish(
                            throwing: APIError.decode(status: http.statusCode, data: Data(body.utf8))
                        )
                        return
                    }
                    for try await line in bytes.lines {
                        continuation.yield(line)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

public struct ChatMessage: Codable, Equatable, Sendable {
    public let role: String
    public let content: String

    public init(role: String, content: String) {
        self.role = role
        self.content = content
    }

    public static func user(_ text: String) -> ChatMessage {
        ChatMessage(role: "user", content: text)
    }

    public static func assistant(_ text: String) -> ChatMessage {
        ChatMessage(role: "assistant", content: text)
    }
}

/// 按 `docs/API-CONTRACT.md` 实现的最小客户端：认证、SSE 聊天、TTS。
public final class APIClient: @unchecked Sendable {
    public let config: APIConfig
    public let tokens: TokenStore
    private let transport: HTTPTransport

    public init(
        config: APIConfig = APIConfig(),
        transport: HTTPTransport = URLSessionTransport(),
        tokens: TokenStore = TokenStore()
    ) {
        self.config = config
        self.transport = transport
        self.tokens = tokens
    }

    // MARK: - 认证

    public func guestLogin(deviceId: String, deviceName: String) async throws -> AuthTokens {
        let request = try makeRequest(
            path: "/api/auth/guest",
            body: ["deviceId": deviceId, "deviceName": deviceName]
        )
        let data = try await sendWithRetry(request)
        return try decodeTokens(data, fallbackRefreshToken: nil)
    }

    /// 用 refresh token 换新令牌。**不走重试**，避免 401 递归。
    @discardableResult
    public func refresh() async throws -> AuthTokens {
        guard let current = tokens.read() else {
            throw APIError(status: 401, code: "no_token")
        }
        let request = try makeRequest(
            path: "/api/auth/refresh",
            body: ["refreshToken": current.refreshToken]
        )
        let (data, response) = try await transport.send(request)
        guard (200..<300).contains(response.statusCode) else {
            throw APIError.decode(status: response.statusCode, data: data)
        }
        let fresh = try decodeTokens(data, fallbackRefreshToken: current.refreshToken)
        tokens.write(fresh)
        return fresh
    }

    // MARK: - 聊天（SSE）

    /// 流式聊天：每段增量文本回调一次，返回拼好的全文。
    /// 响应头（`x-waymuse-kb` 等）目前还没透出，见 README 待办。
    public func chat(
        messages: [ChatMessage],
        useServerPrompt: Bool = true,
        onDelta: (@Sendable (String) -> Void)? = nil
    ) async throws -> ChatOutcome {
        let body: [String: Any] = [
            "messages": messages.map { ["role": $0.role, "content": $0.content] },
            "useServerPrompt": useServerPrompt,
        ]
        let request = try makeRequest(path: "/api/ai/chat", body: body)

        var buffer = SSELineBuffer()
        var text = ""
        var sawDone = false

        for try await line in transport.streamLines(request) {
            for event in buffer.feed(line + "\n") {
                switch event.kind {
                case .done:
                    sawDone = true
                case .payload(let payload):
                    guard let delta = ChatStreamParser.delta(from: payload) else { continue }
                    text += delta.content
                    onDelta?(delta.content)
                }
            }
        }
        return ChatOutcome(text: text, sawDone: sawDone)
    }

    // MARK: - 语音合成

    public func tts(text: String, voiceId: String? = nil, instruction: String? = nil) async throws -> Data {
        var body: [String: Any] = ["text": text]
        if let voiceId { body["voiceId"] = voiceId }
        if let instruction { body["instruction"] = instruction }
        let request = try makeRequest(path: "/api/voice/tts", body: body)

        // 走统一的重试包装：401 要续期重试一次，429 直接抛错，5xx 退避一次。
        return try await sendWithRetry(request)
    }

    // MARK: - 内部

    private func makeRequest(path: String, method: String = "POST", body: [String: Any]? = nil) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: config.baseURL) else {
            throw APIError(status: -1, code: "bad_url")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken = tokens.read()?.accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        return request
    }

    private func sendWithRetry(_ request: URLRequest) async throws -> Data {
        var current = request
        var didRefresh = false
        var serverRetriesUsed = 0

        while true {
            let (data, response) = try await transport.send(current)
            switch RetryPolicy.decide(
                status: response.statusCode,
                didRefresh: didRefresh,
                serverRetriesUsed: serverRetriesUsed
            ) {
            case .proceed:
                return data
            case .refreshAndRetry:
                didRefresh = true
                let fresh = try await refresh()
                current.setValue("Bearer \(fresh.accessToken)", forHTTPHeaderField: "Authorization")
            case .retryAfter(let milliseconds):
                serverRetriesUsed += 1
                try await Task.sleep(nanoseconds: UInt64(milliseconds) * 1_000_000)
            case .fail:
                throw APIError.decode(status: response.statusCode, data: data)
            }
        }
    }

    private struct TokenResponse: Decodable {
        let accessToken: String
        let refreshToken: String?
    }

    private func decodeTokens(_ data: Data, fallbackRefreshToken: String?) throws -> AuthTokens {
        guard let parsed = try? JSONDecoder().decode(TokenResponse.self, from: data) else {
            throw APIError(status: -1, code: "bad_token_response")
        }
        guard let refresh = parsed.refreshToken ?? fallbackRefreshToken else {
            throw APIError(status: -1, code: "missing_refresh_token")
        }
        return AuthTokens(accessToken: parsed.accessToken, refreshToken: refresh)
    }
}
