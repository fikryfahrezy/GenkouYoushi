import PencilKit
import SwiftUI
import UIKit

/// A UIKit-owned paper viewport. UIKit performs pan and zoom for the complete
/// paper/canvas composition, while PencilKit remains responsible for ink.
struct PaperViewportView: UIViewRepresentable {
    let grid: ManuscriptGrid
    let prompt: PracticePrompt
    let showsGuides: Bool
    let paperSize: CGSize
    let viewportResetID: String
    let drawingData: Data
    let selectedTool: WritingTool
    let strokeWidth: CGFloat
    let clearRequestID: UUID
    let undoRequestID: UUID
    let redoRequestID: UUID
    let onDrawingChange: (Data, CGSize) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> PaperViewportContainer {
        let container = PaperViewportContainer()
        context.coordinator.install(on: container)
        context.coordinator.update(container)
        return container
    }

    func updateUIView(_ container: PaperViewportContainer, context: Context) {
        context.coordinator.parent = self
        context.coordinator.update(container)
    }

    @MainActor
    final class Coordinator: NSObject, PKCanvasViewDelegate, UIGestureRecognizerDelegate {
        var parent: PaperViewportView
        private var lastClearRequestID: UUID
        private var lastUndoRequestID: UUID
        private var lastRedoRequestID: UUID
        private var lastAppliedDrawingData: Data?
        private var lastAppliedScale: CGFloat?
        private var lastPaperSize = CGSize.zero
        private var lastViewportResetID = ""
        private var drawingDataBeforeViewportGesture: Data?
        private var isApplyingDrawing = false
        private var isViewportGestureActive = false
        private var isPanActive = false
        private var isPinchActive = false

        init(parent: PaperViewportView) {
            self.parent = parent
            self.lastClearRequestID = parent.clearRequestID
            self.lastUndoRequestID = parent.undoRequestID
            self.lastRedoRequestID = parent.redoRequestID
        }

        func install(on container: PaperViewportContainer) {
            container.canvas.delegate = self

            let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handleViewportPan(_:)))
            panGesture.minimumNumberOfTouches = 2
            panGesture.maximumNumberOfTouches = 2
            panGesture.cancelsTouchesInView = true
            panGesture.delegate = self
            container.addGestureRecognizer(panGesture)

