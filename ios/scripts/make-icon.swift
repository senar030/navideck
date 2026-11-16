import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Draws the app icon from the same shapes as public/favicon.svg: dark rounded
// square background, lavender ring, violet dot.
let size = 1024
let colorSpace = CGColorSpaceCreateDeviceRGB()

guard let context = CGContext(
    data: nil,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fatalError("Could not create bitmap context")
}

func color(_ hex: UInt32) -> CGColor {
    let red = CGFloat((hex >> 16) & 0xFF) / 255
    let green = CGFloat((hex >> 8) & 0xFF) / 255
    let blue = CGFloat(hex & 0xFF) / 255
    return CGColor(colorSpace: colorSpace, components: [red, green, blue, 1])!
}

context.setFillColor(color(0x1C1528))
context.fill(CGRect(x: 0, y: 0, width: size, height: size))

let center = CGFloat(size) / 2
let ringRadius = CGFloat(size) * 0.28
let ringWidth = CGFloat(size) * 0.0625
let dotRadius = CGFloat(size) * 0.09375

context.setStrokeColor(color(0xC4A0FF))
context.setLineWidth(ringWidth)
context.strokeEllipse(in: CGRect(
    x: center - ringRadius,
    y: center - ringRadius,
    width: ringRadius * 2,
    height: ringRadius * 2
))

context.setFillColor(color(0x8B5CF6))
context.fillEllipse(in: CGRect(
    x: center - dotRadius,
    y: center - dotRadius,
    width: dotRadius * 2,
    height: dotRadius * 2
))

guard let image = context.makeImage() else {
    fatalError("Could not render image")
}

let output = URL(fileURLWithPath: CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "AppIcon-1024.png")

guard let destination = CGImageDestinationCreateWithURL(
    output as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
) else {
    fatalError("Could not create image destination")
}

CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
    fatalError("Could not write icon")
}
print("Wrote \(output.path)")
