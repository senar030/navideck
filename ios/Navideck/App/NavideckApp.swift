import SwiftUI

@main
struct NavideckApp: App {
    @State private var app = AppModel()

    init() {
        let cache = URLCache(
            memoryCapacity: 64 * 1024 * 1024,
            diskCapacity: 512 * 1024 * 1024,
            diskPath: "navideck-artwork"
        )
        URLCache.shared = cache
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
    }
}

struct NavideckMark: View {
    var size: CGFloat = 64

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .fill(Color(hex: 0x1C1528))
            Circle()
                .stroke(Theme.accent, lineWidth: size * 0.0625)
                .frame(width: size * 0.56, height: size * 0.56)
            Circle()
                .fill(Theme.accentDeep)
                .frame(width: size * 0.19, height: size * 0.19)
        }
        .frame(width: size, height: size)
    }
}
