import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

/// 灵动岛 / 锁屏实时活动的桥。
///
/// 放在 App target 里（不是 SPM 插件），因为它要用到 WayMuseActivityAttributes
/// 这个同时被 Widget Extension 编译的类型。注册方式仍然是 packageClassList
/// 里的 ObjC 类名，所以不需要 import。
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve([
                "supported": ActivityAuthorizationInfo().areActivitiesEnabled
            ])
        } else {
            call.resolve(["supported": false])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("live-activity-unsupported")
            return
        }
        let title = call.getString("title") ?? "WayMuse"
        let detail = call.getString("detail") ?? ""

        Task {
            do {
                // 先收掉旧的，避免叠一堆活动
                for activity in Activity<WayMuseActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
                let attributes = WayMuseActivityAttributes(sessionName: "waymuse")
                let state = WayMuseActivityAttributes.ContentState(
                    title: title,
                    detail: detail
                )
                let content = ActivityContent(state: state, staleDate: nil)
                let activity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                call.resolve(["id": activity.id])
            } catch {
                call.reject("live-activity-start-failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("live-activity-unsupported")
            return
        }
        let title = call.getString("title") ?? "WayMuse"
        let detail = call.getString("detail") ?? ""
        Task {
            let state = WayMuseActivityAttributes.ContentState(
                title: title,
                detail: detail
            )
            let content = ActivityContent(state: state, staleDate: nil)
            for activity in Activity<WayMuseActivityAttributes>.activities {
                await activity.update(content)
            }
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task {
            for activity in Activity<WayMuseActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}