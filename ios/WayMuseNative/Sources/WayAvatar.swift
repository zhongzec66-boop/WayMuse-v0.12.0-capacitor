import SwiftUI
import PhotosUI
import UIKit

@MainActor
final class AvatarStore: ObservableObject {
    @Published private(set) var image: UIImage?
    private let fileName = "custom-avatar.jpg"

    init() {
        image = (try? Data(contentsOf: fileURL)).flatMap(UIImage.init(data:))
    }

    private var fileURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(fileName)
    }

    func save(_ original: UIImage) {
        let side: CGFloat = 512
        let shortest = min(original.size.width, original.size.height)
        guard shortest > 0 else { return }
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        let square = renderer.image { _ in
            let scale = side / shortest
            let width = original.size.width * scale
            let height = original.size.height * scale
            original.draw(in: CGRect(x: (side - width) / 2, y: (side - height) / 2, width: width, height: height))
        }
        guard let data = square.jpegData(compressionQuality: 0.82) else { return }
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: fileURL, options: .atomic)
            image = square
        } catch {
            // Keep the previous avatar when storage is unavailable.
        }
    }

    func reset() {
        try? FileManager.default.removeItem(at: fileURL)
        image = nil
    }
}

enum WayAvatarState {
    case idle, typing, thinking
}

struct WayAvatar: View {
    @EnvironmentObject private var avatarStore: AvatarStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let state: WayAvatarState
    let size: CGFloat
    private let brand = Color(red: 3.0 / 255, green: 111.0 / 255, blue: 59.0 / 255)

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 20.0, paused: reduceMotion)) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            let pulse: CGFloat = reduceMotion ? 0 : CGFloat(sin(time * (state == .thinking ? 4.0 : 2.0)))
            Group {
                if let photo = avatarStore.image {
                    Image(uiImage: photo)
                        .resizable()
                        .scaledToFill()
                        .frame(width: size, height: size)
                        .clipShape(Circle())
                        .scaleEffect(1 + pulse * 0.025)
                } else {
                    ZStack {
                        Circle().fill(brand)
                        HStack(spacing: size * 0.13) {
                            eye(time: time, offset: -1)
                            eye(time: time, offset: 1)
                        }
                        .offset(y: reduceMotion ? 0 : CGFloat(sin(time * 2.3)) * size * 0.025)
                    }
                    .frame(width: size, height: size)
                    .scaleEffect(1 + pulse * 0.035)
                    .rotationEffect(.degrees(reduceMotion ? 0 : sin(time * 1.5) * (state == .thinking ? 4 : 1.5)))
                }
            }
            .frame(width: size, height: size)
        }
        .accessibilityLabel(avatarStore.image == nil ? "WayMuse 动态头像" : "自定义动态头像")
    }

    private func eye(time: TimeInterval, offset: Double) -> some View {
        let blink = sin(time * 0.8 + offset) > 0.985
        return Ellipse()
            .fill(.white)
            .frame(width: size * 0.21, height: size * (blink && !reduceMotion ? 0.035 : 0.21))
    }
}

struct AvatarPhotoPicker: UIViewControllerRepresentable {
    let onPick: (UIImage) -> Void

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .images
        configuration.selectionLimit = 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onPick: (UIImage) -> Void
        init(onPick: @escaping (UIImage) -> Void) { self.onPick = onPick }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else { return }
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                guard let image = object as? UIImage else { return }
                DispatchQueue.main.async { self.onPick(image) }
            }
        }
    }
}
