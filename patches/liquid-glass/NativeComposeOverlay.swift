import UIKit

/// 原生「聊天输入框」浮层。
///
/// 设计约束（与 LiquidGlassTabBarOverlay 保持一致）：
/// - 玻璃容器必须是宿主 VC 层级中的真实子视图，否则取不到系统材质；
/// - 位置由 JS 侧测量 DOM 矩形后通过约束传入（bound 模式），
///   这样 Web 输入框只做锚点，原生视图正好盖在它上面；
/// - 键盘弹出时把整体上移，避免被键盘遮住（原生输入框不会触发 WebKit 的
///   visualViewport 调整，所以必须自己处理）。
final class NativeComposeOverlay: NSObject {

    // MARK: - 回调

    var onTextChange: ((String) -> Void)?
    var onSubmit: ((String) -> Void)?
    var onAttach: (() -> Void)?
    var onVoice: (() -> Void)?
    var onVoiceStart: (() -> Void)?
    var onVoiceEnd: (() -> Void)?
    /// 这次按下是不是「长按说话」，用来在松手时配对收尾
    private var voicePressActive = false

    // MARK: - 视图

    private let container = UIVisualEffectView()
    private let stack = UIStackView()
    private let attachButton = UIButton(type: .system)
    private let textField = UITextField()
    /// 麦克风和发送分开：一个只负责「按住说话」，一个只负责发送。
    /// 以前共用一颗按钮、靠有无文字切换图标，用户猜不到点下去会发生什么。
    private let micButton = UIButton(type: .system)
    private let sendButton = UIButton(type: .system)

    private weak var host: UIView?
    private weak var webView: UIView?

    // MARK: - 约束（bound 模式）

    private var topConstraint: NSLayoutConstraint?
    private var leadingConstraint: NSLayoutConstraint?
    private var widthConstraint: NSLayoutConstraint?
    private var heightConstraint: NSLayoutConstraint?
    private var baseRect: CGRect = .zero
    private var keyboardOverlap: CGFloat = 0

    // MARK: - 状态

    private var lastEmittedText: String = ""
    private var tintColor: UIColor = .systemGreen
    private var placeholder: String = ""
    private var isEnabled: Bool = true

    // MARK: - 生命周期

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func configure(placeholder: String?, text: String?, tintHex: String?, enabled: Bool) {
        if let placeholder { self.placeholder = placeholder }
        if let text, textField.text != text { textField.text = text }
        if let tintHex, let color = UIColor(composeHex: tintHex) { tintColor = color }
        self.isEnabled = enabled
        applyStyle()
    }

    /// 挂到宿主视图上。bounds 为 WebView 坐标系（== viewport CSS px）中的矩形。
    func show(in host: UIView, webView: UIView?, bounds: CGRect) {
        self.host = host
        self.webView = webView
        self.baseRect = bounds

        if container.superview !== host {
            buildIfNeeded()
            container.translatesAutoresizingMaskIntoConstraints = false
            host.addSubview(container)

            let top = container.topAnchor.constraint(equalTo: host.topAnchor, constant: bounds.origin.y)
            let leading = container.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: bounds.origin.x)
            let width = container.widthAnchor.constraint(equalToConstant: bounds.size.width)
            let height = container.heightAnchor.constraint(equalToConstant: bounds.size.height)
            NSLayoutConstraint.activate([top, leading, width, height])
            topConstraint = top
            leadingConstraint = leading
            widthConstraint = width
            heightConstraint = height
        }