            let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(handleViewportPinch(_:)))
            pinchGesture.cancelsTouchesInView = true
            pinchGesture.delegate = self
            container.addGestureRecognizer(pinchGesture)
        }

        func update(_ container: PaperViewportContainer) {
            container.updatePaper(grid: parent.grid, prompt: parent.prompt, showsGuides: parent.showsGuides)

            let requiresViewportReset =
                lastPaperSize != parent.paperSize ||
                lastViewportResetID != parent.viewportResetID
            if requiresViewportReset {
                lastPaperSize = parent.paperSize
                lastViewportResetID = parent.viewportResetID
                container.resetViewport(paperSize: parent.paperSize, grid: parent.grid)
                lastAppliedScale = nil
            }

            let renderScale = container.renderScale
            container.canvas.tool = tool(for: parent.selectedTool, visibleScale: renderScale)

            guard !isViewportGestureActive else { return }
            apply(parent.drawingData, to: container.canvas, at: renderScale)

            if lastClearRequestID != parent.clearRequestID {
                lastClearRequestID = parent.clearRequestID
                apply(Data(), to: container.canvas, at: renderScale, force: true)
            }
            if lastUndoRequestID != parent.undoRequestID {
                lastUndoRequestID = parent.undoRequestID
                container.canvas.undoManager?.undo()
            }
            if lastRedoRequestID != parent.redoRequestID {
                lastRedoRequestID = parent.redoRequestID
                container.canvas.undoManager?.redo()
            }
        }

        @objc private func handleViewportPan(_ recognizer: UIPanGestureRecognizer) {
            guard let container = recognizer.view as? PaperViewportContainer else { return }

            switch recognizer.state {
            case .began:
                isPanActive = true
                beginViewportGesture(on: container)
            case .changed:
                let translation = recognizer.translation(in: container)
                container.pan(by: translation)
                recognizer.setTranslation(.zero, in: container)
            case .ended, .cancelled, .failed:
                isPanActive = false
                endViewportGestureIfNeeded(on: container)
            default:
                break
            }
        }

        @objc private func handleViewportPinch(_ recognizer: UIPinchGestureRecognizer) {
            guard let container = recognizer.view as? PaperViewportContainer else { return }

            switch recognizer.state {
            case .began:
                isPinchActive = true
                beginViewportGesture(on: container)
            case .changed:
                container.zoom(by: recognizer.scale)
                recognizer.scale = 1
            case .ended, .cancelled, .failed:
                isPinchActive = false
                endViewportGestureIfNeeded(on: container)
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
            guard !isApplyingDrawing, !isViewportGestureActive else { return }
            let renderScale = lastAppliedScale ?? 1
            let drawingData = sourceDrawingData(from: canvasView.drawing, at: renderScale)
            lastAppliedDrawingData = drawingData
            lastAppliedScale = renderScale
            parent.onDrawingChange(
                drawingData,
                gridRect(for: parent.paperSize, grid: parent.grid).size
            )
        }

        private func beginViewportGesture(on container: PaperViewportContainer) {
            guard !isViewportGestureActive else { return }
            isViewportGestureActive = true
            drawingDataBeforeViewportGesture = lastAppliedDrawingData ?? parent.drawingData
            container.beginLiveViewportPreview()
            apply(drawingDataBeforeViewportGesture ?? Data(), to: container.canvas, at: 1, force: true)
            container.canvas.drawingPolicy = .pencilOnly
        }

        private func endViewportGestureIfNeeded(on container: PaperViewportContainer) {
            guard !isPanActive, !isPinchActive, isViewportGestureActive else { return }
            let drawingData = drawingDataBeforeViewportGesture ?? parent.drawingData
            container.endLiveViewportPreview(grid: parent.grid)
            let renderScale = container.renderScale
            apply(drawingData, to: container.canvas, at: renderScale, force: true)
            container.canvas.tool = tool(for: parent.selectedTool, visibleScale: renderScale)
            container.canvas.drawingPolicy = .anyInput
            drawingDataBeforeViewportGesture = nil
            isViewportGestureActive = false
        }

        private func apply(_ data: Data, to canvasView: PKCanvasView, at scale: CGFloat, force: Bool = false) {
            let hasSameScale = lastAppliedScale.map { abs($0 - scale) <= 0.0001 } ?? false
            guard force || lastAppliedDrawingData != data || !hasSameScale else { return }

            isApplyingDrawing = true
            canvasView.drawing = displayDrawing(from: data, at: scale)
            isApplyingDrawing = false
            lastAppliedDrawingData = data
            lastAppliedScale = scale
        }

        private func tool(for selection: WritingTool, visibleScale: CGFloat) -> any PKTool {
            let width = min(
                max(parent.strokeWidth, WritingTool.minimumStrokeWidth),
                WritingTool.maximumStrokeWidth
            ) * visibleScale

            return switch selection {
            case .brush:
                PKInkingTool(.fountainPen, color: InkColor.sumi, width: width)
            case .pencil:
                PKInkingTool(.pencil, color: InkColor.mutedSumi, width: width)
            case .eraser:
                PKEraserTool(.vector)
            }
        }

        private func displayDrawing(from data: Data, at scale: CGFloat) -> PKDrawing {
            let drawing = (try? PKDrawing(data: data)) ?? PKDrawing()
            return drawing.transformed(using: paperTransform(at: scale))
        }

        private func sourceDrawingData(from drawing: PKDrawing, at scale: CGFloat) -> Data {
            return drawing
                .transformed(using: paperTransform(at: scale).inverted())
                .dataRepresentation()
        }

        /// Drawings stay stored in grid-local coordinates, keeping existing
        /// documents compatible. The visible canvas now spans the paper, so
        /// translate ink into paper coordinates for display.
        private func paperTransform(at scale: CGFloat) -> CGAffineTransform {
            let gridOrigin = gridRect(for: parent.paperSize, grid: parent.grid).origin
            return CGAffineTransform(
                a: scale,
                b: 0,
                c: 0,
                d: scale,
                tx: gridOrigin.x * scale,
                ty: gridOrigin.y * scale
            )
        }

        private func gridRect(for paperSize: CGSize, grid: ManuscriptGrid) -> CGRect {
            ManuscriptPaperLayout.gridRect(in: paperSize, grid: grid)
        }
    }

    private enum InkColor {
        static let sumi = UIColor(red: 0.12, green: 0.11, blue: 0.09, alpha: 1)
        static let mutedSumi = UIColor(red: 0.34, green: 0.32, blue: 0.27, alpha: 1)
    }
}

@MainActor
final class PaperViewportContainer: UIView {
    let canvas = PKCanvasView()
    private let contentView = UIView()
    private var paperHost: UIHostingController<ManuscriptPaperView>?
    private var paperSize = CGSize.zero
    private var grid = ManuscriptGrid.standard400
    private var prompt = PracticePrompt.sample
    private var showsGuides = true
    private var scale: CGFloat = 1
    private var offset = CGSize.zero
    private var isShowingLivePreview = false

    var renderScale: CGFloat { isShowingLivePreview ? 1 : scale }

