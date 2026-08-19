import PaperKit
import PencilKit
import SwiftUI
import UIKit

/// PaperKit owns the interactive canvas, including high-quality zooming and
/// panning. PencilKit remains the ink engine behind the selected drawing tool.
struct PaperKitViewportView: UIViewControllerRepresentable {
    let grid: ManuscriptGrid
    let prompt: PracticePrompt
    let showsGuides: Bool
    let viewportResetID: String
    let markupData: Data?
    let drawingData: Data
    let drawingCanvasSize: CGSize
    let selectedTool: WritingTool
    let strokeWidth: CGFloat
    let clearRequestID: UUID
    let undoRequestID: UUID
    let redoRequestID: UUID
    let onMarkupChange: (Data) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIViewController(context: Context) -> PaperKitHostViewController {
        let hostViewController = PaperKitHostViewController()
        context.coordinator.install(on: hostViewController)
        return hostViewController
    }

    func updateUIViewController(_ hostViewController: PaperKitHostViewController, context: Context) {
        context.coordinator.parent = self
        context.coordinator.update(hostViewController)
    }

    private var paperView: some View {
        let paperSize = ManuscriptPaperCoordinateSpace.paperSize(for: grid)
        return ManuscriptPaperView(grid: grid, prompt: prompt, showsGuides: showsGuides)
            .frame(width: paperSize.width, height: paperSize.height)
    }

    @MainActor
    final class Coordinator: NSObject, PaperMarkupViewController.Delegate {
        var parent: PaperKitViewportView
        var paperHost: UIHostingController<AnyView>?

        private var lastViewportResetID = ""
        private var lastInputMarkupData: Data?
        private var lastClearRequestID: UUID
        private var lastUndoRequestID: UUID
        private var lastRedoRequestID: UUID
        private var installedGrid: ManuscriptGrid?
        private var installedPrompt: PracticePrompt?
        private var installedShowsGuides: Bool?
        private var installedTool: WritingTool?
        private var installedStrokeWidth: CGFloat?
        private var serializationGeneration = 0
        private var markupSerializationTask: Task<Void, Never>?

        init(parent: PaperKitViewportView) {
            self.parent = parent
            self.lastClearRequestID = parent.clearRequestID
            self.lastUndoRequestID = parent.undoRequestID
            self.lastRedoRequestID = parent.redoRequestID
        }

        func install(on hostViewController: PaperKitHostViewController) {
            hostViewController.makePaperViewController = { [weak self] in
                guard let self else { return nil }
                return self.makePaperViewController()
            }
        }

        func update(_ hostViewController: PaperKitHostViewController) {
            guard let viewController = hostViewController.paperViewController else { return }
            update(viewController)
        }

        private func makePaperViewController() -> PaperMarkupViewController {
            let viewController = PaperMarkupViewController(
                markup: makeMarkup(),
                supportedFeatureSet: .latest
            )
            viewController.delegate = self
            viewController.zoomRange = 0.25...3
            // Keep direct (finger) input in drawing mode. Letting PaperKit
            // choose automatically can switch a finger back to selection mode
            // as Pencil availability changes.
            viewController.directTouchMode = .drawing
            viewController.directTouchAutomaticallyDraws = false
            viewController.isEditable = true
            viewController.drawingTool = tool()

            let paperHost = UIHostingController(rootView: AnyView(parent.paperView))
            paperHost.view.backgroundColor = .clear
            paperHost.view.isOpaque = false
            paperHost.view.frame = ManuscriptPaperCoordinateSpace.bounds(for: parent.grid)
            viewController.contentView = paperHost.view
            self.paperHost = paperHost
            recordInstalledPaperAppearance()
            installedTool = parent.selectedTool
            installedStrokeWidth = parent.strokeWidth
            recordInstalledMarkup()
            resetVisibleFrame(on: viewController)
            return viewController
        }

