import Foundation

/// 服务端错误体：`{ "error": "<code>", "reason"?: string }`，以 HTTP 状态码为准。
public struct APIError: Error, Equatable, Sendable {
    public let status: Int
    public let code: String?
    public let reason: String?

    public init(status: Int, code: String?, reason: String? = nil) {
        self.status = status
        self.code = code
        self.reason = reason
    }

    /// 从错误响应体解析；解析不出来就只留状态码。
    public static func decode(status: Int, data: Data) -> APIError {
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let dictionary = object as? [String: Any] else {
            return APIError(status: status, code: nil)
        }
        let code = dictionary["error"] as? String
        let reason = dictionary["reason"] as? String
        return APIError(status: status, code: code, reason: reason)
    }
}

/// 重试与续期策略，逐条对应 `docs/API-CONTRACT.md` 第 0 节：
/// - 401：用 refresh 换新令牌后重试**一次**；
/// - 429：配额或限流，**不重试**；
/// - 5xx：退避 400ms 重试**一次**；
/// - 其他：成功或在客户端处理。
public enum RetryDecision: Equatable, Sendable {
    case proceed
    case refreshAndRetry
    case retryAfter(milliseconds: Int)
    case fail
}

public enum RetryPolicy {
    public static let serverRetryDelayMilliseconds = 400
    public static let maxServerRetries = 1

    public static func decide(status: Int, didRefresh: Bool, serverRetriesUsed: Int) -> RetryDecision {
        if (200..<300).contains(status) { return .proceed }
        if status == 401 { return didRefresh ? .fail : .refreshAndRetry }
        if status == 429 { return .fail }
        if (500..<600).contains(status) {
            return serverRetriesUsed < maxServerRetries
                ? .retryAfter(milliseconds: serverRetryDelayMilliseconds)
                : .fail
        }
        return .fail
    }
}
