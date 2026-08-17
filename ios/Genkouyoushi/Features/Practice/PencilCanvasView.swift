import PencilKit
import SwiftUI

struct PencilCanvasView: UIViewRepresentable {
    let drawingData: Data
    let selectedTool: WritingTool
    let clearRequestID: UUID
    let undoRequestID: UUID
    let redoRequestID: UUID
    @Binding var isViewportGestureActive: Bool
    let onViewportPan: (CGSize) -> Void
    let onViewportZoom: (CGFloat) -> Void
    let onDrawingChange: (Data, CGSize) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvasView = ViewportGuardedCanvasView()
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        canvasView.isScrollEnabled = false
        canvasView.drawingPolicy = .anyInput
        canvasView.tool = tool(for: selectedTool)
        canvasView.delegate = context.coordinator
        context.coordinator.installViewportGestures(on: canvasView)
        canvasView.onTwoFingerTouchBegan = { canvasView in
            context.coordinator.beginViewportGesture(on: canvasView)
        }
        canvasView.onTwoFingerTouchEnded = { canvasView in
            context.coordinator.endViewportGestureIfNeeded(on: canvasView)
        }
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
    final class Coordinator: NSObject, PKCanvasViewDelegate, UIGestureRecognizerDelegate {
        var parent: PencilCanvasView
        var lastClearRequestID: UUID
        var lastUndoRequestID: UUID
        var lastRedoRequestID: UUID
        private var isApplyingDrawing = false
        private var isPanActive = false
        private var isPinchActive = false
        private var drawingBeforeViewportGesture: PKDrawing?

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

        func installViewportGestures(on canvasView: PKCanvasView) {
            guard canvasView.gestureRecognizers?.contains(where: { $0.name == "sheetViewportPan" }) != true else {
                return
            }

            let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handleViewportPan(_:)))
            panGesture.name = "sheetViewportPan"
            panGesture.minimumNumberOfTouches = 2
            panGesture.maximumNumberOfTouches = 2
            panGesture.cancelsTouchesInView = true
            panGesture.delegate = self
            canvasView.addGestureRecognizer(panGesture)

            let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(handleViewportPinch(_:)))
            pinchGesture.name = "sheetViewportPinch"
            pinchGesture.cancelsTouchesInView = true
            pinchGesture.delegate = self
            canvasView.addGestureRecognizer(pinchGesture)
        }

        @objc private func handleViewportPan(_ recognizer: UIPanGestureRecognizer) {
            guard let canvasView = recognizer.view as? PKCanvasView else { return }

            switch recognizer.state {
            case .began:
                isPanActive = true
                beginViewportGesture(on: canvasView)
            case .changed:
                let translation = recognizer.translation(in: canvasView.superview)
                parent.onViewportPan(CGSize(width: translation.x, height: translation.y))
                recognizer.setTranslation(.zero, in: canvasView.superview)
            case .ended, .cancelled, .failed:
                isPanActive = false
                endViewportGestureIfNeeded(on: canvasView)
            default:
                break
            }
        }

        @objc private func handleViewportPinch(_ recognizer: UIPinchGestureRecognizer) {
            guard let canvasView = recognizer.view as? PKCanvasView else { return }

            switch recognizer.state {
            case .began:
                isPinchActive = true
                beginViewportGesture(on: canvasView)
            case .changed:
                parent.onViewportZoom(recognizer.scale)
                recognizer.scale = 1
            case .ended, .cancelled, .failed:
                isPinchActive = false
                endViewportGestureIfNeeded(on: canvasView)
            default:
                break
            }
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            true
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            guard !isApplyingDrawing, !parent.isViewportGestureActive else { return }
            parent.onDrawingChange(
                canvasView.drawing.dataRepresentation(),
                canvasView.bounds.size
            )
        }

        func beginViewportGesture(on canvasView: PKCanvasView) {
            guard !parent.isViewportGestureActive else { return }
            drawingBeforeViewportGesture = canvasView.drawing
            parent.isViewportGestureActive = true
            canvasView.drawingPolicy = .pencilOnly
        }

        func endViewportGestureIfNeeded(on canvasView: PKCanvasView) {
            guard !isPanActive, !isPinchActive else { return }
            if let drawingBeforeViewportGesture {
                isApplyingDrawing = true
                canvasView.drawing = drawingBeforeViewportGesture
                isApplyingDrawing = false
            }
            drawingBeforeViewportGesture = nil
            canvasView.drawingPolicy = .anyInput
            parent.isViewportGestureActive = false
        }
    }
}

private final class ViewportGuardedCanvasView: PKCanvasView {
    var onTwoFingerTouchBegan: ((PKCanvasView) -> Void)?
    var onTwoFingerTouchEnded: ((PKCanvasView) -> Void)?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        if activeTouchCount(in: event) >= 2 {
            onTwoFingerTouchBegan?(self)
        }
        super.touchesBegan(touches, with: event)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        if activeTouchCount(in: event) >= 2 {
            onTwoFingerTouchBegan?(self)
        }
        super.touchesMoved(touches, with: event)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        if activeTouchCount(in: event) < 2 {
            onTwoFingerTouchEnded?(self)
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesCancelled(touches, with: event)
        if activeTouchCount(in: event) < 2 {
            onTwoFingerTouchEnded?(self)
        }
    }

    private func activeTouchCount(in event: UIEvent?) -> Int {
        event?.allTouches?.filter { touch in
            touch.phase != .ended && touch.phase != .cancelled
        }.count ?? 0
    }
}