        private func update(_ viewController: PaperMarkupViewController) {
            updatePaperAppearanceIfNeeded(on: viewController)
            updateDrawingToolIfNeeded(on: viewController)

            let changedDocument = lastViewportResetID != parent.viewportResetID
            let receivedExternalMarkup = lastInputMarkupData != parent.markupData
            if changedDocument || receivedExternalMarkup {
                viewController.markup = makeMarkup()
                recordInstalledMarkup()
                resetVisibleFrame(on: viewController)
            }

            if lastClearRequestID != parent.clearRequestID {
                lastClearRequestID = parent.clearRequestID
                viewController.markup = PaperMarkup(
                    bounds: ManuscriptPaperCoordinateSpace.bounds(for: parent.grid)
                )
                lastInputMarkupData = nil
                resetVisibleFrame(on: viewController)
            }
            if lastUndoRequestID != parent.undoRequestID {
                lastUndoRequestID = parent.undoRequestID
                viewController.undoManager?.undo()
            }
            if lastRedoRequestID != parent.redoRequestID {
                lastRedoRequestID = parent.redoRequestID
                viewController.undoManager?.redo()
            }
        }

        func paperMarkupViewControllerDidChangeMarkup(_ paperMarkupViewController: PaperMarkupViewController) {
            guard let markup = paperMarkupViewController.markup else { return }
            serializationGeneration += 1
            let generation = serializationGeneration

            // PaperKit may report several changes while it is completing one
            // stroke. Serializing each intermediate document makes the main
            // actor compete with its renderer and was freezing the canvas at
            // the end of a Pencil stroke. Persist the settled result instead.
            markupSerializationTask?.cancel()
            markupSerializationTask = Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(450))
                guard !Task.isCancelled else { return }
                guard let data = try? await markup.dataRepresentation() else { return }
                guard
                    let self,
                    !Task.isCancelled,
                    generation == self.serializationGeneration
                else { return }
                self.lastInputMarkupData = data
                self.parent.onMarkupChange(data)
            }
        }

        func paperMarkupViewControllerDidChangeSelection(_ paperMarkupViewController: PaperMarkupViewController) {}
        func paperMarkupViewControllerDidBeginDrawing(_ paperMarkupViewController: PaperMarkupViewController) {}
        func paperMarkupViewControllerDidChangeContentVisibleFrame(_ paperMarkupViewController: PaperMarkupViewController) {}

        func makeMarkup() -> PaperMarkup {
            if let markupData = parent.markupData,
               let markup = try? PaperMarkup(dataRepresentation: markupData) {
                return markup
            }

            var markup = PaperMarkup(bounds: ManuscriptPaperCoordinateSpace.bounds(for: parent.grid))
            guard
                !parent.drawingData.isEmpty,
                let legacyDrawing = try? PKDrawing(data: parent.drawingData)
            else { return markup }

            let sourceSize = parent.drawingCanvasSize.width > 0 && parent.drawingCanvasSize.height > 0
                ? parent.drawingCanvasSize
                : ManuscriptPaperCoordinateSpace.gridRect(for: parent.grid).size
            let destination = ManuscriptPaperCoordinateSpace.gridRect(for: parent.grid)
            let transform = CGAffineTransform(
                a: destination.width / sourceSize.width,
                b: 0,
                c: 0,
                d: destination.height / sourceSize.height,
                tx: destination.minX,
                ty: destination.minY
            )
            markup.append(contentsOf: legacyDrawing.transformed(using: transform))
            return markup
        }

        func tool() -> any PKTool {
            let width = min(
                max(parent.strokeWidth, WritingTool.minimumStrokeWidth),
                WritingTool.maximumStrokeWidth
            )

            return switch parent.selectedTool {
            case .brush:
                PKInkingTool(.fountainPen, color: InkColor.sumi, width: width)
            case .pencil:
                PKInkingTool(.pencil, color: InkColor.mutedSumi, width: width)
            case .eraser:
                PKEraserTool(.vector)
            }
        }

        func recordInstalledMarkup() {
            lastViewportResetID = parent.viewportResetID
            lastInputMarkupData = parent.markupData
        }

        private func recordInstalledPaperAppearance() {
            installedGrid = parent.grid
            installedPrompt = parent.prompt
            installedShowsGuides = parent.showsGuides
        }

        /// A PaperKit markup callback changes `markupData`, which causes SwiftUI
        /// to call `updateUIViewController`. Rebuilding `contentView` there
        /// makes PaperKit re-layout and report another markup change, creating
        /// an unbounded render/persistence loop. Only rebuild paper content
        /// when its visible inputs actually changed.
        private func updatePaperAppearanceIfNeeded(on viewController: PaperMarkupViewController) {
            guard
                installedGrid != parent.grid ||
                installedPrompt != parent.prompt ||
                installedShowsGuides != parent.showsGuides
            else { return }

            paperHost?.rootView = AnyView(parent.paperView)
            paperHost?.view.frame = ManuscriptPaperCoordinateSpace.bounds(for: parent.grid)
            recordInstalledPaperAppearance()
            viewController.contentView = paperHost?.view
        }

        private func updateDrawingToolIfNeeded(on viewController: PaperMarkupViewController) {
            guard
                installedTool != parent.selectedTool ||
                installedStrokeWidth != parent.strokeWidth
            else { return }

            installedTool = parent.selectedTool
            installedStrokeWidth = parent.strokeWidth
            viewController.drawingTool = tool()
        }

        func resetVisibleFrame(on viewController: PaperMarkupViewController) {
            let bounds = ManuscriptPaperCoordinateSpace.bounds(for: parent.grid)
            DispatchQueue.main.async {
                viewController.setContentVisibleFrame(bounds, animated: false)
            }
        }
    }

    private enum InkColor {
        static let sumi = UIColor(red: 0.12, green: 0.11, blue: 0.09, alpha: 1)
        static let mutedSumi = UIColor(red: 0.34, green: 0.32, blue: 0.27, alpha: 1)
    }
}

