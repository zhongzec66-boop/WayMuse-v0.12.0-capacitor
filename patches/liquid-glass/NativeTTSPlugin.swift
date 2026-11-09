import AVFoundation

/**
 * 本地语音合成。
 *
 * 用系统 AVSpeechSynthesizer：零配置、离线、不花钱，
 * 替代之前依赖 Breeze 联网合成的语音通话。
 *
 * 注意：必须在主线程构造/调用，AVSpeechSynthesizer 不是线程安全的。
 */
@objc(NativeTTSPlugin)
public class NativeTTSPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "NativeTTSPlugin"
    public let jsName = "NativeTTS"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSpeaking", returnType: CAPPluginReturnPromise),
    ]

    private let synthesizer = AVSpeechSynthesizer()

    @objc func speak(_ call: CAPPluginCall) {
        guard let text = call.getString("text")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            call.reject("text is required")
            return
        }

        // 中文按段落/句号切成短句，听感更自然，也能更快出声
        let language = call.getString("language") ?? "zh-CN"
        let rate = call.getFloat("rate") ?? 0.5

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.configureSessionIfNeeded()
            self.synthesizer.stopSpeaking(at: .immediate)

            let utterance = AVSpeechUtterance(string: String(text.prefix(1200)))
            utterance.voice = AVSpeechSynthesisVoice(language: language)
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * max(0.3, min(1.4, rate * 2))
            utterance.pitchMultiplier = 1.0
            utterance.postUtteranceDelay = 0.05

            self.synthesizer.speak(utterance)
            call.resolve(["started": true])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.synthesizer.stopSpeaking(at: .immediate)
            call.resolve()
        }
    }

    @objc func isSpeaking(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            call.resolve(["speaking": self?.synthesizer.isSpeaking ?? false])
        }
    }

    /// 播放语音时把音频会话切到 playback，静音键也不会吞掉声音
    private func configureSessionIfNeeded() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try session.setActive(true, options: [])
        } catch {
            // 播放失败不影响文字阅读，静默忽略
        }
    }
}
