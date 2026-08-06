import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct PracticeWorkspaceView: View {
    @Bindable var model: PracticeWorkspaceModel
    @State private var exportDocument: PDFExportDocument?
    @State private var isExporting = false
    @State private var selectedPhoto: PhotosPickerItem?

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 12) {
                navigationRail
                    .frame(width: 82)

                sectionContent

                if model.selectedSection == .practice, geometry.size.width >= 1_080 {
                    referencePanel
                        .frame(width: 264)
                }
            }
            .padding(12)
        }
        .background {
            LinearGradient(
                colors: [PaperPalette.canvas, PaperPalette.canvasDeep],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        }
        .foregroundStyle(PaperPalette.sumi)
        .fileExporter(
            isPresented: $isExporting,
            document: exportDocument,
            contentType: .pdf,
            defaultFilename: model.exportFilename
        ) { result in
            if case .failure(let error) = result {
                model.errorMessage = error.localizedDescription
            }
        }
    }

    private var navigationRail: some View {
        VStack(spacing: 8) {
            seal
                .padding(.bottom, 10)

            ForEach(WorkspaceSection.allCases.filter { $0 != .settings }) { section in
                PaperIconButton(
                    title: section.title,
                    systemImage: section.systemImage,
                    isSelected: model.selectedSection == section
                ) {
                    model.selectedSection = section
                }
            }

            Spacer()

            PaperIconButton(
                title: WorkspaceSection.settings.title,
                systemImage: WorkspaceSection.settings.systemImage,
                isSelected: model.selectedSection == .settings
            ) {
                model.selectedSection = .settings
            }
        }
        .padding(8)
        .background(PaperPalette.paper.opacity(0.62), in: RoundedRectangle(cornerRadius: PaperRadius.panel))
        .overlay {
            RoundedRectangle(cornerRadius: PaperRadius.panel)
                .stroke(PaperPalette.sumi.opacity(0.08), lineWidth: 1)
        }
    }

    private var seal: some View {
        ZStack {
            RoundedRectangle(cornerRadius: PaperRadius.control)
                .fill(PaperPalette.vermilion)

            Text("原")
                .font(.system(size: 23, weight: .bold, design: .serif))
                .foregroundStyle(PaperPalette.paper)
        }
        .frame(width: 46, height: 46)
        .accessibilityLabel("Genkou Youshi")
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch model.selectedSection {
        case .practice:
            practiceWorkspace
        case .library:
            libraryView
        case .templates:
            templatesView
        case .settings:
            settingsView
        }
    }

    private var practiceWorkspace: some View {
        VStack(spacing: 0) {
            workspaceHeader

            GeometryReader { geometry in
                let availableWidth = max(geometry.size.width - 48, 100)
                let availableHeight = max(geometry.size.height - 36, 100)
                let paperSize = fittedPaperSize(width: availableWidth, height: availableHeight)

                ZStack(alignment: .bottom) {
                    Color.clear

                    ZStack {
                        ManuscriptPaperView(
                            grid: model.grid,
                            prompt: model.prompt,
                            showsGuides: model.showsGuides
                        )

                        drawingSurface
                    }
                    .frame(width: paperSize.width, height: paperSize.height)

                    toolShelf
                        .padding(.bottom, 14)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(PaperPalette.sumi.opacity(0.035), in: RoundedRectangle(cornerRadius: PaperRadius.panel))
        .clipShape(RoundedRectangle(cornerRadius: PaperRadius.panel))
    }

    private var workspaceHeader: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Writing practice")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                Text("\(model.grid.characterCapacity)-character vertical manuscript")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(PaperPalette.faintSumi)
            }

            Spacer()

            HStack(spacing: 4) {
                headerButton(systemImage: "arrow.uturn.backward", label: "Undo") {
                    model.undo()
                }
                headerButton(systemImage: "arrow.uturn.forward", label: "Redo") {
                    model.redo()
                }
                headerButton(systemImage: "square.and.arrow.up", label: "Export") {
                    exportDocument = model.exportPDF()
                    isExporting = true
                }
            }

            Label(model.isSaving ? "Saving" : model.statusMessage, systemImage: model.isSaving ? "arrow.triangle.2.circlepath" : "checkmark.circle.fill")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(PaperPalette.grid)
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(
                    PaperPalette.paper.opacity(0.55),
                    in: RoundedRectangle(cornerRadius: PaperRadius.control)
                )
        }
        .padding(.horizontal, 18)
        .frame(height: 62)
        .background(PaperPalette.paper.opacity(0.5))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(PaperPalette.sumi.opacity(0.07))
                .frame(height: 1)
        }
    }

    private var toolShelf: some View {
        HStack(spacing: 6) {
            ForEach(WritingTool.allCases) { tool in
                PaperToolButton(
                    title: tool.title,
                    systemImage: tool.systemImage,
                    isSelected: model.selectedTool == tool
                ) {
                    model.selectedTool = tool
                }
            }

            Rectangle()
                .fill(PaperPalette.sumi.opacity(0.12))
                .frame(width: 1, height: 24)
                .padding(.horizontal, 3)

            Button(role: .destructive) {
                model.clearDrawing()
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(PaperPalette.vermilion)
                    .frame(width: 40, height: 40)
                    .background(PaperPalette.vermilionSoft, in: RoundedRectangle(cornerRadius: PaperRadius.control))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Clear drawing")
        }
        .padding(6)
        .background(
            PaperPalette.paper.opacity(0.96),
            in: RoundedRectangle(cornerRadius: PaperRadius.control)
        )
        .overlay {
            RoundedRectangle(cornerRadius: PaperRadius.control)
                .stroke(PaperPalette.sumi.opacity(0.1), lineWidth: 1)
        }
        .shadow(color: PaperPalette.paperShadow, radius: 12, y: 5)
    }

    private var referencePanel: some View {
        let isRecognizing = model.isRecognizingKanji
        let accentColor = PaperPalette.indigo

        return VStack(spacing: 12) {
            PaperPanel {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("TODAY'S KANJI")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .tracking(1.5)
                            .foregroundStyle(PaperPalette.faintSumi)

                        Spacer()

                        Text(model.prompt.strokeCount > 0 ? "\(model.prompt.strokeCount) strokes" : "Reference")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(PaperPalette.vermilion)
                    }

                    Group {
                        if let svg = model.prompt.strokeOrderSVGs.last {
                            SVGReferenceView(data: svg)
                                .padding(8)
                        } else {
                            Text(model.prompt.character)
                                .font(.system(size: 94, weight: .regular, design: .serif))
                        }
                    }
                        .frame(maxWidth: .infinity)
                        .frame(height: 124)
                        .padding(.vertical, 8)
                        .background(
                            PaperPalette.vermilionSoft,
                            in: RoundedRectangle(cornerRadius: PaperRadius.control)
                        )

                    HStack(spacing: 6) {
                        TextField("Kanji", text: $model.kanjiQuery)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .font(.system(size: 18, weight: .semibold, design: .serif))
                            .padding(.horizontal, 10)
                            .frame(height: 38)
                            .background(PaperPalette.paper)
                            .overlay {
                                Rectangle().stroke(PaperPalette.sumi.opacity(0.16), lineWidth: 1)
                            }
                            .onSubmit { Task { await model.lookupKanji() } }

                        Button {
                            Task { await model.lookupKanji() }
                        } label: {
                            Image(systemName: model.isLoadingKanji ? "hourglass" : "arrow.right")
                                .frame(width: 38, height: 38)
                                .foregroundStyle(PaperPalette.paper)
                                .background(PaperPalette.indigo)
                        }
                        .buttonStyle(.plain)
                        .disabled(model.isLoadingKanji)
                    }

                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Label(
                            isRecognizing ? "Reading image…" : "Recognize from photo",
                            systemImage: "viewfinder"
                        )
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(accentColor)
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .overlay { Rectangle().stroke(accentColor.opacity(0.28), lineWidth: 1) }
                    }
                    .disabled(isRecognizing)
                    .onChange(of: selectedPhoto) { _, item in
                        guard let item else { return }
                        Task {
                            if let data = try? await item.loadTransferable(type: Data.self) {
                                await model.recognizeKanji(imageData: data)
                            }
                            selectedPhoto = nil
                        }
                    }

                    Text(model.prompt.note)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(PaperPalette.mutedSumi)

                    if let error = model.errorMessage {
                        Text(error)
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundStyle(PaperPalette.vermilion)
                    }
                }
            }

            PaperPanel {
                VStack(alignment: .leading, spacing: 12) {
                    Text("PAPER GUIDES")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .tracking(1.5)
                        .foregroundStyle(PaperPalette.faintSumi)

                    Button {
                        model.toggleGuides()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Tracing guides")
                                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                                Text("Fade through three cells")
                                    .font(.system(size: 10, design: .rounded))
                                    .foregroundStyle(PaperPalette.faintSumi)
                            }

                            Spacer()

                            Image(systemName: model.showsGuides ? "checkmark.square.fill" : "square")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(model.showsGuides ? PaperPalette.grid : PaperPalette.faintSumi)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            PaperPanel {
                VStack(alignment: .leading, spacing: 8) {
                    Text("SESSION")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .tracking(1.5)
                        .foregroundStyle(PaperPalette.faintSumi)

                    sessionRow(label: "Paper", value: "\(model.grid.columns) × \(model.grid.rows)")
                    sessionRow(label: "Capacity", value: "\(model.grid.characterCapacity) 字")
                    sessionRow(label: "Direction", value: "Vertical")
                }
            }

            Spacer()
        }
    }

    private var drawingSurface: some View {
        VStack(spacing: ManuscriptPaperView.headerSpacing) {
            Color.clear
                .frame(height: ManuscriptPaperView.headerHeight)

            PencilCanvasView(
                drawingData: model.drawingData,
                selectedTool: model.selectedTool,
                clearRequestID: model.clearRequestID,
                undoRequestID: model.undoRequestID,
                redoRequestID: model.redoRequestID
            ) { data, size in
                model.drawingDidChange(data: data, canvasSize: size)
            }
            .aspectRatio(ManuscriptPaperView.gridAspectRatio(for: model.grid), contentMode: .fit)

            Spacer(minLength: 0)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .padding(ManuscriptPaperView.gridInset)
    }

    private var libraryView: some View {
        sectionPanel(title: "Practice library", subtitle: "Your editable manuscript sheets") {
            HStack {
                Spacer()
                Button("New sheet", systemImage: "plus") {
                    model.createDocument()
                }
                .buttonStyle(PaperActionButtonStyle())
            }

            if model.documents.isEmpty {
                ContentUnavailableView(
                    "No practice sheets",
                    systemImage: "doc.text",
                    description: Text("Create a sheet and begin writing.")
                )
                .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], spacing: 12) {
                        ForEach(model.documents) { document in
                            documentCard(document)
                        }
                    }
                }
            }
        }
    }

    private var templatesView: some View {
        sectionPanel(title: "Paper", subtitle: "Choose the manuscript capacity") {
            HStack(alignment: .top, spacing: 14) {
                templateCard(title: "Standard", detail: "20 × 20 ・ 400 characters", grid: .standard400)
                templateCard(title: "Compact", detail: "10 × 20 ・ 200 characters", grid: .compact200)
                Spacer()
            }
            Spacer()
        }
    }

    private var settingsView: some View {
        sectionPanel(title: "Settings", subtitle: "A quiet workspace for focused handwriting") {
            PaperPanel {
                VStack(alignment: .leading, spacing: 14) {
                    settingRow("Storage", value: "On-device, automatic")
                    Divider()
                    settingRow("Writing", value: "Apple Pencil + touch")
                    Divider()
                    settingRow("Export", value: "PDF manuscript")
                    Divider()
                    settingRow("Compatibility", value: "iPad only ・ Swift 6")
                }
            }
            .frame(maxWidth: 520)
            Spacer()
        }
    }

    private func sectionPanel<Content: View>(
        title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                Text(subtitle)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(PaperPalette.faintSumi)
            }
            content()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(PaperPalette.paper.opacity(0.54), in: RoundedRectangle(cornerRadius: PaperRadius.panel))
    }

    private func documentCard(_ document: PracticeDocument) -> some View {
        Button {
            model.open(document)
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    Text(document.prompt.character)
                        .font(.system(size: 48, design: .serif))
                    Spacer()
                    Button(role: .destructive) {
                        Task { await model.delete(document) }
                    } label: {
                        Image(systemName: "trash")
                            .foregroundStyle(PaperPalette.vermilion)
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                }
                Text(document.title)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                Text("\(document.grid.characterCapacity) characters ・ \(document.updatedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.system(size: 10, design: .rounded))
                    .foregroundStyle(PaperPalette.faintSumi)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PaperPalette.paper)
            .overlay { Rectangle().stroke(PaperPalette.sumi.opacity(0.12), lineWidth: 1) }
        }
        .buttonStyle(.plain)
    }

    private func templateCard(title: String, detail: String, grid: ManuscriptGrid) -> some View {
        Button {
            model.selectGrid(grid)
            model.selectedSection = .practice
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: "square.grid.3x3")
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(PaperPalette.grid)
                Text(title)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                Text(detail)
                    .font(.system(size: 11, design: .rounded))
                    .foregroundStyle(PaperPalette.faintSumi)
            }
            .padding(18)
            .frame(width: 250, height: 150, alignment: .topLeading)
            .background(model.grid == grid ? PaperPalette.vermilionSoft : PaperPalette.paper)
            .overlay {
                Rectangle().stroke(
                    model.grid == grid ? PaperPalette.vermilion : PaperPalette.sumi.opacity(0.12),
                    lineWidth: model.grid == grid ? 2 : 1
                )
            }
        }
        .buttonStyle(.plain)
    }

    private func headerButton(systemImage: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .frame(width: 32, height: 30)
                .background(PaperPalette.paper.opacity(0.7))
                .overlay { Rectangle().stroke(PaperPalette.sumi.opacity(0.1), lineWidth: 1) }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func settingRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).fontWeight(.semibold)
            Spacer()
            Text(value).foregroundStyle(PaperPalette.faintSumi)
        }
        .font(.system(size: 13, design: .rounded))
    }

    private func sessionRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(PaperPalette.faintSumi)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
        .font(.system(size: 12, design: .rounded))
    }

    private func fittedPaperSize(width: CGFloat, height: CGFloat) -> CGSize {
        let aspectRatio: CGFloat = 0.707
        let widthFromHeight = height * aspectRatio

        if widthFromHeight <= width {
            return CGSize(width: widthFromHeight, height: height)
        }

        return CGSize(width: width, height: width / aspectRatio)
    }
}

#Preview("Writing workspace", traits: .landscapeLeft) {
    PracticeWorkspaceView(model: PracticeWorkspaceModel())
        .frame(width: 1_366, height: 1_024)
}
