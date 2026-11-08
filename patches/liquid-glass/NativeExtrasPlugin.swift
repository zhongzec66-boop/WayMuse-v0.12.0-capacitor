import Foundation
import Capacitor
import UIKit
import AVFoundation
import Speech
import EventKit

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
    ]

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var recognizing = false
    private let eventStore = EKEventStore()

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
            try session.setCategory(
                .playAndRecord,
                mode: .measurement,
                options: [.duckOthers, .defaultToSpeaker]
            )
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            if preferOnDevice && recognizer.supportsOnDeviceRecognition {
                request.requiresOnDeviceRecognition = true
            }
            self.request = request

            let input = engine.inputNode
            let format = input.inputFormat(forBus: 0)
            input.removeTap(onBus: 0)
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
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        request = nil
        task?.cancel()
        task = nil
        recognizing = false
        try? AVAudioSession.sharedInstance().setActive(
            false,
            options: .notifyOthersOnDeactivation
        )
    }
}
