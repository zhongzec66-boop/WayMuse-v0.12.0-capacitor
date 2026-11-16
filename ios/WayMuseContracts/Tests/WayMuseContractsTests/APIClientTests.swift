import XCTest
@testable import WayMuseContracts

// MARK: - SSE 行缓冲

final class SSELineBufferTests: XCTestCase {

    func testLineSplitAcrossChunks() {
        var buffer = SSELineBuffer()
        XCTAssertTrue(buffer.feed("data: {\"a\":").isEmpty)
        let events = buffer.feed("1}\n")
        XCTAssertEqual(events, [SSEEvent(kind: .payload("{\"a\":1}"))])
    }

    func testMultipleLinesInOneChunk() {
        var buffer = SSELineBuffer()
        let events = buffer.feed("data: one\n\ndata: two\n")
        XCTAssertEqual(events, [
            SSEEvent(kind: .payload("one")),
            SSEEvent(kind: .payload("two")),
        ])
    }

    func testCRLFAndCommentsAndNonDataLinesAreIgnored() {
        var buffer = SSELineBuffer()
        let events = buffer.feed(": keep-alive\r\nevent: ping\r\ndata: x\r\n")
        XCTAssertEqual(events, [SSEEvent(kind: .payload("x"))])
    }

    func testDoneMarker() {
        var buffer = SSELineBuffer()
        XCTAssertEqual(buffer.feed("data: [DONE]\n"), [SSEEvent(kind: .done)])
    }

    func testEmptyDataLineIsDropped() {
        var buffer = SSELineBuffer()
        XCTAssertTrue(buffer.feed("data: \n").isEmpty)
    }
}

// MARK: - 聊天增量解析

final class ChatStreamParserTests: XCTestCase {

