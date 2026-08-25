import AppKit
import Foundation
import PDFKit

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: swift extract-pdf-pages.swift input.pdf output-directory\n", stderr)
  exit(1)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)

guard let document = PDFDocument(url: inputURL) else {
  fputs("Could not read the PDF.\n", stderr)
  exit(1)
}

try FileManager.default.createDirectory(
  at: outputURL,
  withIntermediateDirectories: true
)

for pageIndex in 0..<document.pageCount {
  guard let page = document.page(at: pageIndex) else { continue }

  let bounds = page.bounds(for: .mediaBox)
  let targetWidth = 1_200.0
  let scale = targetWidth / bounds.width
  let targetSize = NSSize(
    width: targetWidth,
    height: max(1, bounds.height * scale)
  )
  let image = page.thumbnail(of: targetSize, for: .mediaBox)

  guard
    let tiffData = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiffData),
    let jpegData = bitmap.representation(
      using: .jpeg,
      properties: [.compressionFactor: 0.84]
    )
  else {
    fputs("Could not render page \(pageIndex + 1).\n", stderr)
    continue
  }

  let filename = String(format: "charles-%02d.jpg", pageIndex + 1)
  try jpegData.write(to: outputURL.appendingPathComponent(filename))
  print(filename)
}
