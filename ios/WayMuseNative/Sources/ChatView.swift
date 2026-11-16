import SwiftUI

struct ChatView: View {
    @EnvironmentObject private var session: ChatSession
    @State private var draft = ""
    private let brand = Color(red: 3.0 / 255, green: 111.0 / 255, blue: 59.0 / 255)
    private let paper = Color(red: 248.0 / 255, green: 243.0 / 255, blue: 232.0 / 255)

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        if session.messages.isEmpty { welcome }
                        ForEach(session.messages) { message in
                            if !message.text.isEmpty {
                                HStack {
                                    if message.role == .user { Spacer(minLength: 36) }
                                    Text(message.text)
                                        .textSelection(.enabled)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 13)
                                        .background(message.role == .user ? brand : Color.white)
                                        .foregroundStyle(message.role == .user ? Color.white : Color.primary)
                                        .clipShape(RoundedRectangle(cornerRadius: 22))
                                    if message.role == .assistant { Spacer(minLength: 36) }
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
                    .padding(16)
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
            .padding(.vertical, 8)
            .background(paper)
        }
        .background(paper)
    }

    private var welcome: some View {
        VStack(spacing: 16) {
            Text("●  ●")
                .font(.system(size: 19, weight: .heavy))
                .foregroundStyle(.white)
                .frame(width: 68, height: 68)
                .background(brand, in: Circle())
            Text("WayMuse")
                .font(.headline)
            Text("今天想聊些什么？")
                .font(.title3.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 92)
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
