import Foundation

#if canImport(ActivityKit)
import ActivityKit

/// Live Activity 的属性定义。
///
/// 这个文件同时被 App target 和 Widget Extension 编译（两边的类型名、
/// 字段必须完全一致，ActivityKit 才能在锁屏/灵动岛上找到并渲染）。
@available(iOS 16.1, *)
public struct WayMuseActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// 当前状态标题，例如「正在听你说」
        public var title: String
        /// 副标题，例如「今天还有 3 件事」
        public var detail: String
        /// 到期时间（ISO8601）。为空表示这条活动没有倒计时。
        public var dueAt: String

        public init(title: String, detail: String, dueAt: String = "") {
            self.title = title
            self.detail = detail
            self.dueAt = dueAt
        }
    }

    /// 会话名，固定用来区分不同活动
    public var sessionName: String

    public init(sessionName: String) {
        self.sessionName = sessionName
    }
}
#endif