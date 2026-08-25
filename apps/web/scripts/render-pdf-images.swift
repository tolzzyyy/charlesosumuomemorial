import AppKit
import Foundation
import PDFKit

guard CommandLine.arguments.count >= 4 else {
  fputs("Usage: render-pdf-images <input.pdf> <output-directory> <filename-prefix> [max-pixels]\n", stderr)
  exit(1)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let prefix = CommandLine.arguments[3]
let maxPixels = CGFloat(Double(CommandLine.arguments.dropFirst(4).first ?? "1600") ?? 1600)

guard let document = PDFDocument(url: inputURL) else {
  fputs("Could not open PDF at \(inputURL.path)\n", stderr)
  exit(1)
}

try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)

for pageIndex in 0..<document.pageCount {
  guard let page = document.page(at: pageIndex) else { continue }
  let bounds = page.bounds(for: .mediaBox)
  let scale = min(1, maxPixels / max(bounds.width, bounds.height))
  let outputSize = CGSize(
    width: max(1, (bounds.width * scale).rounded()),
    height: max(1, (bounds.height * scale).rounded())
  )
  let thumbnail = page.thumbnail(of: outputSize, for: .mediaBox)
  var proposedRect = CGRect(origin: .zero, size: outputSize)

  guard
    let cgImage = thumbnail.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil),
    let jpeg = NSBitmapImageRep(cgImage: cgImage).representation(
      using: .jpeg,
      properties: [.compressionFactor: 0.72]
    )
  else {
    fputs("Could not render page \(pageIndex + 1)\n", stderr)
    continue
  }

  let filename = "\(prefix)-\(String(format: "%02d", pageIndex + 1)).jpg"
  try jpeg.write(to: outputURL.appendingPathComponent(filename), options: .atomic)
  print("Rendered \(filename) at \(Int(outputSize.width))x\(Int(outputSize.height))")
}
