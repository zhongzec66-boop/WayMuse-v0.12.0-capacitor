import SwiftUI
import UIKit

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
    @AppStorage("duoPreview") private var duoPreview = false
    @EnvironmentObject private var session: ChatSession

    var body: some View {
        GeometryReader { geometry in
            let expanded = geometry.size.width >= 700
            let useDuo = expanded || duoPreview || DuoDevice.isDuo
            Group {
                if expanded {
                    HStack(spacing: 8) {
                        duoContext
                            .frame(width: min(320, geometry.size.width * 0.27))
                        content
                        duoRail
                    }
                    .padding(8)
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
                Menu {
                    Button {
                        session.startNewConversation()
                        page = .chat
                    } label: {
                        Label("新对话", systemImage: "square.and.pencil")
                    }
                    Button { page = .settings } label: {
                        Label("设置", systemImage: "gearshape")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                }
                .accessibilityLabel("更多工具")
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
        .background(Color(.systemBackground))
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
        VStack(spacing: 8) {
            ForEach(WayPage.allCases) { item in
                tabButton(item, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
        .frame(width: 68)
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
        .background(Color(.secondarySystemBackground))
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
            .frame(width: vertical ? 56 : nil, height: vertical ? 48 : 43)
            .frame(maxWidth: vertical ? nil : .infinity)
            .background(page == item ? Color.accentColor.opacity(0.13) : Color.clear)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.rawValue)
        .accessibilityAddTraits(page == item ? .isSelected : [])
    }
}

private struct NativeGlass: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: RoundedRectangle(cornerRadius: 20))
        } else {
            content.background(Material.ultraThin)
        }
    }
}

private enum DuoDevice {
    static var isDuo: Bool {
        let environment = ProcessInfo.processInfo.environment
        let names = [
            UIDevice.current.model,
            UIDevice.current.name,
            environment["SIMULATOR_MODEL_NAME"] ?? ""
        ]
        return names.contains { $0.localizedCaseInsensitiveContains("iPhone Duo") }
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
    @AppStorage("duoPreview") private var duoPreview = false

    var body: some View {
        Form {
            Toggle("预览 iPhone Duo 界面", isOn: $duoPreview)
            Text("展开窗口会自动使用 Duo 三栏；此开关用于在普通 iPhone 上预览折叠态布局。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}
