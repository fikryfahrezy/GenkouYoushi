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
    static func render(document: PracticeDocument) -> Data {
        let page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let renderer = UIGraphicsPDFRenderer(bounds: page)

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
            let cell = (page.width - margin * 2) / widthUnits
            let gap = cell * gapRatio
            let gridHeight = cell * CGFloat(document.grid.rows)
            let gridRect = CGRect(
                x: margin,
                y: margin + headerHeight,
                width: page.width - margin * 2,
                height: gridHeight
            )

            drawGrid(document: document, in: gridRect, cell: cell, gap: gap, context: cg)
            drawHeader(document: document, page: page, margin: margin)
            drawInk(document: document, in: gridRect)
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

    private static func drawHeader(document: PracticeDocument, page: CGRect, margin: CGFloat) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
            .foregroundColor: UIColor(red: 0.42, green: 0.53, blue: 0.43, alpha: 0.9)
        ]
        NSString(string: "原稿用紙").draw(at: CGPoint(x: margin, y: margin), withAttributes: attributes)
        let capacity = "\(document.grid.characterCapacity) 字 ・ 縦書き" as NSString
        let width = capacity.size(withAttributes: attributes).width
        capacity.draw(
            at: CGPoint(x: page.width - margin - width, y: margin),
            withAttributes: attributes
        )
    }

    private static func drawInk(document: PracticeDocument, in rect: CGRect) {
        guard
            !document.drawingData.isEmpty,
            document.drawingCanvasSize.width > 0,
            document.drawingCanvasSize.height > 0,
            let drawing = try? PKDrawing(data: document.drawingData)
        else { return }

        let source = CGRect(origin: .zero, size: document.drawingCanvasSize)
        drawing.image(from: source, scale: 2).draw(in: rect)
    }
}
