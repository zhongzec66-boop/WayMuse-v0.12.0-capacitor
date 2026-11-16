import SwiftUI

@main
struct WayMuseApp: App {
    @StateObject private var session = ChatSession()
    @StateObject private var avatarStore = AvatarStore()

    var body: some Scene {
        WindowGroup {
            MainShell()
                .environmentObject(session)
                .environmentObject(avatarStore)
                .tint(Color(red: 3.0 / 255, green: 111.0 / 255, blue: 59.0 / 255))
        }
    }
}