@MainActor
final class PaperKitHostViewController: UIViewController {
    var makePaperViewController: (() -> PaperMarkupViewController?)?
    private(set) var paperViewController: PaperMarkupViewController?
    private var hasRequestedPaperViewController = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !hasRequestedPaperViewController else { return }
        hasRequestedPaperViewController = true

        // Let SwiftUI replace its startup progress view before PaperKit creates
        // its renderer. PaperKit then receives a fully attached view hierarchy.
        DispatchQueue.main.async { [weak self] in
            self?.installPaperViewController()
        }
    }

    private func installPaperViewController() {
        guard let paperViewController = makePaperViewController?() else { return }
        addChild(paperViewController)
        paperViewController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(paperViewController.view)
        NSLayoutConstraint.activate([
            paperViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            paperViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            paperViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            paperViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        paperViewController.didMove(toParent: self)
        self.paperViewController = paperViewController
    }
}

enum ManuscriptPaperCoordinateSpace {
    private static let gridWidth: CGFloat = 1_000

    static func paperSize(for grid: ManuscriptGrid) -> CGSize {
        let gridRect = gridRect(for: grid)
        return CGSize(
            width: gridRect.maxX + ManuscriptPaperView.gridInset,
            height: gridRect.maxY + ManuscriptPaperView.gridInset
        )
    }

    static func bounds(for grid: ManuscriptGrid) -> CGRect {
        CGRect(origin: .zero, size: paperSize(for: grid))
    }

    static func gridRect(for grid: ManuscriptGrid) -> CGRect {
        CGRect(
            x: ManuscriptPaperView.gridInset,
            y: ManuscriptPaperView.gridInset
                + ManuscriptPaperView.headerHeight
                + ManuscriptPaperView.headerSpacing,
            width: gridWidth,
            height: gridWidth / ManuscriptPaperView.gridAspectRatio(for: grid)
        )
    }
}
