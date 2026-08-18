import CoreGraphics
import Foundation

nonisolated struct ManuscriptGrid: Codable, Equatable, Sendable {
    let columns: Int
    let rows: Int

    var characterCapacity: Int { columns * rows }

    static let standard400 = ManuscriptGrid(columns: 20, rows: 20)
    static let compact200 = ManuscriptGrid(columns: 10, rows: 20)
}

nonisolated struct PracticePrompt: Codable, Equatable, Sendable {
    var character: String
    var strokeOrderSVGs: [Data]

    var strokeCount: Int { strokeOrderSVGs.count }

    static let sample = PracticePrompt(
        character: "永",
        strokeOrderSVGs: []
    )
}

nonisolated struct PracticeDocument: Codable, Equatable, Identifiable, Sendable {
    var id: UUID
    var title: String
    var prompt: PracticePrompt
    var grid: ManuscriptGrid
    var showsGuides: Bool
    var drawingData: Data
    var drawingCanvasSize: CGSize
    var createdAt: Date
    var updatedAt: Date

    static func new(prompt: PracticePrompt = .sample, grid: ManuscriptGrid = .standard400) -> Self {
        let now = Date()
        return PracticeDocument(
            id: UUID(),
            title: "\(prompt.character) practice",
            prompt: prompt,
            grid: grid,
            showsGuides: true,
            drawingData: Data(),
            drawingCanvasSize: .zero,
            createdAt: now,
            updatedAt: now
        )
    }
}

enum WritingTool: String, CaseIterable, Identifiable, Sendable {
    case brush
    case pencil
    case eraser

    var id: Self { self }

    static let minimumStrokeWidth: CGFloat = 1
    static let maximumStrokeWidth: CGFloat = 12

    var supportsStrokeWidth: Bool {
        self != .eraser
    }

    var title: String {
        switch self {
        case .brush: "Brush"
        case .pencil: "Pencil"
        case .eraser: "Eraser"
        }
    }

    var systemImage: String {
        switch self {
        case .brush: "paintbrush.pointed.fill"
        case .pencil: "pencil.tip"
        case .eraser: "eraser.fill"
        }
    }
}
