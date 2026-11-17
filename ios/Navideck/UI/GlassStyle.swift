import SwiftUI

/// Navideck's own glass surface. It is deliberately not `glassEffect`:
/// the system glass refracts whatever sits behind it, which over cover art
/// drew a second rim and a shadow around the mini player. This is a thin
/// material, very slightly tinted, with a gradient edge — see-through, but
/// without those artefacts.
extension View {
    func navideckGlass<S: Shape>(_ shape: S, tint: Color? = nil) -> some View {
        background {
            GlassBackdrop(shape: shape, tint: tint)
        }
    }
}

struct GlassBackdrop<S: Shape>: View {
    let shape: S
    var tint: Color?

    var body: some View {
        ZStack {
            shape
                .fill(.ultraThinMaterial)
                .opacity(0.85)

            shape.fill(Theme.background.opacity(0.22))

            if let tint {
                shape.fill(tint)
            }

            shape.stroke(
                LinearGradient(
                    colors: [Color.white.opacity(0.32), Color.white.opacity(0.06)],
                    startPoint: .top,
                    endPoint: .bottom
                ),
                lineWidth: 0.7
            )
        }
    }
}
