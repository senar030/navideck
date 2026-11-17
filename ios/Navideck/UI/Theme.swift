import SwiftUI

/// The palette is taken from the web app so both versions look like Navideck.
enum Theme {
    static let background = Color(hex: 0x140E1F)
    static let backgroundLift = Color(hex: 0x1B1330)
    static let surface = Color(hex: 0x241A38)
    static let surfaceHigh = Color(hex: 0x322347)
    static let accent = Color(hex: 0xC3A5FF)
    static let accentDeep = Color(hex: 0x9D7BF5)
    static let text = Color(hex: 0xF2ECFD)
    static let muted = Color(hex: 0xA99CC4)
    static let danger = Color(hex: 0xEE9AA6)
    static let hairline = Color.white.opacity(0.08)
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

/// Height of the floating Start/pill/Suche row, published by `MainTabs`.
/// Screens reserve it at their bottom edge so nothing is hidden behind it.
private struct BottomBarInsetKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

extension EnvironmentValues {
    var bottomBarInset: CGFloat {
        get { self[BottomBarInsetKey.self] }
        set { self[BottomBarInsetKey.self] = newValue }
    }
}

extension View {
    /// Puts every screen on the app's own dark background and keeps the last
    /// rows clear of the floating bottom bar. The navigation bar stays
    /// transparent: painting it made iOS 26/27 hide the large title.
    func navideckScreen() -> some View {
        modifier(NavideckScreenChrome())
    }
}

private struct NavideckScreenChrome: ViewModifier {
    @Environment(\.bottomBarInset) private var inset

    func body(content: Content) -> some View {
        content
            .background(Theme.background.ignoresSafeArea())
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Color.clear.frame(height: inset)
            }
    }
}
