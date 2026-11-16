import XCTest
@testable import WayMuseContracts

/// 用仓库里那份共享 fixture 跑，不在这里抄用例：
/// 用例改动（docs/contract/top3-cases.json）后，这个测试会跟着变。
final class Top3ContractTests: XCTestCase {

    func testEveryCaseInSharedFixture() throws {
        let fixture = try loadFixture(named: "top3-cases")
        let today = try XCTUnwrap(fixture["today"] as? String, "top3-cases.json 缺 today")
        let cases = try XCTUnwrap(fixture["cases"] as? [[String: Any]], "top3-cases.json 缺 cases")
        XCTAssertFalse(cases.isEmpty, "用例为空：fixture 没被打包进来？")

        let decoder = JSONDecoder()

        for testCase in cases {
            let name = (testCase["name"] as? String) ?? "<未命名>"
            let tasksJSON = try JSONSerialization.data(withJSONObject: testCase["tasks"] ?? [])
            let tasks = try decoder.decode([TopTask].self, from: tasksJSON)
            let expect = try XCTUnwrap(testCase["expect"] as? [String: Any], "\(name)：缺 expect")

            let result = TopTaskSelector.select(tasks, today: today)

            if expect.keys.contains("top") {
                if expect["top"] is NSNull {
                    XCTAssertNil(result.top, "\(name)：top 应为 nil")
                } else if let expected = expect["top"] as? String {
                    XCTAssertEqual(result.top?.id, expected, "\(name)：top")
                }
            }
            if let ranked = expect["ranked"] as? [String] {
                XCTAssertEqual(result.ranked.map(\.id), ranked, "\(name)：ranked 顺序必须一致")
            }
            if let display = expect["display"] as? [String] {
                XCTAssertEqual(result.display.map(\.id), display, "\(name)：display 顺序必须一致")
            }
            if let value = expect["openCount"] as? Int {
                XCTAssertEqual(result.openCount, value, "\(name)：openCount")
            }
            if let value = expect["overdueCount"] as? Int {
                XCTAssertEqual(result.overdueCount, value, "\(name)：overdueCount")
            }
            if let value = expect["scheduledCount"] as? Int {
                XCTAssertEqual(result.scheduledCount, value, "\(name)：scheduledCount")
            }
        }
    }

    /// 课程解析的 4 条用例还没移植（`parseCourseText` 尚未转写成 Swift）。
    /// 这条只守住 fixture 在，防止被误删；移植后替换成逐条断言。
    func testCourseParseFixtureIsPresent() throws {
        let fixture = try loadFixture(named: "course-parse-cases")
        let cases = try XCTUnwrap(fixture["cases"] as? [[String: Any]])
        XCTAssertFalse(cases.isEmpty)
    }

    /// 稳定排序是契约要求，单独钉一条：同一天截止必须保持原顺序。
    func testSameDayDeadlinesKeepInputOrder() {
        let tasks = [
            TopTask(id: "second", text: "B", done: false, deadline: "2026-11-16"),
            TopTask(id: "first", text: "A", done: false, deadline: "2026-11-16")
        ]
        let result = TopTaskSelector.select(tasks, today: "2026-11-16")
        XCTAssertEqual(result.ranked.map(\.id), ["second", "first"])
        XCTAssertEqual(result.top?.id, "second")
    }

    private func loadFixture(named name: String) throws -> [String: Any] {
        let url = try XCTUnwrap(
            Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"),
            "找不到 fixture：\(name)"
        )
        let data = try Data(contentsOf: url)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
