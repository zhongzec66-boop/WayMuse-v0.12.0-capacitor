import Foundation
import Capacitor
import UIKit
import WebKit

/// 原生聊天输入框的 Capacitor 桥。
///
/// 之所以单独做一个插件而不是改 `@ajuarezso/capacitor-liquid-glass`：
/// 那个包是 npm 依赖，`npm ci` 会覆盖；这里的文件由 `scripts/inject-native-compose.cjs`
/// 在安装后写入同一个 SPM target（同目录 `.swift` 会被自动编译），因此不需要
/// 动 `project.pbxproj`。
@objc(NativeComposePlugin)
public class NativeComposePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeComposePlugin"
    public let jsName = "NativeCompose"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showComposeBar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideComposeBar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setComposeBounds", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setComposeText", returnType: CAPPluginReturnPromise),
    ]

    private var overlay: NativeComposeOverlay?

    // MARK: - 生命周期

    private func ensureOverlay() -> NativeComposeOverlay {
        if let overlay { return overlay }
        let created = NativeComposeOverlay()
        created.onTextChange = { [weak self] text in
            self?.notifyListeners("composeTextChanged", data: ["text": text])
        }
        created.onSubmit = { [weak self] text in
            self?.notifyListeners("composeSubmit", data: ["text": text])
        }
        created.onAttach = { [weak self] in
            self?.notifyListeners("composeAttach", data: [:])
        }
        created.onVoice = { [weak self] in
            self?.notifyListeners("composeVoice", data: [:])
        }
        created.onVoiceStart = { [weak self] in
            self?.notifyListeners("composeVoiceStart", data: [:])
        }
        created.onVoiceEnd = { [weak self] in
            self?.notifyListeners("composeVoiceEnd", data: [:])
        }
        overlay = created
        return created
    }

    // MARK: - 方法

    @objc func showComposeBar(_ call: CAPPluginCall) {
        let bounds = call.getObject("bounds").flatMap { Self.rect(from: $0) }
        guard let bounds, bounds.width > 0, bounds.height > 0 else {
            call.reject("bounds {x, y, width, height} is required")
            return
        }
        let placeholder = call.getString("placeholder") ?? ""
        let text = call.getString("text") ?? ""
        let tintHex = call.getString("tintColor")
        let enabled = call.getBool("enabled") ?? true

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard let host = self.bridge?.viewController?.view else {
                call.reject("host view unavailable")
                return
            }
            let bar = self.ensureOverlay()
            bar.configure(placeholder: placeholder, text: text, tintHex: tintHex, enabled: enabled)
            bar.show(in: host, webView: self.bridge?.webView, bounds: bounds)
            call.resolve()
        }
    }

    @objc func setComposeBounds(_ call: CAPPluginCall) {
        guard let boundsDict = call.getObject("bounds"), let rect = Self.rect(from: boundsDict) else {
            call.reject("bounds {x, y, width, height} is required")
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.overlay?.setBounds(rect)
            call.resolve()
        }
    }

    @objc func setComposeText(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        DispatchQueue.main.async { [weak self] in
            self?.overlay?.setText(text)
            call.resolve()
        }
    }

    @objc func hideComposeBar(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.overlay?.hide()
            call.resolve()
        }
    }

    // MARK: - 工具

    /// 与 LiquidGlassPlugin 相同的容错解析：数字可能以 Double/Int/NSNumber 过来。
    private static func rect(from dict: JSObject) -> CGRect? {
        func num(_ value: Any?) -> Double? {
            if let d = value as? Double { return d }
            if let n = value as? NSNumber { return n.doubleValue }
            if let i = value as? Int { return Double(i) }
            return nil
        }
        guard let x = num(dict["x"]), let y = num(dict["y"]),
              let w = num(dict["width"]), let h = num(dict["height"]) else { return nil }
        return CGRect(x: x, y: y, width: w, height: h)
    }
}
