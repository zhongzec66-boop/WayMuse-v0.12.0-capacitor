import SwiftUI

struct ChatView: View {
    @EnvironmentObject private var session: ChatSession
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        if session.messages.isEmpty {
                            Text("今天想聊些什么？")
                                .font(.title3.weight(.medium))
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 64)
                        }
                        ForEach(session.messages) { message in
                            if !message.text.isEmpty {
                                HStack {
                                    if message.role == .user { Spacer(minLength: 36) }
                                    Text(message.text)
                                        .textSelection(.enabled)
                                        .padding(12)
                                        .background(message.role == .user ? Color.accentColor.opacity(0.15) : Color(.secondarySystemBackground))
                                        .clipShape(RoundedRectangle(cornerRadius: 16))
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

            HStack(alignment: .bottom, spacing: 10) {
                TextField("发消息", text: $draft)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                Button {
                    let outgoing = draft
                    draft = ""
                    Task { await session.send(outgoing) }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 29))
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || session.isSending)
                .accessibilityLabel("发送")
            }
            .padding(12)
            .background(Color(.systemBackground))
        }
    }
}
