import PaperKit
import PencilKit
import SwiftUI
import UniformTypeIdentifiers
import UIKit

struct PDFExportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.pdf] }

    let data: Data

    init(data: Data) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.data = data
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

enum ManuscriptPDFRenderer {
    static func render(document: PracticeDocument) async -> Data {
        let page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let ink = await renderedInk(for: document)

        return renderer.pdfData { context in
            context.beginPage()
            let cg = context.cgContext

            UIColor(red: 0.985, green: 0.969, blue: 0.91, alpha: 1).setFill()
            cg.fill(page)

            let margin: CGFloat = 42
            let headerHeight: CGFloat = 24
            let gapRatio = ManuscriptPaperView.columnGapRatio
            let widthUnits = CGFloat(document.grid.columns)
                + CGFloat(max(document.grid.columns - 1, 0)) * gapRatio
            let availableWidth = page.width - margin * 2
            let availableHeight = page.height - margin * 2 - headerHeight
            let cell = min(
                availableWidth / widthUnits,
                availableHeight / CGFloat(document.grid.rows)
            )
            let gap = cell * gapRatio
            let gridWidth = CGFloat(document.grid.columns) * cell
                + CGFloat(max(document.grid.columns - 1, 0)) * gap
            let gridHeight = cell * CGFloat(document.grid.rows)
            let gridRect = CGRect(
                x: (page.width - gridWidth) / 2,
                y: margin + headerHeight,
                width: gridWidth,
                height: gridHeight
            )

            drawGrid(document: document, in: gridRect, cell: cell, gap: gap, context: cg)
            drawHeader(document: document, gridRect: gridRect, headerY: margin)
            ink?.draw(in: gridRect)
        }
    }

    private static func drawGrid(
        document: PracticeDocument,
        in rect: CGRect,
        cell: CGFloat,
        gap: CGFloat,
        context: CGContext
    ) {
        context.saveGState()
        context.setStrokeColor(UIColor(red: 0.42, green: 0.53, blue: 0.43, alpha: 0.8).cgColor)
        context.setLineWidth(0.45)

        for column in 0..<document.grid.columns {
            let x = rect.minX + CGFloat(column) * (cell + gap)
            let strip = CGRect(x: x, y: rect.minY, width: cell, height: rect.height)
            context.stroke(strip)

            for row in 1..<document.grid.rows {
                let y = rect.minY + CGFloat(row) * cell
                context.move(to: CGPoint(x: x, y: y))
                context.addLine(to: CGPoint(x: x + cell, y: y))
            }
            context.strokePath()

            context.setStrokeColor(UIColor(red: 0.42, green: 0.53, blue: 0.43, alpha: 0.24).cgColor)
            context.setLineWidth(0.22)
            for row in 0..<document.grid.rows {
                let y = rect.minY + CGFloat(row) * cell
                context.move(to: CGPoint(x: x + cell / 2, y: y + cell * 0.08))
                context.addLine(to: CGPoint(x: x + cell / 2, y: y + cell * 0.92))
                context.move(to: CGPoint(x: x + cell * 0.08, y: y + cell / 2))
                context.addLine(to: CGPoint(x: x + cell * 0.92, y: y + cell / 2))
            }
            context.strokePath()
            context.setStrokeColor(UIColor(red: 0.42, green: 0.53, blue: 0.43, alpha: 0.8).cgColor)
            context.setLineWidth(0.45)
        }
        context.restoreGState()
    }

    private static func drawHeader(document: PracticeDocument, gridRect: CGRect, headerY: CGFloat) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
            .foregroundColor: UIColor(red: 0.42, green: 0.53, blue: 0.43, alpha: 0.9)
        ]
        NSString(string: "原稿用紙").draw(
            at: CGPoint(x: gridRect.minX, y: headerY),
            withAttributes: attributes
        )
        let capacity = "\(document.grid.characterCapacity) 字 ・ 縦書き" as NSString
        let width = capacity.size(withAttributes: attributes).width
        capacity.draw(
            at: CGPoint(x: gridRect.maxX - width, y: headerY),
            withAttributes: attributes
        )
    }

    private static func renderedInk(for document: PracticeDocument) async -> UIImage? {
        if let markupData = document.markupData,
           let markup = try? PaperMarkup(dataRepresentation: markupData) {
            let paperBounds = ManuscriptPaperCoordinateSpace.bounds(for: document.grid)
            let gridRect = ManuscriptPaperCoordinateSpace.gridRect(for: document.grid)
            let scale: CGFloat = 3
            let width = Int((paperBounds.width * scale).rounded(.up))
            let height = Int((paperBounds.height * scale).rounded(.up))
            guard let context = CGContext(
                data: nil,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: 0,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return nil }

            context.scaleBy(x: scale, y: scale)
            await markup.draw(in: context, frame: paperBounds)
            guard let image = context.makeImage() else { return nil }
            let cropRect = CGRect(
                x: gridRect.minX * scale,
                y: gridRect.minY * scale,
                width: gridRect.width * scale,
                height: gridRect.height * scale
            ).integral
            guard let croppedImage = image.cropping(to: cropRect) else { return nil }
            return UIImage(cgImage: croppedImage, scale: scale, orientation: .up)
        }

        guard
            !document.drawingData.isEmpty,
            document.drawingCanvasSize.width > 0,
            document.drawingCanvasSize.height > 0,
            let drawing = try? PKDrawing(data: document.drawingData)
        else { return nil }

        let source = CGRect(origin: .zero, size: document.drawingCanvasSize)
        return drawing.image(from: source, scale: 3)
    }
}
