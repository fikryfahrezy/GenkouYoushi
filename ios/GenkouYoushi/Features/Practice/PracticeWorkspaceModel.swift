import CoreGraphics
import Foundation
import Observation

@MainActor
@Observable
final class PracticeWorkspaceModel {
    var grid = ManuscriptGrid.standard400
    var prompt = PracticePrompt.sample
    var selectedTool: WritingTool = .brush
    var strokeWidth: CGFloat = 3.8
    var showsGuides = true
    var selectedSection: WorkspaceSection = .practice
    var clearRequestID = UUID()
    var undoRequestID = UUID()
    var redoRequestID = UUID()
    var markupData: Data?
    var drawingData = Data()
    var drawingCanvasSize = CGSize.zero
    var documents: [PracticeDocument] = []
    var activeDocumentID: UUID
    var isLoadingDocuments = true
    var kanjiQuery = "永"
    var isLoadingKanji = false
    var isRecognizingKanji = false
    var isSaving = false
    var statusMessage = "Ready"
    var errorMessage: String?

    @ObservationIgnored private let kanjiService: any KanjiServing
    @ObservationIgnored private let repository: any PracticeStoring
    @ObservationIgnored private let recognizer: any KanjiRecognizing
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var createdAt: Date
    @ObservationIgnored private var hasStartedLoadingDocuments = false

    init(
        kanjiService: any KanjiServing = KanjiAPIService(),
        repository: any PracticeStoring = PracticeRepository(),
        recognizer: any KanjiRecognizing = KanjiRecognitionService()
    ) {
        let initial = PracticeDocument.new()
        self.kanjiService = kanjiService
        self.repository = repository
        self.recognizer = recognizer
        self.activeDocumentID = initial.id
        self.createdAt = initial.createdAt
    }

    deinit {
        saveTask?.cancel()
    }

    func loadDocuments() async {
        guard !hasStartedLoadingDocuments else { return }
        hasStartedLoadingDocuments = true

        do {
            let stored = try await repository.loadAll()
            if let first = stored.first {
                documents = stored
                apply(first)
            } else {
                // Never keep the whole workspace behind the loading screen while
                // a first-run save (or legacy-document recovery) is in progress.
                isLoadingDocuments = false
                await saveNow()
                return
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoadingDocuments = false
    }

    func lookupKanji() async {
        guard !isLoadingKanji else { return }
        isLoadingKanji = true
        errorMessage = nil

        do {
            let reference = try await kanjiService.lookup(
                character: kanjiQuery,
                includesNumbers: false
            )
            prompt.character = reference.character
            prompt.strokeOrderSVGs = reference.strokeOrderSVGs
            kanjiQuery = reference.character
            statusMessage = "Reference updated"
            scheduleSave()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoadingKanji = false
    }

    func recognizeKanji(imageData: Data) async {
        guard !isRecognizingKanji else { return }
        isRecognizingKanji = true
        errorMessage = nil
        do {
            kanjiQuery = try await recognizer.recognize(imageData: imageData)
            await lookupKanji()
        } catch {
            errorMessage = error.localizedDescription
        }
        isRecognizingKanji = false
    }

    func markupDidChange(data: Data) {
        markupData = data
        statusMessage = "Editing"
        scheduleSave()
    }

    func clearDrawing() {
        markupData = nil
        drawingData = Data()
        clearRequestID = UUID()
        statusMessage = "Cleared"
        scheduleSave()
    }

    func undo() {
        undoRequestID = UUID()
    }

    func redo() {
        redoRequestID = UUID()
    }

    func toggleGuides() {
        showsGuides.toggle()
        scheduleSave()
    }

    func createDocument(grid: ManuscriptGrid = .standard400) {
        saveTask?.cancel()
        let newDocument = PracticeDocument.new(grid: grid)
        apply(newDocument)
        documents.insert(newDocument, at: 0)
        selectedSection = .practice
        Task { await saveNow() }
    }

    func open(_ document: PracticeDocument) {
        apply(document)
        selectedSection = .practice
    }

    func delete(_ document: PracticeDocument) async {
        do {
            try await repository.delete(id: document.id)
            documents.removeAll { $0.id == document.id }
            if activeDocumentID == document.id {
                if let next = documents.first {
                    apply(next)
                } else {
                    createDocument()
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveNow() async {
        saveTask?.cancel()
        isSaving = true
        var document = snapshot()
        document.updatedAt = Date()

        do {
            try await repository.save(document)
            upsert(document)
            statusMessage = "Saved"
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = "Save failed"
        }
        isSaving = false
    }

    func exportPDF() async -> PDFExportDocument {
        PDFExportDocument(data: await ManuscriptPDFRenderer.render(document: snapshot()))
    }

    var exportFilename: String {
        let value = prompt.character.isEmpty ? "practice" : prompt.character
        return "\(value)-genkou-youshi"
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(650))
            guard !Task.isCancelled else { return }
            await self?.saveNow()
        }
    }

    private func snapshot() -> PracticeDocument {
        PracticeDocument(
            id: activeDocumentID,
            title: "\(prompt.character) practice",
            prompt: prompt,
            grid: grid,
            showsGuides: showsGuides,
            markupData: markupData,
            drawingData: drawingData,
            drawingCanvasSize: drawingCanvasSize,
            createdAt: createdAt,
            updatedAt: Date()
        )
    }

    private func apply(_ document: PracticeDocument) {
        saveTask?.cancel()
        activeDocumentID = document.id
        createdAt = document.createdAt
        grid = document.grid
        prompt = document.prompt
        showsGuides = document.showsGuides
        markupData = document.markupData
        drawingData = document.drawingData
        drawingCanvasSize = document.drawingCanvasSize
        kanjiQuery = document.prompt.character
        statusMessage = "Ready"
        clearRequestID = UUID()
    }

    private func upsert(_ document: PracticeDocument) {
        documents.removeAll { $0.id == document.id }
        documents.insert(document, at: 0)
    }
}

enum WorkspaceSection: String, CaseIterable, Identifiable {
    case practice
    case library

    var id: Self { self }

    var title: String {
        switch self {
        case .practice: "Practice"
        case .library: "Library"
        }
    }

    var systemImage: String {
        switch self {
        case .practice: "pencil.and.outline"
        case .library: "books.vertical.fill"
        }
    }
}
