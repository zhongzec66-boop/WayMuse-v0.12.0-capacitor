import SwiftUI

@main
struct WayMuseApp: App {
    @StateObject private var session = ChatSession()

    var body: some Scene {
        WindowGroup {
            MainShell()
                .environmentObject(session)
                .tint(Color(red: 3.0 / 255, green: 111.0 / 255, blue: 59.0 / 255))
        }
    }
}
