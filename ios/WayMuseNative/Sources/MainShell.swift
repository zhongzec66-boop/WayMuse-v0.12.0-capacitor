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
    @State private var historyQuery = ""
    @State private var editingName = false
    @State private var nameDraft = ""
    @State private var showingSettings = false
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
                        expandedSidebar
                            .frame(width: min(330, fullWidth * 0.32))
                        content
                            .overlay(alignment: .topLeading) {
                                Button { showingSettings = true } label: {
                                    Image(systemName: "gearshape")
                                        .font(.system(size: 20))
                                        .frame(width: 44, height: 44)
                                }
                                .accessibilityLabel("设置")
                                .padding(16)
                            }
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
        .sheet(isPresented: $showingSettings) {
            SettingsView()
                .environmentObject(session)
        }
    }

    private var content: some View {
        content(for: page)
    }

    private func content(for selectedPage: WayPage) -> some View {
        VStack(spacing: 0) {
            if selectedPage != .chat {
              HStack {
                Text(selectedPage.rawValue)
                    .font(.title2.weight(.semibold))
                Spacer()
              }
              .padding(.horizontal, 18)
              .frame(height: 52)
            }

            Group {
                switch selectedPage {
                case .chat: ChatView()
                case .today: PlaceholderPage(title: "Today", detail: "今日计划正在接入真实数据。")
                case .courses: PlaceholderPage(title: "计划", detail: "计划与课表正在接入真实数据。")
                case .memories: PlaceholderPage(title: "记忆", detail: "记忆管理正在接入真实数据。")
                case .settings: PlaceholderPage(title: "助理", detail: "助理功能正在接入原生版。")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(red: 248.0 / 255, green: 243.0 / 255, blue: 232.0 / 255))
    }

    private var bottomTabs: some View {
        HStack(spacing: 0) {
            ForEach(WayPage.allCases) { item in
                Button { page = item } label: {
                    Image(systemName: item.symbol)
                        .font(.system(size: 24, weight: .medium))
                        .foregroundStyle(page == item ? Color.accentColor : Color.secondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(page == item ? Color.accentColor.opacity(0.13) : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.rawValue)
                .accessibilityAddTraits(page == item ? .isSelected : [])
            }
        }
        .padding(7)
        .frame(height: 64)
        .modifier(TabGlass())
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }

    private var expandedSidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 38))
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 4) {
                    if editingName {
                        TextField("你的称呼", text: $nameDraft)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { saveDisplayName() }
                    } else {
                        Text(session.displayName).font(.headline)
                    }
                    Text(session.quotaSummary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                Button {
                    if editingName { saveDisplayName() }
                    else {
                        nameDraft = session.displayName == "访客" ? "" : session.displayName
                        editingName = true
                    }
                } label: {
                    Image(systemName: editingName ? "checkmark" : "pencil")
                }
                .accessibilityLabel(editingName ? "保存称呼" : "修改称呼")
            }
            .padding(16)

            Divider()

            Button { page = .courses } label: {
                HStack {
                    Label("计划", systemImage: "checklist").font(.headline)
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption)
                }
                .padding(16)
            }
            .buttonStyle(.plain)
            Text("计划内容正在接入原生版")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)
                .padding(.bottom, 16)

            Divider()

            HStack {
                Text("聊天记录").font(.headline)
                Spacer()
                Button {
                    session.startNewConversation()
                    page = .chat
                } label: {
                    Image(systemName: "square.and.pencil")
                }
                .accessibilityLabel("新对话")
            }
            .padding(16)

            ScrollView {
                LazyVStack(spacing: 6) {
                    ForEach(filteredThreads) { thread in
                        Button {
                            session.selectConversation(thread.id)
                            page = .chat
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "bubble.left")
                                Text(thread.title).lineLimit(1)
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(session.selectedThreadID == thread.id ? Color.accentColor.opacity(0.12) : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .buttonStyle(.plain)
                    }
                    if filteredThreads.isEmpty {
                        Text(historyQuery.isEmpty ? "还没有聊天记录" : "没有匹配的记录")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.top, 22)
                    }
                }
                .padding(.horizontal, 10)
            }

            HStack {
                Image(systemName: "magnifyingglass")
                TextField("搜索聊天记录", text: $historyQuery)
            }
            .padding(12)
            .background(.ultraThinMaterial, in: Capsule())
            .padding(14)
        }
        .background(Color(.secondarySystemBackground).opacity(0.55))
        .overlay(alignment: .trailing) { Divider() }
    }

    private var filteredThreads: [ChatThread] {
        let query = historyQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return session.threads }
        return session.threads.filter {
            $0.title.localizedCaseInsensitiveContains(query) ||
            $0.messages.contains { $0.text.localizedCaseInsensitiveContains(query) }
        }
    }

    private func saveDisplayName() {
        let value = nameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        session.displayName = value.isEmpty ? "访客" : String(value.prefix(40))
        editingName = false
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
        }
        .padding(6)
        .modifier(RailGlass())
        .padding(.top, duoStatusClearance)
        .frame(width: 84)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private func tabButton(_ item: WayPage, vertical: Bool) -> some View {
        Button {
            page = item
        } label: {
            VStack(spacing: 3) {
                Image(systemName: item.symbol)
                    .font(.system(size: vertical ? 19 : 22, weight: .medium))
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

private struct TabGlass: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: Capsule())
        } else {
            content.background(.ultraThinMaterial, in: Capsule())
        }
    }
}

private struct RailGlass: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: Capsule())
        } else {
            content.background(.ultraThinMaterial, in: Capsule())
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
    @EnvironmentObject private var session: ChatSession

    var body: some View {
        Form {
            Section("账户") {
                TextField("称呼", text: $session.displayName)
                Text(session.quotaSummary)
                Button("刷新额度") { Task { await session.refreshQuota() } }
            }
        }
    }
}
