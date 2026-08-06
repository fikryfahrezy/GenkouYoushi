import PencilKit
import SwiftUI

struct PencilCanvasView: UIViewRepresentable {
    let drawingData: Data
    let selectedTool: WritingTool
    let clearRequestID: UUID
    let undoRequestID: UUID
    let redoRequestID: UUID
    let onDrawingChange: (Data, CGSize) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvasView = PKCanvasView()
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        canvasView.isScrollEnabled = false
        canvasView.drawingPolicy = .anyInput
        canvasView.tool = tool(for: selectedTool)
        canvasView.delegate = context.coordinator
        context.coordinator.apply(drawingData, to: canvasView)
        return canvasView
    }

    func updateUIView(_ canvasView: PKCanvasView, context: Context) {
        context.coordinator.parent = self
        canvasView.tool = tool(for: selectedTool)
        context.coordinator.apply(drawingData, to: canvasView)

        if context.coordinator.lastClearRequestID != clearRequestID {
            context.coordinator.lastClearRequestID = clearRequestID
            canvasView.drawing = PKDrawing()
        }
        if context.coordinator.lastUndoRequestID != undoRequestID {
            context.coordinator.lastUndoRequestID = undoRequestID
            canvasView.undoManager?.undo()
        }
        if context.coordinator.lastRedoRequestID != redoRequestID {
            context.coordinator.lastRedoRequestID = redoRequestID
            canvasView.undoManager?.redo()
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

    @MainActor
    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: PencilCanvasView
        var lastClearRequestID: UUID
        var lastUndoRequestID: UUID
        var lastRedoRequestID: UUID
        private var isApplyingDrawing = false

        init(parent: PencilCanvasView) {
            self.parent = parent
            self.lastClearRequestID = parent.clearRequestID
            self.lastUndoRequestID = parent.undoRequestID
            self.lastRedoRequestID = parent.redoRequestID
        }

        func apply(_ data: Data, to canvasView: PKCanvasView) {
            guard canvasView.drawing.dataRepresentation() != data else { return }
            isApplyingDrawing = true
            canvasView.drawing = (try? PKDrawing(data: data)) ?? PKDrawing()
            isApplyingDrawing = false
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            guard !isApplyingDrawing else { return }
            parent.onDrawingChange(
                canvasView.drawing.dataRepresentation(),
                canvasView.bounds.size
            )
        }
    }
}
