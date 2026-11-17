import SwiftUI

/// Navideck's glass surface. On iOS 26 and newer this is real Liquid Glass,
/// on older systems a thin material with a hairline edge.
extension View {
    @ViewBuilder
    func navideckGlass<S: Shape>(
        _ shape: S,
        tint: Color? = nil,
        interactive: Bool = false
    ) -> some View {
        if #available(iOS 26.0, *) {
            let glass = Glass.clear
                .tint(tint)
                .interactive(interactive)
            self.glassEffect(glass, in: shape)
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .overlay {
                    shape.stroke(Color.white.opacity(0.14), lineWidth: 0.5)
                }
        }
    }
}
