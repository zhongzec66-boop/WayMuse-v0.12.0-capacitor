import Foundation
import Capacitor
import UIKit
import AVFoundation
import Speech
import EventKit
import Vision
import PDFKit

/// 原生「震动 + 本地语音识别」桥。
///
/// 和 NativeComposePlugin 一样，由 `scripts/inject-native-compose.cjs` 注入到
/// 已链接的 SPM target，因此不需要改 project.pbxproj。
///
/// 语音识别全程在设备上跑：`SFSpeechRecognizer` 支持离线时强制
/// `requiresOnDeviceRecognition`，音频不进网络。
@objc(NativeExtrasPlugin)
public class NativeExtrasPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeExtrasPlugin"
    public let jsName = "NativeExtras"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "impact", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startSpeech", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSpeech", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelSpeech", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "calendarStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestCalendar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addReminder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAudioSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginCallAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endCallAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "extractPdfText", returnType: CAPPluginReturnPromise),
    ]

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var recognizing = false
    private var tapInstalled = false
    /// 通话中打开：用 .voiceChat 换回声消除，代价是音质偏「电话音」
    private var inCall = false
    private var callAudioMode: AVAudioSession.Mode {
        inCall ? .voiceChat : .measurement
    }
    private let eventStore = EKEventStore()
    private var player: AVAudioPlayer?
    private var pendingPlay: CAPPluginCall?

    // MARK: - 触觉反馈

    @objc func impact(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "medium"
        DispatchQueue.main.async {
            switch style {
            case "light":
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            case "heavy":
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            case "soft":
                UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            case "rigid":
                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
            default:
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            }
            call.resolve()
        }
    }

    @objc func notify(_ call: CAPPluginCall) {
        let type = call.getString("type") ?? "success"
        DispatchQueue.main.async {
            let generator = UINotificationFeedbackGenerator()
            switch type {
            case "warning":
                generator.notificationOccurred(.warning)
            case "error":
                generator.notificationOccurred(.error)
            default:
                generator.notificationOccurred(.success)
            }
            call.resolve()
        }
    }

    // MARK: - 语音识别

    @objc func startSpeech(_ call: CAPPluginCall) {
        let localeId = call.getString("locale") ?? "zh-CN"
        let preferOnDevice = call.getBool("onDevice") ?? true

        if recognizing {
            stopInternal()
        }

        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                call.reject("speech-unauthorized")
                return
            }
            self.requestMicPermission { granted in
                guard granted else {
                    call.reject("mic-denied")
                    return
                }
                DispatchQueue.main.async {
                    self.begin(localeId: localeId, preferOnDevice: preferOnDevice, call: call)
                }
            }
        }
    }

    @objc func stopSpeech(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopInternal()
            call.resolve()
        }
    }

    @objc func cancelSpeech(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopInternal()
            self.notifyListeners("speechCancelled", data: [:])
            call.resolve()
        }
    }

    // MARK: - 内部

    private func requestMicPermission(_ completion: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission { granted in
                completion(granted)
            }
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                completion(granted)
            }
        }
    }

    private func begin(localeId: String, preferOnDevice: Bool, call: CAPPluginCall) {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId)),
              recognizer.isAvailable else {
            call.reject("speech-unavailable")
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            // 录音也走统一入口：它会在 setCategory 之后重新把输出强制到扬声器，
            // 否则每次开口监听都会把声音打回听筒。
            _ = session
            try self.activateSession()

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            if preferOnDevice && recognizer.supportsOnDeviceRecognition {
                request.requiresOnDeviceRecognition = true
            }
            self.request = request

            let input = engine.inputNode
            let format = input.inputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            self.tapInstalled = true
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }

            engine.prepare()
            try engine.start()
            recognizing = true

            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    DispatchQueue.main.async {
                        self.notifyListeners(
                            "speechPartial",
                            data: ["text": text, "final": result.isFinal]
                        )
                        if result.isFinal {
                            self.notifyListeners("speechFinal", data: ["text": text])
                            self.stopInternal()
                        }
                    }
                }
                if let error {
                    let message = error.localizedDescription
                    DispatchQueue.main.async {
                        self.notifyListeners("speechError", data: ["message": message])
                        self.stopInternal()
                    }
                }
            }

            call.resolve()
        } catch {
            stopInternal()
            call.reject("speech-start-failed: \(error.localizedDescription)")
        }
    }

    // MARK: - 日历 / 提醒事项

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// 解析前端传来的 ISO 时间；解析失败返回 nil。
    private static func parseDate(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        return iso.date(from: value) ?? isoPlain.date(from: value)
    }

    private static func formatDate(_ date: Date) -> String {
        iso.string(from: date)
    }

    private func calendarAuthorized() -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) {
            return status == .fullAccess
        }
        return status == .authorized
    }

    @objc func calendarStatus(_ call: CAPPluginCall) {
        let status = EKEventStore.authorizationStatus(for: .event)
        let granted = calendarAuthorized()
        DispatchQueue.main.async {
            call.resolve(["granted": granted, "rawStatus": status.rawValue])
        }
    }

    @objc func requestCalendar(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            eventStore.requestFullAccessToEvents { granted, error in
                if let error {
                    call.reject("calendar-request-failed: \(error.localizedDescription)")
                    return
                }
                call.resolve(["granted": granted])
            }
        } else {
            eventStore.requestAccess(to: .event) { granted, error in
                if let error {
                    call.reject("calendar-request-failed: \(error.localizedDescription)")
                    return
                }
                call.resolve(["granted": granted])
            }
        }
    }

    @objc func readEvents(_ call: CAPPluginCall) {
        guard calendarAuthorized() else {
            call.reject("calendar-unauthorized")
            return
        }
        let calendar = Calendar.current
        let start = Self.parseDate(call.getString("start"))
            ?? calendar.startOfDay(for: Date())
        let end = Self.parseDate(call.getString("end"))
            ?? calendar.date(byAdding: .day, value: 1, to: start)
            ?? start.addingTimeInterval(86_400)

        let predicate = eventStore.predicateForEvents(
            withStart: start,
            end: end,
            calendars: nil
        )
        let events: [[String: Any]] = eventStore.events(matching: predicate)
            .filter { !$0.isAllDay }
            .sorted { $0.startDate < $1.startDate }
            .prefix(20)
            .map { event in
                [
                    "id": event.eventIdentifier ?? UUID().uuidString,
                    "title": event.title ?? "未命名日程",
                    "start": Self.formatDate(event.startDate),
                    "end": Self.formatDate(event.endDate),
                    "location": event.location ?? "",
                    "calendar": event.calendar?.title ?? "",
                ]
            }
        call.resolve(["events": events])
    }

    @objc func addEvent(_ call: CAPPluginCall) {
        guard calendarAuthorized() else {
            call.reject("calendar-unauthorized")
            return
        }
        guard let title = call.getString("title"), !title.isEmpty else {
            call.reject("title-required")
            return
        }
        guard let start = Self.parseDate(call.getString("start")) else {
            call.reject("start-required")
            return
        }
        let end = Self.parseDate(call.getString("end"))
            ?? start.addingTimeInterval(3_600)

        let event = EKEvent(eventStore: eventStore)
        event.title = title
        event.startDate = start
        event.endDate = end
        event.notes = call.getString("notes")
        event.calendar = eventStore.defaultCalendarForNewEvents

        do {
            try eventStore.save(event, span: .thisEvent)
            call.resolve(["ok": true, "id": event.eventIdentifier ?? ""])
        } catch {
            call.reject("save-failed: \(error.localizedDescription)")
        }
    }

    @objc func addReminder(_ call: CAPPluginCall) {
        let store = EKEventStore()
        store.requestAccess(to: .reminder) { granted, error in
            guard granted, error == nil else {
                call.reject("reminder-unauthorized")
                return
            }
            guard let title = call.getString("title"), !title.isEmpty else {
                call.reject("title-required")
                return
            }
            let reminder = EKReminder(eventStore: store)
            reminder.title = title
            reminder.calendar = store.defaultCalendarForNewReminders()
            if let due = Self.parseDate(call.getString("due")) {
                reminder.dueDateComponents = Calendar.current.dateComponents(
                    [.year, .month, .day, .hour, .minute],
                    from: due
                )
            }
            do {
                try store.save(reminder, commit: true)
                call.resolve(["ok": true])
            } catch {
                call.reject("reminder-save-failed: \(error.localizedDescription)")
            }
        }
    }

    private func stopInternal() {
        if engine.isRunning {
            engine.stop()
        }
        if tapInstalled {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        request?.endAudio()
        request = nil
        task?.cancel()
        task = nil
        recognizing = false
        // 注意：这里**不** setActive(false)。一旦停掉会话，随后用 WebView 播 TTS
        // 就会被系统路由回听筒（声音突然变得很小）。会话留到 endAudioSession 再关。
    }



    // MARK: - PDF 抽取文字（PDFKit）

    /// 从 PDF 里抽正文。
    ///
    /// 用系统自带的 PDFKit 而不是 pdf.js：
    /// pdf.js 需要 worker，在 WKWebView 里容易加载失败，而且它的新版本
    /// 依赖较新的 JS 特性。PDFKit 是系统框架，没有这些问题。
    ///
    /// 抽不到文字（扫描件、图片型 PDF）时退化成「渲染成图再 OCR」，
    /// 学生拍的讲义、扫描的课件正好是这种。
    @objc func extractPdfText(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"),
              let data = Data(base64Encoded: base64),
              let document = PDFDocument(data: data) else {
            call.reject("pdf-required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            // 1) 先读文字层，最多 30 页
            var pages: [String] = []
            let textPages = min(document.pageCount, 30)
            for index in 0..<textPages {
                if let text = document.page(at: index)?.string?
                    .trimmingCharacters(in: .whitespacesAndNewlines),
                   !text.isEmpty {
                    pages.append(text)
                }
            }
            let plain = pages.joined(separator: "\n")

            if plain.count >= 40 {
                call.resolve(["text": plain, "scanned": false])
                return
            }

            // 2) 没有文字层：当成扫描件，渲染前 3 页再 OCR
            var recognized: [String] = []
            let scanPages = min(document.pageCount, 3)
            for index in 0..<scanPages {
                guard let page = document.page(at: index) else { continue }
                let bounds = page.bounds(for: .mediaBox)
                guard bounds.width > 1, bounds.height > 1 else { continue }
                let scale: CGFloat = 2
                let size = CGSize(
                    width: bounds.width * scale,
                    height: bounds.height * scale
                )
                let renderer = UIGraphicsImageRenderer(size: size)
                let image = renderer.image { context in
                    UIColor.white.setFill()
                    context.fill(CGRect(origin: .zero, size: size))
                    let cg = context.cgContext
                    cg.translateBy(x: 0, y: size.height)
                    cg.scaleBy(x: scale, y: -scale)
                    page.draw(with: .mediaBox, to: cg)
                }
                if let cgImage = image.cgImage,
                   let text = Self.recognizeSync(cgImage: cgImage),
                   !text.isEmpty {
                    recognized.append(text)
                }
            }

            call.resolve([
                "text": recognized.joined(separator: "\n"),
                "scanned": true,
            ])
        }
    }
    // MARK: - 图片文字识别（Vision，设备本地）

    /// 从图片里认字。
    ///
    /// 用苹果自带的 Vision：iOS 内置、中文开箱即用、完全在设备上跑，
    /// 不需要第三方 SDK，也不涨包体。
    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"),
              let data = Data(base64Encoded: base64),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.reject("image-required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            if let text = Self.recognizeSync(cgImage: cgImage) {
                call.resolve(["text": text])
            } else {
                call.reject("ocr-failed")
            }
        }
    }

    /// 同步识别一张图里的文字。PDF 扫描件那条路径也复用这里。
    private static func recognizeSync(cgImage: CGImage) -> String? {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        // 中文优先，其次英文；不支持的语言会在运行时被忽略
        request.recognitionLanguages = ["zh-Hans", "en-US"]

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
            try handler.perform([request])
            let lines = (request.results ?? [])
                .compactMap { $0.topCandidates(1).first?.string }
            return lines.joined(separator: "\n")
        } catch {
            return nil
        }
    }
    // MARK: - 音频播放（锁扬声器）

    /// 统一把会话配成「播放 + 录音」并强制走扬声器。
    /// 唯一的会话配置入口。
    ///
    /// 关键点：`overrideOutputAudioPort(.speaker)` 必须在 `setCategory` **之后**
    /// 调用。每次重新 setCategory 都会把输出端口打回默认（.voiceChat 下就是听筒），
    /// 所以只要有一次没跟着重新 override，声音就会突然变小。
    private func activateSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: callAudioMode,
            options: [.defaultToSpeaker, .allowBluetooth, .duckOthers]
        )
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        try session.overrideOutputAudioPort(.speaker)
    }

    private func configureSpeakerSession() throws {
        try activateSession()
    }

    /// 播放专用会话：`.playback` 分类下系统只会用扬声器（除非插了耳机）。
    /// 之前用 `.playAndRecord` + `.voiceChat` + override 的做法在真机上仍会
    /// 掉回听筒，所以播放阶段直接换分类，最稳。
    private func activatePlaybackSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playback,
            mode: .spokenAudio,
            options: [.duckOthers]
        )
        try session.setActive(true, options: .notifyOthersOnDeactivation)
    }

    /// 播完后如果还在通话里，切回录音分类，麦克风才能继续工作。
    private func restoreCallSession() {
        guard inCall else { return }
        try? activateSession()
    }

    /// 当前输出端口，用于排查「声音到底从哪出来」。
    @objc func audioRoute(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map { output -> [String: String] in
            [
                "port": output.portType.rawValue,
                "name": output.portName,
            ]
        }
        call.resolve([
            "outputs": outputs,
            "category": session.category.rawValue,
            "mode": session.mode.rawValue,
        ])
    }

    @objc func playAudio(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"),
              let data = Data(base64Encoded: base64) else {
            call.reject("audio-data-required")
            return
        }
        DispatchQueue.main.async {
            do {
                // 播放阶段切到 .playback：这是唯一能保证走扬声器的分类
                try self.activatePlaybackSession()
                self.player?.stop()
                let player = try AVAudioPlayer(data: data)
                player.delegate = self
                player.prepareToPlay()
                self.player = player
                self.pendingPlay = call
                if !player.play() {
                    self.pendingPlay = nil
                    call.reject("play-failed")
                }
            } catch {
                self.pendingPlay = nil
                call.reject("audio-session-failed: \(error.localizedDescription)")
            }
        }
    }

    /// 进入通话音频模式：之后麦克风与扬声器可以同时工作且互不干扰。
    @objc func beginCallAudio(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.inCall = true
            do {
                try self.configureSpeakerSession()
                call.resolve(["ok": true])
            } catch {
                call.reject("call-audio-failed: \(error.localizedDescription)")
            }
        }
    }

    /// 退出通话音频模式，恢复普通录音配置。
    @objc func endCallAudio(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.inCall = false
            call.resolve()
        }
    }

    @objc func stopAudio(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.player?.stop()
            self.player = nil
            self.pendingPlay?.resolve(["stopped": true])
            self.pendingPlay = nil
            call.resolve()
        }
    }

    @objc func endAudioSession(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.player?.stop()
            self.player = nil
            self.pendingPlay?.resolve(["stopped": true])
            self.pendingPlay = nil
            try? AVAudioSession.sharedInstance().setActive(
                false,
                options: .notifyOthersOnDeactivation
            )
            call.resolve()
        }
    }
}

extension NativeExtrasPlugin: AVAudioPlayerDelegate {
    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async {
            self.player = nil
            self.pendingPlay?.resolve(["finished": true])
            self.pendingPlay = nil
            // 播完把会话切回录音分类，通话里的麦克风才能继续用
            self.restoreCallSession()
        }
    }

    public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        DispatchQueue.main.async {
            self.player = nil
            self.pendingPlay?.reject("audio-decode-failed")
            self.pendingPlay = nil
        }
    }
}