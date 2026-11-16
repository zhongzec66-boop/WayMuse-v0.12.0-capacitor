import XCTest
@testable import WayMuseContracts

/// 协议块解析的行为测试。用例是照着 `src/agent.ts` 的 `parseReply` 写的，
/// 但这里不用 JSON fixture——协议块的组合太自由，直接把样例写进测试更清楚。
final class ReplyParserTests: XCTestCase {

    private let today = "2026-11-16"

    func testPlainTextHasNoBlocks() {
        let reply = ReplyParser.parse("今天先做三件事：数学、英语、整理课表。", today: today)
        XCTAssertEqual(reply.text, "今天先做三件事：数学、英语、整理课表。")
        XCTAssertTrue(reply.plans.isEmpty)
        XCTAssertTrue(reply.memories.isEmpty)
        XCTAssertTrue(reply.courses.isEmpty)
        XCTAssertTrue(reply.choices.isEmpty)
        XCTAssertTrue(reply.deadlines.isEmpty)
    }

    func testExtractsAllBlocksAndKeepsTrailingText() {
        let content = """
        <plans>[{"title":"复习高数","summary":"两小时","steps":["看笔记","做题"],"deadline":"2026-11-20","time":"9:05","remindIn":600,"priority":"high"}]</plans>
        <memories>["讨厌早八",{"text":"喜欢散步","kind":"emotion"}]</memories>
        <courses>[{"name":"高等数学","weekday":3,"start":"08:00","end":"09:40","place":"教三-201"}]</courses>
        <choices>[" 现在开始 ","稍后"]</choices>
        <deadlines>[{"kind":"作业","title":"线代作业","date":"2026-11-18","weight":20},{"kind":"exam","title":"高数期中","date":"2026-11-25","time":"9:00","scope":"1-3 章"}]</deadlines>
        先这三件。
        """
        let reply = ReplyParser.parse(content, today: today)

        XCTAssertEqual(reply.text, "先这三件。")

        XCTAssertEqual(reply.plans.count, 1)
        XCTAssertEqual(reply.plans.first?.title, "复习高数")
        XCTAssertEqual(reply.plans.first?.summary, "两小时")
        XCTAssertEqual(reply.plans.first?.steps, ["看笔记", "做题"])
        XCTAssertEqual(reply.plans.first?.deadline, "2026-11-20")
        XCTAssertEqual(reply.plans.first?.time, "09:05")
        XCTAssertEqual(reply.plans.first?.remindIn, 600)
        XCTAssertEqual(reply.plans.first?.priority, .high)

        XCTAssertEqual(reply.memories.count, 2)
        XCTAssertEqual(reply.memories.first?.text, "讨厌早八")
        XCTAssertNil(reply.memories.first?.kind)
        XCTAssertEqual(reply.memories.last?.kind, .emotion)

        XCTAssertEqual(reply.courses.first?.name, "高等数学")
        XCTAssertEqual(reply.courses.first?.weekday, 3)

        XCTAssertEqual(reply.choices, ["现在开始", "稍后"])

        XCTAssertEqual(reply.deadlines.count, 2)
        XCTAssertEqual(reply.deadlines.first?.kind, .assignment)
        XCTAssertEqual(reply.deadlines.first?.weight, 20)
        XCTAssertNil(reply.deadlines.first?.time)
        XCTAssertEqual(reply.deadlines.last?.kind, .exam)
        XCTAssertEqual(reply.deadlines.last?.time, "09:00")
        XCTAssertEqual(reply.deadlines.last?.scope, "1-3 章")
        XCTAssertNil(reply.deadlines.last?.weight)
    }

    func testUnclosedBlockIsNotShownAsText() {
        let reply = ReplyParser.parse("先说一句。<plans>[{\"title\":\"还没写完", today: today)
        XCTAssertEqual(reply.text, "先说一句。")
        XCTAssertTrue(reply.plans.isEmpty)
    }

    func testBrokenJSONDegradesToEmpty() {
        let reply = ReplyParser.parse("<plans>not json at all</plans>正文还在", today: today)
        XCTAssertTrue(reply.plans.isEmpty)
        XCTAssertEqual(reply.text, "正文还在")
    }

    func testCapsAreEnforced() {
        let plans = (1...10).map { "{\"title\":\"P\($0)\",\"steps\":[\"a\"]}" }.joined(separator: ",")
        let choices = (1...10).map { "\"C\($0)\"" }.joined(separator: ",")
        let reply = ReplyParser.parse("<plans>[\(plans)]</plans><choices>[\(choices)]</choices>", today: today)
        XCTAssertEqual(reply.plans.count, 3)
        XCTAssertEqual(reply.choices.count, 4)
    }

    func testPlanStepsAreFilteredAndCapped() {
        let content = #"<plans>[{"title":"T","steps":[" a ","","   ","b","c","d","e"]}]</plans>"#
        let reply = ReplyParser.parse(content, today: today)
        XCTAssertEqual(reply.plans.first?.steps, ["a", "b", "c", "d"])
    }

    func testPlanDeadlineInThePastIsDropped() {
        let content = #"<plans>[{"title":"T","steps":["a"],"deadline":"2026-11-10"}]</plans>"#
        XCTAssertNil(ReplyParser.parse(content, today: today).plans.first?.deadline)
    }

    func testPlanWithoutValidStepsIsDropped() {
        let content = #"<plans>[{"title":"没有步骤","steps":[]},{"steps":["a"]}]</plans>"#
        XCTAssertTrue(ReplyParser.parse(content, today: today).plans.isEmpty)
    }

    func testEmptyMemoriesAreDropped() {
        let content = #"<memories>["  ",{"text":"   "},{"text":"有效"}]</memories>"#
        let reply = ReplyParser.parse(content, today: today)
        XCTAssertEqual(reply.memories.count, 1)
        XCTAssertEqual(reply.memories.first?.text, "有效")
        XCTAssertEqual(reply.memories.first?.kind, .normal)
    }
}

final class CourseRecordParserTests: XCTestCase {

    func testWeekdaySevenBecomesSunday() {
        let payload: [String: Any] = ["name": "大学物理", "weekday": 7, "period": 3, "place": " 物理楼 "]
        let course = CourseRecordParser.parse(payload)
        XCTAssertEqual(course?.weekday, 0)
        // 第 3 节 → slot 1 → 10:00-11:40
        XCTAssertEqual(course?.start, "10:00")
        XCTAssertEqual(course?.end, "11:40")
        XCTAssertEqual(course?.place, "物理楼")
    }

    func testMissingTimesAndPeriodIsRejected() {
        let withoutTime: [String: Any] = ["name": "X", "weekday": 1]
        XCTAssertNil(CourseRecordParser.parse(withoutTime))
    }

    func testEmptyNameIsRejected() {
        let payload: [String: Any] = ["name": "   ", "weekday": 1, "start": "08:00", "end": "09:40"]
        XCTAssertNil(CourseRecordParser.parse(payload))
    }

    func testWeeksAreDedupedSortedAndRangeLimited() {
        let payload: [String: Any] = [
            "name": "X", "weekday": 2, "start": "08:00", "end": "09:40",
            "weeks": [3, 1, 3, 99, 0]
        ]
        XCTAssertEqual(CourseRecordParser.parse(payload)?.weeks, [1, 3])
    }

    func testFullWidthColonIsAccepted() {
        let payload: [String: Any] = ["name": "X", "weekday": 1, "start": "8：05", "end": "9：45"]
        let course = CourseRecordParser.parse(payload)
        XCTAssertEqual(course?.start, "08:05")
        XCTAssertEqual(course?.end, "09:45")
    }
}
