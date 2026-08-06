import Foundation

struct ManuscriptGrid: Equatable, Sendable {
    let columns: Int
    let rows: Int

    var characterCapacity: Int { columns * rows }

    static let standard400 = ManuscriptGrid(columns: 20, rows: 20)
}

struct PracticePrompt: Equatable, Sendable {
    let character: String
    let meaning: String
    let readings: [String]
    let strokeCount: Int

    static let sample = PracticePrompt(
        character: "永",
        meaning: "eternity",
        readings: ["エイ", "ながい"],
        strokeCount: 5
    )
}

enum WritingTool: String, CaseIterable, Identifiable, Sendable {
    case brush
    case pencil
    case eraser

    var id: Self { self }

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