    func testContentDelta() {
        let delta = ChatStreamParser.delta(from: #"{"choices":[{"delta":{"content":"你好"}}]}"#)
        XCTAssertEqual(delta?.content, "你好")
        XCTAssertNil(delta?.reasoning)
    }

    func testReasoningOnlyIsParsedButNotContent() {
        let delta = ChatStreamParser.delta(from: #"{"choices":[{"delta":{"reasoning_content":"想一下"}}]}"#)
        XCTAssertEqual(delta?.content, "")
        XCTAssertEqual(delta?.reasoning, "想一下")
    }

    func testMalformedChunkReturnsNil() {
        XCTAssertNil(ChatStreamParser.delta(from: "not json"))
        XCTAssertNil(ChatStreamParser.delta(from: #"{"choices":[]}"#))
    }
}

// MARK: - 重试策略

final class RetryPolicyTests: XCTestCase {

    func testSuccessProceeds() {
        XCTAssertEqual(RetryPolicy.decide(status: 200, didRefresh: false, serverRetriesUsed: 0), .proceed)
    }

    func testUnauthorizedRefreshesOnceThenFails() {
        XCTAssertEqual(RetryPolicy.decide(status: 401, didRefresh: false, serverRetriesUsed: 0), .refreshAndRetry)
        XCTAssertEqual(RetryPolicy.decide(status: 401, didRefresh: true, serverRetriesUsed: 0), .fail)
    }

    func testTooManyRequestsNeverRetries() {
        XCTAssertEqual(RetryPolicy.decide(status: 429, didRefresh: false, serverRetriesUsed: 0), .fail)
        XCTAssertEqual(RetryPolicy.decide(status: 429, didRefresh: true, serverRetriesUsed: 1), .fail)
    }

    func testServerErrorRetriesOnceWithBackoff() {
        XCTAssertEqual(
            RetryPolicy.decide(status: 503, didRefresh: false, serverRetriesUsed: 0),
            .retryAfter(milliseconds: 400)
        )
        XCTAssertEqual(RetryPolicy.decide(status: 503, didRefresh: false, serverRetriesUsed: 1), .fail)
    }

    func testClientErrorFails() {
        XCTAssertEqual(RetryPolicy.decide(status: 400, didRefresh: false, serverRetriesUsed: 0), .fail)
    }
}

// MARK: - 客户端（假网络层）

private final class FakeTransport: HTTPTransport, @unchecked Sendable {
    struct Response {
        let status: Int
        let body: Data
    }

    private let lock = NSLock()
    private var responses: [Response] = []
    private var chunks: [String] = []
    private(set) var recordedRequests: [URLRequest] = []

    func enqueue(status: Int, body: String) {
        lock.lock(); defer { lock.unlock() }
        responses.append(Response(status: status, body: Data(body.utf8)))
    }

    func enqueueStream(_ chunks: [String]) {
        lock.lock(); defer { lock.unlock() }
        self.chunks = chunks
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        lock.lock()
        recordedRequests.append(request)
        guard !responses.isEmpty else {
            lock.unlock()
            throw APIError(status: -1, code: "no_response_queued")
        }
        let next = responses.removeFirst()
        lock.unlock()

        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: next.status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        return (next.body, response)
    }

    func streamLines(_ request: URLRequest) -> AsyncThrowingStream<String, Error> {
        lock.lock()
        recordedRequests.append(request)
        let payload = chunks
        lock.unlock()

        return AsyncThrowingStream { continuation in
            for chunk in payload { continuation.yield(chunk) }
            continuation.finish()
        }
    }
}

final class APIClientTests: XCTestCase {

    private func makeClient(transport: FakeTransport, tokens: AuthTokens? = nil) -> APIClient {
        APIClient(
            config: APIConfig(baseURL: URL(string: "https://example.test")!),
            transport: transport,
            tokens: TokenStore(tokens: tokens)
        )
    }

    func testGuestLoginDecodesTokens() async throws {
        let transport = FakeTransport()
        transport.enqueue(status: 200, body: #"{"accessToken":"a1","refreshToken":"r1"}"#)
        let client = makeClient(transport: transport)

        let tokens = try await client.guestLogin(deviceId: "d", deviceName: "iPhone")
        XCTAssertEqual(tokens, AuthTokens(accessToken: "a1", refreshToken: "r1"))
        XCTAssertEqual(transport.recordedRequests.first?.url?.path, "/api/auth/guest")
    }

    func testUnauthorizedTriggersRefreshAndRetriesWithNewToken() async throws {
        let transport = FakeTransport()
        let old = AuthTokens(accessToken: "old", refreshToken: "r1")
        let client = makeClient(transport: transport, tokens: old)

        transport.enqueue(status: 401, body: #"{"error":"unauthorized"}"#)          // 第一次 tts
        transport.enqueue(status: 200, body: #"{"accessToken":"new","refreshToken":"r2"}"#) // refresh
        transport.enqueue(status: 200, body: "audio")                               // 重试 tts

        let data = try await client.tts(text: "你好")
        XCTAssertEqual(data, Data("audio".utf8))

        XCTAssertEqual(transport.recordedRequests.count, 3)
        XCTAssertEqual(transport.recordedRequests[1].url?.path, "/api/auth/refresh")
        XCTAssertEqual(
            transport.recordedRequests[2].value(forHTTPHeaderField: "Authorization"),
            "Bearer new"
        )
        XCTAssertEqual(client.tokens.read(), AuthTokens(accessToken: "new", refreshToken: "r2"))
    }

    func testTooManyRequestsSurfacesErrorWithoutRetry() async throws {
        let transport = FakeTransport()
        let client = makeClient(transport: transport, tokens: AuthTokens(accessToken: "a", refreshToken: "r"))
        transport.enqueue(status: 429, body: #"{"error":"quota_exceeded","reason":"daily"}"#)

        do {
            _ = try await client.tts(text: "你好")
            XCTFail("应当抛错")
        } catch let error as APIError {
            XCTAssertEqual(error.status, 429)
            XCTAssertEqual(error.code, "quota_exceeded")
            XCTAssertEqual(error.reason, "daily")
        }
        XCTAssertEqual(transport.recordedRequests.count, 1)
    }

    func testChatAssemblesFullTextAndSeesDone() async throws {
        let transport = FakeTransport()
        let client = makeClient(transport: transport, tokens: AuthTokens(accessToken: "a", refreshToken: "r"))
        transport.enqueueStream([
            #"data: {"choices":[{"delta":{"content":"你"}}]}"#,
            #"data: {"choices":[{"delta":{"content":"好"}}]}"#,
            "data: [DONE]",
        ])

        var deltas: [String] = []
        let outcome = try await client.chat(messages: [.user("hi")]) { deltas.append($0) }

        XCTAssertEqual(outcome.text, "你好")
        XCTAssertTrue(outcome.sawDone)
        XCTAssertEqual(deltas, ["你", "好"])
        XCTAssertEqual(transport.recordedRequests.first?.url?.path, "/api/ai/chat")
    }

    func testChatIgnoresReasoningChunks() async throws {
        let transport = FakeTransport()
        let client = makeClient(transport: transport, tokens: AuthTokens(accessToken: "a", refreshToken: "r"))
        transport.enqueueStream([
            #"data: {"choices":[{"delta":{"reasoning_content":"思考"}}]}"#,
            #"data: {"choices":[{"delta":{"content":"答"}}]}"#,
        ])

        let outcome = try await client.chat(messages: [.user("hi")])
        XCTAssertEqual(outcome.text, "答")
        XCTAssertFalse(outcome.sawDone)
    }
}
