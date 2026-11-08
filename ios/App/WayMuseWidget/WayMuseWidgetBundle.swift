import WidgetKit
import SwiftUI

@main
struct WayMuseWidgetBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.1, *) {
            WayMuseLiveActivity()
        }
    }
}

@available(iOS 16.1, *)
struct WayMuseLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WayMuseActivityAttributes.self) { context in
            HStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.title)
                        .font(.headline)
                    Text(context.state.detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .activityBackgroundTint(Color(red: 0.97, green: 0.95, blue: 0.92))
            .activitySystemActionForegroundColor(
                Color(red: 0.15, green: 0.39, blue: 0.66)
            )
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "sparkles")
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                        .font(.subheadline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.detail)
                        .font(.caption2)
                        .lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "sparkles")
            } compactTrailing: {
                Text(context.state.title)
                    .font(.caption2)
                    .lineLimit(1)
            } minimal: {
                Image(systemName: "sparkles")
            }
        }
    }
}