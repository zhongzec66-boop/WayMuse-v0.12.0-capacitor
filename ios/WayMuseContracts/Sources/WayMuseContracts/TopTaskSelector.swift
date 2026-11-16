import Foundation

/// `selectTopTasks` 的输出。字段与 `src/todayTop3.ts` 的 `TopTasks` 对应。
public struct TopTaskSelection: Equatable, Sendable {
    /// 最该做的那件；没有未完成任务时为 nil。
    public let top: TopTask?
    /// 排名后的候选：逾期 → 有截止（未逾期）→ 无截止。
    public let ranked: [TopTask]
    /// 给界面用的顺序：top 在前，其余保持原数组顺序。
    public let display: [TopTask]
    public let openCount: Int
    public let overdueCount: Int
    public let scheduledCount: Int
    public let unscheduledCount: Int
}

/// 「今日三件」选取规则，行为对齐 `src/todayTop3.ts` 的 `selectTopTasks`。
///
/// 规则（不要「优化」）：
/// 1. 只看未完成；
/// 2. 逾期（deadline < today）排最前，按 deadline 升序；
/// 3. 其次是有截止但未逾期的（deadline >= today），按 deadline 升序；
/// 4. 最后是没有截止日期的，保持原数组顺序；
/// 5. 同一天截止保持原数组顺序（**稳定排序**，Swift 的 `sorted` 不保证稳定，这里自己兜）；
/// 6. `today` 是本地日期键，按字符串比较。
///
/// 用例：`Tests/WayMuseContractsTests/Fixtures/top3-cases.json`（11 条）。
public enum TopTaskSelector {

    public static func select(_ tasks: [TopTask], today: String) -> TopTaskSelection {
        let open = tasks.filter { !$0.done }

        let overdue = stableSorted(
            open.compactMap { task -> (task: TopTask, deadline: String)? in
                guard let deadline = task.normalizedDeadline, deadline < today else { return nil }
                return (task, deadline)
            }
        ) { $0.deadline < $1.deadline }
        .map(\.task)

        let scheduled = stableSorted(
            open.compactMap { task -> (task: TopTask, deadline: String)? in
                guard let deadline = task.normalizedDeadline, deadline >= today else { return nil }
                return (task, deadline)
            }
        ) { $0.deadline < $1.deadline }
        .map(\.task)

        let unscheduled = open.filter { $0.normalizedDeadline == nil }

        let ranked = overdue + scheduled + unscheduled
        let top = ranked.first
        let display: [TopTask]
        if let top {
            display = [top] + open.filter { $0.id != top.id }
        } else {
            display = []
        }

        return TopTaskSelection(
            top: top,
            ranked: ranked,
            display: display,
            openCount: open.count,
            overdueCount: overdue.count,
            scheduledCount: scheduled.count,
            unscheduledCount: unscheduled.count
        )
    }

    /// 「还剩 N 个任务」里的 N：不含最优先那一件。
    public static func remainingAfter(_ openCount: Int) -> Int {
        max(0, openCount - 1)
    }

    /// 稳定排序：比较相等时按原下标。Swift 标准库的 sort 不保证稳定。
    private static func stableSorted<T>(
        _ items: [T],
        by areInIncreasingOrder: (T, T) -> Bool
    ) -> [T] {
        items.enumerated().sorted { lhs, rhs in
            if areInIncreasingOrder(lhs.element, rhs.element) { return true }
            if areInIncreasingOrder(rhs.element, lhs.element) { return false }
            return lhs.offset < rhs.offset
        }.map(\.element)
    }
}
