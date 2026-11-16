import SwiftUI

@main
struct WayMuseApp: App {
    @StateObject private var session = ChatSession()

    var body: some Scene {
        WindowGroup {
            MainShell()
                .environmentObject(session)
        }
    }
}
