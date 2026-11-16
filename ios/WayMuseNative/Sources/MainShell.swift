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
            let expanded = useDuo && geometry.size.width >= 700
            Group {
                if expanded {
                    HStack(spacing: 12) {
                        duoContext
                            .frame(width: min(280, geometry.size.width * 0.29))
                        content
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                        duoRail
                    }
                    .padding(12)
                } else if useDuo {
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
            .modifier(NativeGlass())

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
        .modifier(NativeGlass())
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
        .modifier(NativeGlass())
        .overlay(alignment: .leading) { Divider() }
    }

    private var duoContext: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("WayMuse")
                .font(.title2.weight(.bold))
            Text(page == .chat ? "当前会话" : page.rawValue)
                .font(.headline)
            if page == .chat {
                Button("新对话") { session.startNewConversation() }
                    .buttonStyle(.borderedProminent)
                if session.messages.isEmpty {
                    Text("还没有消息")
                        .foregroundStyle(.secondary)
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            ForEach(session.messages.filter { $0.role == .user }) { message in
                                Text(message.text)
                                    .lineLimit(2)
                                    .font(.subheadline)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }
            } else {
                Text("此区域将在功能接入后展示相关内容。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .frame(maxHeight: .infinity)
        .modifier(NativeGlass())
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
            .clipShape(Capsule())
            .modifier(NativeGlass())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.rawValue)
        .accessibilityAddTraits(page == item ? .isSelected : [])
    }
}

private struct NativeGlass: ViewModifier {
    var active = true

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            if active {
                content.glassEffect(.regular, in: RoundedRectangle(cornerRadius: 20))
            } else {
                content
            }
        } else {
            content.background(active ? AnyShapeStyle(Material.ultraThin) : AnyShapeStyle(Color.clear))
        }
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
