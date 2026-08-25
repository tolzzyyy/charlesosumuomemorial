import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: make-contact-sheet <image-directory> <output.jpg>\n", stderr)
  exit(1)
}

let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let files = try FileManager.default.contentsOfDirectory(
  at: directory,
  includingPropertiesForKeys: nil
).filter { ["jpg", "jpeg", "png"].contains($0.pathExtension.lowercased()) }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }

let columns = 5
let cellSize = CGSize(width: 180, height: 245)
let rows = Int(ceil(Double(files.count) / Double(columns)))
let sheetSize = CGSize(width: cellSize.width * CGFloat(columns), height: cellSize.height * CGFloat(rows))
let sheet = NSImage(size: sheetSize)

sheet.lockFocus()
NSColor.white.setFill()
NSRect(origin: .zero, size: sheetSize).fill()

for (index, file) in files.enumerated() {
  guard let source = NSImage(contentsOf: file) else { continue }
  let column = index % columns
  let row = index / columns
  let cellOrigin = CGPoint(
    x: CGFloat(column) * cellSize.width,
    y: sheetSize.height - CGFloat(row + 1) * cellSize.height
  )
  let imageBox = CGRect(x: cellOrigin.x + 8, y: cellOrigin.y + 30, width: cellSize.width - 16, height: cellSize.height - 38)
  let scale = min(imageBox.width / source.size.width, imageBox.height / source.size.height)
  let drawSize = CGSize(width: source.size.width * scale, height: source.size.height * scale)
  let drawRect = CGRect(
    x: imageBox.midX - drawSize.width / 2,
    y: imageBox.midY - drawSize.height / 2,
    width: drawSize.width,
    height: drawSize.height
  )
  source.draw(in: drawRect)
  file.deletingPathExtension().lastPathComponent.draw(
    at: CGPoint(x: cellOrigin.x + 8, y: cellOrigin.y + 8),
    withAttributes: [
      .font: NSFont.systemFont(ofSize: 12, weight: .medium),
      .foregroundColor: NSColor.black,
    ]
  )
}

sheet.unlockFocus()

guard
  let tiff = sheet.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.82])
else {
  fputs("Could not create contact sheet\n", stderr)
  exit(1)
}

try jpeg.write(to: output, options: .atomic)
