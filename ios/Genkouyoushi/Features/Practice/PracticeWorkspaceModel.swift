import Foundation
import Observation

@MainActor
@Observable
final class PracticeWorkspaceModel {
    let grid = ManuscriptGrid.standard400
    var prompt = PracticePrompt.sample
    var selectedTool: WritingTool = .brush
    var showsGuides = true
    var selectedSection: WorkspaceSection = .practice
    var clearRequestID = UUID()

    func clearDrawing() {
        clearRequestID = UUID()
    }
}

enum WorkspaceSection: String, CaseIterable, Identifiable {
    case practice
    case library
    case templates

    var id: Self { self }

    var title: String {
        switch self {
        case .practice: "Practice"
        case .library: "Library"
        case .templates: "Paper"
        }
    }

    var systemImage: String {
        switch self {
        case .practice: "pencil.and.outline"
        case .library: "books.vertical.fill"
        case .templates: "square.grid.3x3.fill"
        }
    }
}