    override init(frame: CGRect) {
        super.init(frame: frame)
        clipsToBounds = true
        backgroundColor = .clear

        contentView.clipsToBounds = false
        addSubview(contentView)

        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.isScrollEnabled = false
        canvas.clipsToBounds = true
        canvas.drawingPolicy = .anyInput
        contentView.addSubview(canvas)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard paperSize.width > 0, paperSize.height > 0 else { return }
        if isShowingLivePreview {
            updateLivePreviewTransform()
        } else {
            layoutSharpPaper()
        }
    }

    func updatePaper(grid: ManuscriptGrid, prompt: PracticePrompt, showsGuides: Bool) {
        self.grid = grid
        self.prompt = prompt
        self.showsGuides = showsGuides
        updatePaperHost()
    }

    private func updatePaperHost() {
        let paper = ManuscriptPaperView(
            grid: grid,
            prompt: prompt,
            showsGuides: showsGuides,
            layoutScale: isShowingLivePreview ? 1 : scale
        )
        if let paperHost {
            paperHost.rootView = paper
        } else {
            let paperHost = UIHostingController(rootView: paper)
            paperHost.view.backgroundColor = .clear
            paperHost.view.isOpaque = false
            contentView.insertSubview(paperHost.view, belowSubview: canvas)
            self.paperHost = paperHost
        }
    }

    func resetViewport(paperSize: CGSize, grid: ManuscriptGrid) {
        self.paperSize = paperSize
        self.grid = grid
        scale = 1
        offset = .zero
        isShowingLivePreview = false
        updatePaperHost()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layoutSharpPaper()
        CATransaction.commit()
    }

    func beginLiveViewportPreview() {
        guard !isShowingLivePreview else { return }
        isShowingLivePreview = true
        updatePaperHost()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        contentView.transform = .identity
        contentView.bounds = CGRect(origin: .zero, size: paperSize)
        contentView.center = viewportCenter(offset: offset)
        paperHost?.view.frame = contentView.bounds
        canvas.frame = contentView.bounds
        canvas.layer.cornerRadius = PaperRadius.sheet
        updateLivePreviewTransform()
        CATransaction.commit()
    }

    func endLiveViewportPreview(grid: ManuscriptGrid) {
        self.grid = grid
        isShowingLivePreview = false
        updatePaperHost()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layoutSharpPaper()
        CATransaction.commit()
    }

    func pan(by translation: CGPoint) {
        offset = clampedOffset(
            CGSize(width: offset.width + translation.x, height: offset.height + translation.y)
        )
        updateLivePreviewTransform()
    }

    func zoom(by scaleDelta: CGFloat) {
        scale = min(max(scale * scaleDelta, 1), 3)
        offset = clampedOffset(offset)
        updateLivePreviewTransform()
    }

    private func layoutSharpPaper() {
        let scaledPaperSize = CGSize(width: paperSize.width * scale, height: paperSize.height * scale)
        contentView.transform = .identity
        contentView.bounds = CGRect(origin: .zero, size: scaledPaperSize)
        contentView.center = viewportCenter(offset: offset)
        paperHost?.view.frame = contentView.bounds
        canvas.frame = contentView.bounds
        canvas.layer.cornerRadius = PaperRadius.sheet * scale
    }

    private func updateLivePreviewTransform() {
        guard isShowingLivePreview else { return }
        contentView.center = viewportCenter(offset: offset)
        contentView.transform = CGAffineTransform(scaleX: scale, y: scale)
    }

    private func viewportCenter(offset: CGSize) -> CGPoint {
        CGPoint(x: bounds.midX + offset.width, y: bounds.midY + offset.height)
    }

    private func clampedOffset(_ proposedOffset: CGSize) -> CGSize {
        let horizontalLimit = max((paperSize.width * scale - bounds.width) / 2, 0)
        let verticalLimit = max((paperSize.height * scale - bounds.height) / 2, 0)
        return CGSize(
            width: min(max(proposedOffset.width, -horizontalLimit), horizontalLimit),
            height: min(max(proposedOffset.height, -verticalLimit), verticalLimit)
        )
    }

    private func gridRect(in paperSize: CGSize, grid: ManuscriptGrid) -> CGRect {
        let scale = paperSize.width / self.paperSize.width
        let inset = ManuscriptPaperView.gridInset * scale
        let headerHeight = ManuscriptPaperView.headerHeight * scale
        let headerSpacing = ManuscriptPaperView.headerSpacing * scale
        let gridWidth = paperSize.width - inset * 2
        let gridHeight = gridWidth / ManuscriptPaperView.gridAspectRatio(for: grid)
        return CGRect(
            x: inset,
            y: inset + headerHeight + headerSpacing,
            width: gridWidth,
            height: gridHeight
        )
    }
}
