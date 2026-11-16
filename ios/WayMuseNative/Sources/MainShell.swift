import SwiftUI

enum WayPage: String, CaseIterable, Identifiable {
    case chat = "聊天"
    case today = "今日"
    case courses = "课表"
    case memories = "记忆"
    case settings = "设置"

    var id: Self { self }

    var symbol: String {
        switch self {
        case .chat: return "bubble.left.and.bubble.right"
        case .today: return "checklist"
        case .courses: return "calendar"
        case .memories: return "brain.head.profile"
        case .settings: return "gearshape"
        }
    }
}

struct MainShell: View {
    @State private var page: WayPage = .chat
    @AppStorage("duoAppearance") private var duoAppearance = false
    @EnvironmentObject private var session: ChatSession

    var body: some View {
        GeometryReader { geometry in
            let useDuo = duoAppearance && geometry.size.width >= 350
            Group {
                if useDuo {
                    HStack(spacing: 0) {
                        content
                        duoRail
                    }
                } else {
                    VStack(spacing: 0) {
                        content
                        bottomTabs
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            HStack {
                Text(page.rawValue)
                    .font(.title2.weight(.semibold))
                Spacer()
                if page == .chat {
                    Button {
                        session.startNewConversation()
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                    .accessibilityLabel("新对话")
                }
            }
            .padding(.horizontal, 18)
            .frame(height: 52)
            .background(Color(.systemBackground))

            Divider()

            Group {
                switch page {
                case .chat: ChatView()
                case .today: PlaceholderPage(title: "今日", detail: "今日计划正在接入真实数据。")
                case .courses: PlaceholderPage(title: "课表", detail: "课表导入和编辑正在开发。")
                case .memories: PlaceholderPage(title: "记忆", detail: "记忆管理正在接入真实数据。")
                case .settings: SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var bottomTabs: some View {
        HStack(spacing: 0) {
            ForEach(WayPage.allCases) { item in
                tabButton(item, vertical: false)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) { Divider() }
    }

    private var duoRail: some View {
        VStack(spacing: 12) {
            ForEach(WayPage.allCases) { item in
                tabButton(item, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
        .frame(width: 62)
        .background(Color(.secondarySystemGroupedBackground))
        .overlay(alignment: .leading) { Divider() }
    }

    private func tabButton(_ item: WayPage, vertical: Bool) -> some View {
        Button {
            page = item
        } label: {
            VStack(spacing: 3) {
                Image(systemName: item.symbol)
                    .font(.system(size: 19, weight: .medium))
                Text(item.rawValue)
                    .font(.system(size: 10))
            }
            .foregroundStyle(page == item ? Color.accentColor : Color.secondary)
            .frame(width: vertical ? 52 : nil, height: vertical ? 48 : 43)
            .frame(maxWidth: vertical ? nil : .infinity)
            .background(page == item && vertical ? Color.accentColor.opacity(0.12) : Color.clear)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.rawValue)
        .accessibilityAddTraits(page == item ? .isSelected : [])
    }
}

private struct PlaceholderPage: View {
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: 10) {
            Text(title).font(.headline)
            Text(detail).font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
    }
}

private struct SettingsView: View {
    @AppStorage("duoAppearance") private var duoAppearance = false

    var body: some View {
        Form {
            Toggle("iPhone Duo 界面", isOn: $duoAppearance)
            Text("开启后使用顶部工具栏和右侧竖向胶囊导航。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}
