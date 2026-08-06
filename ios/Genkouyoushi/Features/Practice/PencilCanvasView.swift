import PencilKit
import SwiftUI

struct PencilCanvasView: UIViewRepresentable {
    let selectedTool: WritingTool
    let clearRequestID: UUID

    func makeCoordinator() -> Coordinator {
        Coordinator(clearRequestID: clearRequestID)
    }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvasView = PKCanvasView()
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        canvasView.isScrollEnabled = false
        canvasView.drawingPolicy = .anyInput
        canvasView.tool = tool(for: selectedTool)
        return canvasView
    }

    func updateUIView(_ canvasView: PKCanvasView, context: Context) {
        canvasView.tool = tool(for: selectedTool)

        if context.coordinator.lastClearRequestID != clearRequestID {
            context.coordinator.lastClearRequestID = clearRequestID
            canvasView.drawing = PKDrawing()
        }
    }

    private func tool(for selection: WritingTool) -> any PKTool {
        switch selection {
        case .brush:
            PKInkingTool(.fountainPen, color: UIColor(PaperPalette.sumi), width: 3.8)
        case .pencil:
            PKInkingTool(.pencil, color: UIColor(PaperPalette.mutedSumi), width: 2.2)
        case .eraser:
            PKEraserTool(.vector)
        }
    }

    final class Coordinator {
        var lastClearRequestID: UUID

        init(clearRequestID: UUID) {
            self.lastClearRequestID = clearRequestID
        }
    }
}

