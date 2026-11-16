import SwiftUI
import UIKit

enum WayPage: String, CaseIterable, Identifiable {
    case chat = "聊天"
    case today = "Today"
    case courses = "计划"
    case memories = "记忆"
    case settings = "助理"

    var id: Self { self }

    var symbol: String {
        switch self {
        case .chat: return "bubble.left.and.bubble.right"
        case .today: return "calendar"
        case .courses: return "checklist"
        case .memories: return "sparkles"
        case .settings: return "person.crop.circle"
        }
    }
}

struct MainShell: View {
    private var duoStatusClearance: CGFloat {
        let activeScene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        let statusBottom = activeScene?.statusBarManager?.statusBarFrame.maxY ?? 0
        return max(128, statusBottom + 16)
    }
    @State private var page: WayPage = .chat
    @EnvironmentObject private var session: ChatSession

    var body: some View {
        GeometryReader { geometry in
            let fullWidth = geometry.size.width
                + geometry.safeAreaInsets.leading
                + geometry.safeAreaInsets.trailing
            let expanded = fullWidth >= 900
            Group {
                if expanded {
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
            .ignoresSafeArea(.container, edges: .horizontal)
            .background(Color(red: 248.0 / 255, green: 243.0 / 255, blue: 232.0 / 255).ignoresSafeArea())
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            if page != .chat {
              HStack {
                Text(page.rawValue)
                    .font(.title2.weight(.semibold))
                Spacer()
              }
              .padding(.horizontal, 18)
              .frame(height: 52)
            }

            Group {
                switch page {
                case .chat: ChatView()
                case .today: PlaceholderPage(title: "Today", detail: "今日计划正在接入真实数据。")
                case .courses: PlaceholderPage(title: "计划", detail: "计划与课表正在接入真实数据。")
                case .memories: PlaceholderPage(title: "记忆", detail: "记忆管理正在接入真实数据。")
                case .settings: SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(red: 248.0 / 255, green: 243.0 / 255, blue: 232.0 / 255))
    }

    private var bottomTabs: some View {
        HStack(spacing: 0) {
            ForEach(WayPage.allCases) { item in
                tabButton(item, vertical: false)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 3)
        .modifier(NativeGlass())
        .overlay(alignment: .top) { Divider() }
    }

    private var duoRail: some View {
        VStack(spacing: 8) {
            Button {
                session.startNewConversation()
                page = .chat
            } label: {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 20))
                    .frame(width: 56, height: 48)
            }
            .accessibilityLabel("新对话")

            Divider().padding(.horizontal, 10)

            ForEach(WayPage.allCases) { item in
                tabButton(item, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.top, duoStatusClearance)
        .padding(.bottom, 12)
        .frame(width: 84)
        .frame(maxHeight: .infinity)
        .background(.ultraThinMaterial)
        .overlay(alignment: .leading) { Divider() }
    }

    private func tabButton(_ item: WayPage, vertical: Bool) -> some View {
        Button {
            page = item
        } label: {
            VStack(spacing: 3) {
                Image(systemName: item.symbol)
                    .font(.system(size: vertical ? 19 : 22, weight: .medium))
                if vertical {
                    Text(item.rawValue)
                        .font(.system(size: 10))
                }
            }
            .foregroundStyle(page == item ? Color.accentColor : Color.secondary)
            .frame(width: vertical ? 56 : nil, height: vertical ? 48 : 44)
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
    var body: some View {
        Form {
            Text("助理页面正在接入现有 WayMuse 功能。")
        }
    }
}
