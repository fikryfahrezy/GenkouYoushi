import SwiftUI

struct PracticeWorkspaceView: View {
    @Bindable var model: PracticeWorkspaceModel

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 12) {
                navigationRail
                    .frame(width: 82)

                workspace

                if geometry.size.width >= 1_080 {
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
    }

    private var navigationRail: some View {
        VStack(spacing: 8) {
            seal
                .padding(.bottom, 10)

            ForEach(WorkspaceSection.allCases) { section in
                PaperIconButton(
                    title: section.title,
                    systemImage: section.systemImage,
                    isSelected: model.selectedSection == section
                ) {
                    model.selectedSection = section
                }
            }

            Spacer()

            PaperIconButton(title: "Settings", systemImage: "slider.horizontal.3") {}
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

    private var workspace: some View {
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
                Text("400-character vertical manuscript")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(PaperPalette.faintSumi)
            }

            Spacer()

            Label("Ready", systemImage: "checkmark.circle.fill")
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
        VStack(spacing: 12) {
            PaperPanel {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("TODAY'S KANJI")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .tracking(1.5)
                            .foregroundStyle(PaperPalette.faintSumi)

                        Spacer()

                        Text("(model.prompt.strokeCount) strokes")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(PaperPalette.vermilion)
                    }

                    Text(model.prompt.character)
                        .font(.system(size: 94, weight: .regular, design: .serif))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            PaperPalette.vermilionSoft,
                            in: RoundedRectangle(cornerRadius: PaperRadius.control)
                        )

                    Text(model.prompt.meaning.capitalized)
                        .font(.system(size: 17, weight: .bold, design: .rounded))

                    Text(model.prompt.readings.joined(separator: "  ・  "))
                        .font(.system(size: 14, weight: .medium, design: .serif))
                        .foregroundStyle(PaperPalette.mutedSumi)
                }
            }

            PaperPanel {
                VStack(alignment: .leading, spacing: 12) {
                    Text("PAPER GUIDES")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .tracking(1.5)
                        .foregroundStyle(PaperPalette.faintSumi)

                    Button {
                        model.showsGuides.toggle()
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

                    sessionRow(label: "Paper", value: "20 × 20")
                    sessionRow(label: "Capacity", value: "(model.grid.characterCapacity) 字")
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
                selectedTool: model.selectedTool,
                clearRequestID: model.clearRequestID
            )
            .aspectRatio(ManuscriptPaperView.gridAspectRatio(for: model.grid), contentMode: .fit)

            Spacer(minLength: 0)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .padding(ManuscriptPaperView.gridInset)
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
