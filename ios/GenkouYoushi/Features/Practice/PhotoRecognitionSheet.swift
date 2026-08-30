import PhotosUI
import SwiftUI
import UIKit

struct RecognitionPhoto: Identifiable {
    let id = UUID()
    let data: Data
    let image: UIImage

    init?(data: Data) {
        guard let image = UIImage(data: data) else { return nil }
        self.data = data
        self.image = image
    }
}

struct PhotoRecognitionSheet: View {
    typealias RecognizeAction = (Data, CGRect) async throws -> [KanjiRecognitionCandidate]
    typealias ApplyAction = (String) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var photo: RecognitionPhoto
    @State private var replacementPhoto: PhotosPickerItem?
    @State private var crop = Self.defaultCrop
    @State private var candidates: [KanjiRecognitionCandidate] = []
    @State private var isScanning = false
    @State private var applyingCharacter: String?
    @State private var errorMessage: String?

    let recognize: RecognizeAction
    let apply: ApplyAction

    private static let defaultCrop = CGRect(x: 0.2, y: 0.2, width: 0.6, height: 0.6)

    init(
        photo: RecognitionPhoto,
        recognize: @escaping RecognizeAction,
        apply: @escaping ApplyAction
    ) {
        _photo = State(initialValue: photo)
        self.recognize = recognize
        self.apply = apply
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                let editorSize = fittedEditorSize(availableWidth: geometry.size.width - 40)

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        heading

                        PhotoCropEditor(image: photo.image, crop: $crop, isEnabled: !isScanning)
                            .frame(width: editorSize.width, height: editorSize.height)
                            .frame(maxWidth: .infinity)
                            .overlay {
                                if isScanning {
                                    scanningOverlay
                                }
                            }

                        if candidates.isEmpty {
                            cropHelp
                            scanActions
                        } else {
                            results
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundStyle(PaperPalette.vermilion)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityLabel("Photo recognition error: \(errorMessage)")
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: 660)
                    .frame(maxWidth: .infinity)
                }
            }
            .background(PaperPalette.paper)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") {
                        dismiss()
                    }
                    .disabled(isBusy)
                }
            }
        }
        .interactiveDismissDisabled(isBusy)
        .presentationDragIndicator(.visible)
        .onChange(of: replacementPhoto) { _, item in
            guard let item else { return }
            Task {
                defer { replacementPhoto = nil }
                do {
                    guard
                        let data = try await item.loadTransferable(type: Data.self),
                        let newPhoto = RecognitionPhoto(data: data)
                    else {
                        throw KanjiRecognitionError.invalidImage
                    }
                    photo = newPhoto
                    crop = Self.defaultCrop
                    candidates = []
                    errorMessage = nil
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private var isBusy: Bool {
        isScanning || applyingCharacter != nil
    }

    private var heading: some View {
        HStack(spacing: 12) {
            Image(systemName: "viewfinder")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(PaperPalette.vermilion)
                .frame(width: 42, height: 42)
                .background(PaperPalette.vermilionSoft)

            VStack(alignment: .leading, spacing: 3) {
                Text("PHOTO RECOGNITION")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .tracking(1.5)
                    .foregroundStyle(PaperPalette.faintSumi)

                Text("Recognize kanji")
                    .font(.system(size: 21, weight: .bold, design: .rounded))
            }
        }
    }

    private var cropHelp: some View {
        HStack(spacing: 12) {
            Text("Drag the box to move it. Use the corners to resize.")
                .font(.system(size: 10, design: .rounded))
                .foregroundStyle(PaperPalette.faintSumi)

            Spacer()

            Button("Reset area") {
                crop = Self.defaultCrop
            }
            .font(.system(size: 10, weight: .semibold, design: .rounded))
            .foregroundStyle(PaperPalette.indigo)
            .disabled(isScanning)
        }
    }

    private var scanActions: some View {
        HStack(spacing: 8) {
            PhotosPicker(selection: $replacementPhoto, matching: .images) {
                Text("Choose another")
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(PaperPalette.indigo)
            .overlay { Rectangle().stroke(PaperPalette.indigo.opacity(0.24), lineWidth: 1) }
            .disabled(isScanning)

            Button {
                scan()
            } label: {
                Label(isScanning ? "Scanning…" : "Start scan", systemImage: "viewfinder")
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(PaperPalette.paper)
            .background(PaperPalette.indigo)
            .disabled(isScanning)
        }
    }

    private var scanningOverlay: some View {
        ZStack {
            Color.black.opacity(0.64)

            VStack(spacing: 8) {
                ProgressView()
                    .tint(PaperPalette.paper)
                Text("Scanning image…")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                Text("Looking for kanji candidates")
                    .font(.system(size: 10, design: .rounded))
                    .foregroundStyle(PaperPalette.paper.opacity(0.72))
            }
            .foregroundStyle(PaperPalette.paper)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Scanning image for kanji candidates")
    }

    private var results: some View {
        VStack(alignment: .leading, spacing: 12) {
            Divider()

            VStack(alignment: .leading, spacing: 3) {
                Text("SCAN RESULTS")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .tracking(1.5)
                    .foregroundStyle(PaperPalette.faintSumi)

                Text("Choose the practiced kanji")
                    .font(.system(size: 16, weight: .bold, design: .rounded))

                Text("Selecting a result updates this practice sheet.")
                    .font(.system(size: 10, design: .rounded))
                    .foregroundStyle(PaperPalette.faintSumi)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 76, maximum: 100), spacing: 8)], spacing: 8) {
                ForEach(Array(candidates.enumerated()), id: \.element.id) { index, candidate in
                    Button {
                        apply(candidate)
                    } label: {
                        VStack(spacing: 5) {
                            Text(candidate.character)
                                .font(.system(size: 32, design: .serif))

                            Text(confidenceLabel(candidate, isBestMatch: index == 0))
                                .font(.system(size: 9, weight: .medium, design: .rounded))
                                .foregroundStyle(PaperPalette.faintSumi)
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                        }
                        .frame(maxWidth: .infinity, minHeight: 78)
                        .background(index == 0 ? PaperPalette.vermilionSoft : PaperPalette.paper)
                        .overlay {
                            Rectangle().stroke(
                                index == 0 ? PaperPalette.vermilion.opacity(0.42) : PaperPalette.sumi.opacity(0.12),
                                lineWidth: 1
                            )
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(isBusy)
                    .accessibilityLabel(
                        "Use \(candidate.character), \(Int(candidate.confidence * 100)) percent confidence"
                    )
                    .overlay {
                        if applyingCharacter == candidate.character {
                            ProgressView()
                                .padding(8)
                                .background(PaperPalette.paper.opacity(0.9))
                        }
                    }
                }
            }

            Button("Scan again") {
                candidates = []
                errorMessage = nil
            }
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(PaperPalette.indigo)
            .frame(maxWidth: .infinity, minHeight: 44)
            .overlay { Rectangle().stroke(PaperPalette.indigo.opacity(0.24), lineWidth: 1) }
            .disabled(isBusy)
        }
    }

    private func fittedEditorSize(availableWidth: CGFloat) -> CGSize {
        let maximumWidth = min(max(availableWidth, 220), 620)
        let ratio = max(photo.image.size.width / max(photo.image.size.height, 1), 0.01)
        var width = maximumWidth
        var height = width / ratio
        if height > 420 {
            height = 420
            width = height * ratio
        }
        return CGSize(width: width, height: height)
    }

    private func confidenceLabel(
        _ candidate: KanjiRecognitionCandidate,
        isBestMatch: Bool
    ) -> String {
        let confidence = "\(Int(candidate.confidence * 100))%"
        return isBestMatch ? "Best match · \(confidence)" : confidence
    }

    private func scan() {
        guard !isScanning else { return }
        isScanning = true
        errorMessage = nil
        candidates = []

        Task {
            defer { isScanning = false }
            do {
                candidates = try await recognize(photo.data, crop)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func apply(_ candidate: KanjiRecognitionCandidate) {
        guard applyingCharacter == nil else { return }
        applyingCharacter = candidate.character
        errorMessage = nil

        Task {
            defer { applyingCharacter = nil }
            do {
                try await apply(candidate.character)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct PhotoCropEditor: View {
    enum Interaction {
        case move
        case northwest
        case northeast
        case southwest
        case southeast
    }

    let image: UIImage
    @Binding var crop: CGRect
    let isEnabled: Bool
    @State private var interactionStart: CGRect?

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            let selection = pixelRect(for: crop, in: size)

            ZStack(alignment: .topLeading) {
                Image(uiImage: image)
                    .resizable()
                    .frame(width: size.width, height: size.height)
                    .allowsHitTesting(false)

                CropShade(selection: selection)
                    .allowsHitTesting(false)

                selectionView(selection: selection, imageSize: size)

                cropHandle(
                    interaction: .northwest,
                    systemImage: "arrow.up.left.and.arrow.down.right",
                    position: CGPoint(x: selection.minX, y: selection.minY),
                    imageSize: size
                )
                cropHandle(
                    interaction: .northeast,
                    systemImage: "arrow.up.right.and.arrow.down.left",
                    position: CGPoint(x: selection.maxX, y: selection.minY),
                    imageSize: size
                )
                cropHandle(
                    interaction: .southwest,
                    systemImage: "arrow.down.left.and.arrow.up.right",
                    position: CGPoint(x: selection.minX, y: selection.maxY),
                    imageSize: size
                )
                cropHandle(
                    interaction: .southeast,
                    systemImage: "arrow.down.right.and.arrow.up.left",
                    position: CGPoint(x: selection.maxX, y: selection.maxY),
                    imageSize: size
                )
            }
            .clipped()
            .contentShape(Rectangle())
            .accessibilityLabel("Photo crop editor")
        }
        .background(PaperPalette.canvas)
        .overlay { Rectangle().stroke(PaperPalette.sumi.opacity(0.12), lineWidth: 1) }
    }

    private func selectionView(selection: CGRect, imageSize: CGSize) -> some View {
        ZStack {
            Rectangle()
                .stroke(PaperPalette.paper, lineWidth: 3)
            Rectangle()
                .stroke(PaperPalette.vermilion, lineWidth: 1)

            HStack(spacing: 0) {
                Spacer()
                Divider().overlay(PaperPalette.paper.opacity(0.55))
                Spacer()
                Divider().overlay(PaperPalette.paper.opacity(0.55))
                Spacer()
            }

            VStack(spacing: 0) {
                Spacer()
                Divider().overlay(PaperPalette.paper.opacity(0.55))
                Spacer()
                Divider().overlay(PaperPalette.paper.opacity(0.55))
                Spacer()
            }
        }
        .frame(width: selection.width, height: selection.height)
        .position(x: selection.midX, y: selection.midY)
        .contentShape(Rectangle())
        .gesture(cropGesture(interaction: .move, imageSize: imageSize))
        .allowsHitTesting(isEnabled)
        .accessibilityLabel("Selected scan area. Drag to move.")
    }

    private func cropHandle(
        interaction: Interaction,
        systemImage: String,
        position: CGPoint,
        imageSize: CGSize
    ) -> some View {
        Image(systemName: systemImage)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(PaperPalette.vermilion)
            .frame(width: 18, height: 18)
            .background(PaperPalette.paper, in: Circle())
            .overlay { Circle().stroke(PaperPalette.vermilion, lineWidth: 2) }
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
            .position(position)
            .gesture(cropGesture(interaction: interaction, imageSize: imageSize))
            .allowsHitTesting(isEnabled)
            .accessibilityLabel("Resize scan area")
    }

    private func cropGesture(interaction: Interaction, imageSize: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let initial: CGRect
                if let interactionStart {
                    initial = interactionStart
                } else {
                    initial = crop
                    interactionStart = crop
                }

                let translation = CGSize(
                    width: value.translation.width / max(imageSize.width, 1),
                    height: value.translation.height / max(imageSize.height, 1)
                )
                crop = updatedCrop(from: initial, translation: translation, interaction: interaction)
            }
            .onEnded { _ in
                interactionStart = nil
            }
    }

    private func updatedCrop(
        from initial: CGRect,
        translation: CGSize,
        interaction: Interaction
    ) -> CGRect {
        let minimumSize: CGFloat = 0.12
        if interaction == .move {
            return CGRect(
                x: clamp(initial.minX + translation.width, 0, 1 - initial.width),
                y: clamp(initial.minY + translation.height, 0, 1 - initial.height),
                width: initial.width,
                height: initial.height
            )
        }

        var left = initial.minX
        var top = initial.minY
        var right = initial.maxX
        var bottom = initial.maxY

        if interaction == .northwest || interaction == .southwest {
            left = clamp(initial.minX + translation.width, 0, right - minimumSize)
        } else {
            right = clamp(initial.maxX + translation.width, left + minimumSize, 1)
        }

        if interaction == .northwest || interaction == .northeast {
            top = clamp(initial.minY + translation.height, 0, bottom - minimumSize)
        } else {
            bottom = clamp(initial.maxY + translation.height, top + minimumSize, 1)
        }

        return CGRect(x: left, y: top, width: right - left, height: bottom - top)
    }

    private func pixelRect(for crop: CGRect, in size: CGSize) -> CGRect {
        CGRect(
            x: crop.minX * size.width,
            y: crop.minY * size.height,
            width: crop.width * size.width,
            height: crop.height * size.height
        )
    }

    private func clamp(_ value: CGFloat, _ minimum: CGFloat, _ maximum: CGFloat) -> CGFloat {
        min(max(value, minimum), maximum)
    }
}

private struct CropShade: View {
    let selection: CGRect

    var body: some View {
        Canvas { context, size in
            var path = Path(CGRect(origin: .zero, size: size))
            path.addRect(selection)
            context.fill(
                path,
                with: .color(.black.opacity(0.56)),
                style: FillStyle(eoFill: true)
            )
        }
    }
}
