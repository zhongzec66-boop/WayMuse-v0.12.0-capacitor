import SwiftUI

struct ChatView: View {
    let duoInset: CGFloat
    @EnvironmentObject private var session: ChatSession
    @State private var draft = ""
    @FocusState private var composerFocused: Bool
    private let brand = Color(red: 3.0 / 255, green: 111.0 / 255, blue: 59.0 / 255)
    private let paper = Color(red: 248.0 / 255, green: 243.0 / 255, blue: 232.0 / 255)

    var body: some View {
        VStack(spacing: 0) {
            if !session.messages.isEmpty || composerFocused || session.isSending {
                VStack(spacing: 0) {
                    wayFace(size: 40)
                        .zIndex(1)
                    statusPill
                        .padding(.top, -8)
                }
                .frame(maxWidth: .infinity)
                .padding(.trailing, duoInset)
                .padding(.vertical, 8)
                .background { Rectangle().fill(.ultraThinMaterial).opacity(0.4) }
            }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if session.messages.isEmpty && !composerFocused { welcome }
                        ForEach(session.messages) { message in
                            if !message.text.isEmpty {
                                Group {
                                    if message.role == .user {
                                        HStack {
                                            Spacer(minLength: 48)
                                            Text(message.text)
                                                .font(.system(size: 15.5))
                                                .lineSpacing(3)
                                                .textSelection(.enabled)
                                                .foregroundStyle(.white)
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 9)
                                                .background(brand, in: RoundedRectangle(cornerRadius: 18))
                                        }
                                    } else {
                                        Text(message.text)
                                            .font(.system(size: 16.5))
                                            .lineSpacing(4)
                                            .textSelection(.enabled)
                                            .foregroundStyle(.primary)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .padding(.vertical, 4)
                                    }
                                }
                                .id(message.id)
                            }
                        }
                        if session.isSending {
                            ProgressView("正在回复")
                                .font(.footnote)
                                .id("progress")
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .padding(.trailing, duoInset)
                }
                .background(paper)
                .onChange(of: session.messages.count) { _ in
                    if let last = session.messages.last { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }

            if let error = session.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }

            HStack(alignment: .center, spacing: 10) {
                Menu {
                    Button {
                        session.startNewConversation()
                    } label: {
                        Label("新对话", systemImage: "square.and.pencil")
                    }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .light))
                        .frame(width: 30, height: 34)
                }
                .accessibilityLabel("更多操作")
                TextField("点击输入", text: $draft)
                    .padding(.vertical, 10)
                    .focused($composerFocused)
                Button {
                    let outgoing = draft
                    draft = ""
                    Task { await session.send(outgoing) }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 30))
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || session.isSending)
                .accessibilityLabel("发送")
            }
            .foregroundStyle(brand)
            .padding(.horizontal, 15)
            .padding(.vertical, 7)
            .modifier(ComposerGlass())
            .padding(.horizontal, 12)
            .padding(.trailing, duoInset)
            .padding(.vertical, 8)
            .background { Rectangle().fill(.ultraThinMaterial).opacity(0.4) }
        }
        .background(paper)
    }

    private var welcome: some View {
        VStack(spacing: 0) {
            wayFace(size: 56)
                .zIndex(1)
            statusPill
                .padding(.top, -12)
            Text("今天想聊些什么？")
                .font(.title3.weight(.medium))
                .foregroundStyle(.secondary)
                .padding(.top, 16)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 92)
    }

    private func wayFace(size: CGFloat) -> some View {
        Text("●  ●")
            .font(.system(size: size * 0.34, weight: .heavy))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(brand, in: Circle())
            .accessibilityLabel("WayMuse 头像")
    }

    private var statusPill: some View {
        VStack(spacing: 2) {
            Text("WayMuse")
                .font(.system(size: 15, weight: .semibold))
            HStack(spacing: 5) {
                if session.isSending {
                    ProgressView()
                        .controlSize(.mini)
                }
                Text(session.isSending ? "梳理中" : (draft.isEmpty ? "随时陪你聊聊" : "输入中"))
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 9)
        .modifier(ComposerGlass())
        .accessibilityLabel(session.isSending ? "WayMuse 正在梳理" : "WayMuse")
    }
}

private struct ComposerGlass: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: Capsule())
        } else {
            content.background(.ultraThinMaterial, in: Capsule())
        }
    }
}