        observeKeyboard()
        container.isHidden = false
        container.alpha = 1
        applyStyle()
        setBounds(bounds)
    }

    /// 仅更新位置/尺寸，不重建视图（滚动、转屏、键盘收起都会走到这里）。
    func setBounds(_ rect: CGRect) {
        guard rect.width > 0, rect.height > 0 else { return }
        baseRect = rect
        guard let host else { return }
        let converted = webView?.convert(rect, to: host) ?? rect

        // 键盘出现时只做「最小必要抬升」：如果 DOM 矩形本身已经在键盘上方
        // （WebKit 会因视口变化重新排布），就不要再叠加一次键盘高度，
        // 否则输入框会被顶到屏幕中上部。
        var y = converted.origin.y
        if keyboardOverlap > 0 {
            let keyboardTop = host.bounds.maxY - keyboardOverlap
            let limit = keyboardTop - 8 - converted.size.height
            if y > limit { y = limit }
        }
        y = max(0, y)

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        topConstraint?.constant = y
        leadingConstraint?.constant = converted.origin.x
        widthConstraint?.constant = converted.size.width
        heightConstraint?.constant = converted.size.height
        host.layoutIfNeeded()
        CATransaction.commit()
        container.layer.cornerRadius = min(28, converted.size.height / 2)
    }

    func hide() {
        textField.resignFirstResponder()
        UIView.animate(withDuration: 0.16, animations: { [weak self] in
            self?.container.alpha = 0
        }, completion: { [weak self] _ in
            self?.container.isHidden = true
        })
    }

    func setText(_ text: String) {
        // 避免「JS 回写文本 → 触发 textDidChange → 再回传 JS」的抖动
        lastEmittedText = text
        if textField.text != text { textField.text = text }
        refreshActionButton()
    }

    // MARK: - 构建

    private func buildIfNeeded() {
        guard container.contentView.subviews.isEmpty else { return }

        container.effect = Self.makeGlassEffect()
        container.clipsToBounds = true
        container.contentView.clipsToBounds = true

        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.contentView.addSubview(stack)

        attachButton.setImage(UIImage(systemName: "plus"), for: .normal)
        attachButton.addTarget(self, action: #selector(handleAttach), for: .touchUpInside)
        attachButton.translatesAutoresizingMaskIntoConstraints = false

        textField.delegate = self
        textField.borderStyle = .none
        textField.backgroundColor = .clear
        textField.returnKeyType = .send
        textField.autocorrectionType = .no
        textField.autocapitalizationType = .none
        textField.addTarget(self, action: #selector(textDidChange), for: .editingChanged)
        textField.translatesAutoresizingMaskIntoConstraints = false

        // 麦克风：按住说话（按下开始、松手结束）
        micButton.addTarget(self, action: #selector(handleVoiceDown), for: .touchDown)
        micButton.addTarget(self, action: #selector(handleVoiceUp), for: .touchUpInside)
        micButton.addTarget(self, action: #selector(handleVoiceUp), for: .touchUpOutside)
        micButton.addTarget(self, action: #selector(handleVoiceUp), for: .touchCancel)
        micButton.translatesAutoresizingMaskIntoConstraints = false

        sendButton.addTarget(self, action: #selector(handleSend), for: .touchUpInside)
        sendButton.translatesAutoresizingMaskIntoConstraints = false

        stack.addArrangedSubview(attachButton)
        stack.addArrangedSubview(textField)
        stack.addArrangedSubview(micButton)
        stack.addArrangedSubview(sendButton)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.contentView.leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: container.contentView.trailingAnchor, constant: -8),
            stack.topAnchor.constraint(equalTo: container.contentView.topAnchor),
            stack.bottomAnchor.constraint(equalTo: container.contentView.bottomAnchor),

            attachButton.widthAnchor.constraint(equalToConstant: 44),
            attachButton.heightAnchor.constraint(equalToConstant: 44),
            micButton.widthAnchor.constraint(equalToConstant: 40),
            micButton.heightAnchor.constraint(equalToConstant: 40),
            sendButton.widthAnchor.constraint(equalToConstant: 40),
            sendButton.heightAnchor.constraint(equalToConstant: 40),
        ])
    }

    /// iOS 26 用系统 Liquid Glass；更早系统退回超薄材质模糊。
    private static func makeGlassEffect() -> UIVisualEffect {
        if #available(iOS 26.0, *) {
            let effect = UIGlassEffect()
            effect.isInteractive = true
            return effect
        }
        return UIBlurEffect(style: .systemUltraThinMaterial)
    }

    private func applyStyle() {
        textField.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: UIColor.secondaryLabel]
        )
        textField.font = .systemFont(ofSize: 17)
        textField.tintColor = tintColor
        attachButton.tintColor = UIColor.secondaryLabel
        micButton.tintColor = UIColor.secondaryLabel
        sendButton.tintColor = tintColor
        refreshActionButton()
    }

    private func refreshActionButton() {
        let hasText = !(textField.text ?? "").isEmpty
        let config = UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold)
        let sendConfig = UIImage.SymbolConfiguration(pointSize: 22, weight: .semibold)
        micButton.setImage(UIImage(systemName: "waveform", withConfiguration: config), for: .normal)
        sendButton.setImage(
            UIImage(systemName: "arrow.up.circle.fill", withConfiguration: sendConfig),
            for: .normal
        )
        attachButton.isEnabled = isEnabled
        micButton.isEnabled = isEnabled
        // 没内容时发送键不可用，视觉上也要明显（不靠用户猜）
        sendButton.isEnabled = isEnabled && hasText
        sendButton.alpha = hasText ? 1 : 0.28
    }

    // MARK: - 键盘

    private func observeKeyboard() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardWillChange(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    @objc private func keyboardWillChange(_ note: Notification) {
        guard let host, let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
        let inHost = host.convert(frame, from: host.window)
        keyboardOverlap = max(0, host.bounds.maxY - inHost.minY)
        setBounds(baseRect)
    }

    @objc private func keyboardWillHide(_ note: Notification) {
        keyboardOverlap = 0
        setBounds(baseRect)
    }

    // MARK: - 事件

    @objc private func textDidChange() {
        let text = textField.text ?? ""
        lastEmittedText = text
        refreshActionButton()
        onTextChange?(text)
    }

    @objc private func handleAttach() {
        onAttach?()
    }

    @objc private func handleSend() {
        let text = (textField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        onSubmit?(text)
        // 发完立刻清空：否则用户会看到「消息已发出，但输入框还留着同一句话」
        clearAfterSend()
    }

    /// 发送后清空输入框，并同步给 JS，避免两边状态不一致
    private func clearAfterSend() {
        textField.text = ""
        lastEmittedText = ""
        refreshActionButton()
        onTextChange?("")
    }

    @objc private func handleVoiceDown() {
        guard (textField.text ?? "").isEmpty else { return }
        voicePressActive = true
        onVoiceStart?()
    }

    @objc private func handleVoiceUp() {
        guard voicePressActive else { return }
        voicePressActive = false
        onVoiceEnd?()
    }
}

// MARK: - UITextFieldDelegate

extension NativeComposeOverlay: UITextFieldDelegate {
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        let text = (textField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return false }
        onSubmit?(text)
        clearAfterSend()
        return true
    }
}

// MARK: - UIColor+hex

private extension UIColor {
    convenience init?(composeHex hex: String) {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt64(value, radix: 16) else { return nil }
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255
        let b = CGFloat(rgb & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}
