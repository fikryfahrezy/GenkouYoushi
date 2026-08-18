import SwiftUI

struct ManuscriptPaperView: View {
    let grid: ManuscriptGrid
    let prompt: PracticePrompt
    let showsGuides: Bool

    static let gridInset: CGFloat = 34
    static let headerHeight: CGFloat = 14
    static let headerSpacing: CGFloat = 8
    static let columnGapRatio: CGFloat = 0.18

    static func gridAspectRatio(for grid: ManuscriptGrid) -> CGFloat {
        let columns = CGFloat(grid.columns)
        let rows = CGFloat(grid.rows)
        let gaps = CGFloat(max(grid.columns - 1, 0)) * columnGapRatio
        return (columns + gaps) / rows
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [PaperPalette.paper, PaperPalette.paper.opacity(0.96)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            paperFibers

            VStack(spacing: 8) {
                HStack {
                    Text("原稿用紙")
                        .font(.system(size: 11, weight: .semibold, design: .serif))
                        .tracking(3)

                    Spacer()

                    Text("\(grid.characterCapacity) 字 ・ 縦書き")
                        .font(.system(size: 9, weight: .medium, design: .rounded))
                }
                .foregroundStyle(PaperPalette.grid.opacity(0.8))
                .frame(height: Self.headerHeight)

                ZStack {
                    Canvas { context, size in
                        drawGrid(context: &context, size: size)

                        if showsGuides, prompt.strokeOrderSVGs.isEmpty {
                            drawTextGuides(context: &context, size: size)
                        }
                    }

                    if showsGuides, !prompt.strokeOrderSVGs.isEmpty {
                        StrokeOrderGuideView(
                            grid: grid,
                            strokeOrderSVGs: prompt.strokeOrderSVGs
                        )
                        .allowsHitTesting(false)
                    }
                }
                .aspectRatio(Self.gridAspectRatio(for: grid), contentMode: .fit)

                Spacer(minLength: 0)
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .padding(Self.gridInset)
        }
        .clipShape(RoundedRectangle(cornerRadius: PaperRadius.sheet))
        .overlay {
            RoundedRectangle(cornerRadius: PaperRadius.sheet)
                .stroke(PaperPalette.sumi.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: PaperPalette.paperShadow, radius: 24, y: 12)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(grid.characterCapacity) character vertical manuscript practice paper")
    }

    private var paperFibers: some View {
        Canvas { context, size in
            var path = Path()
            let spacing: CGFloat = 11

            for index in 0...Int(size.height / spacing) {
                let y = CGFloat(index) * spacing + CGFloat(index % 3)
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y + 1.5))
            }

            context.stroke(path, with: .color(PaperPalette.sumi.opacity(0.018)), lineWidth: 0.5)
        }
        .allowsHitTesting(false)
    }

    private func drawGrid(context: inout GraphicsContext, size: CGSize) {
        let layout = gridLayout(in: size)
        var columnBorders = Path()

        for column in 0..<grid.columns {
            let x = layout.origin.x + CGFloat(column) * (layout.cellSize + layout.columnGap)
            let strip = CGRect(
                x: x,
                y: layout.origin.y,
                width: layout.cellSize,
                height: layout.cellSize * CGFloat(grid.rows)
            )
            columnBorders.addRect(strip)

            for row in 1..<grid.rows {
                let y = layout.origin.y + CGFloat(row) * layout.cellSize
                columnBorders.move(to: CGPoint(x: x, y: y))
                columnBorders.addLine(to: CGPoint(x: x + layout.cellSize, y: y))
            }
        }

        context.stroke(columnBorders, with: .color(PaperPalette.grid.opacity(0.8)), lineWidth: 0.72)

        var centerGuides = Path()
        for column in 0..<grid.columns {
            for row in 0..<grid.rows {
                let originX = layout.origin.x + CGFloat(column) * (layout.cellSize + layout.columnGap)
                let originY = layout.origin.y + CGFloat(row) * layout.cellSize
                let guideInset = layout.cellSize * 0.08

                centerGuides.move(
                    to: CGPoint(x: originX + layout.cellSize / 2, y: originY + guideInset)
                )
                centerGuides.addLine(
                    to: CGPoint(x: originX + layout.cellSize / 2, y: originY + layout.cellSize - guideInset)
                )
                centerGuides.move(
                    to: CGPoint(x: originX + guideInset, y: originY + layout.cellSize / 2)
                )
                centerGuides.addLine(
                    to: CGPoint(x: originX + layout.cellSize - guideInset, y: originY + layout.cellSize / 2)
                )
            }
        }

        context.stroke(
            centerGuides,
            with: .color(PaperPalette.grid.opacity(0.25)),
            lineWidth: 0.38
        )
    }

    private func drawTextGuides(context: inout GraphicsContext, size: CGSize) {
        let layout = gridLayout(in: size)
        let fontSize = layout.cellSize * 0.68
        let opacities = [0.3, 0.21, 0.13]
        let rightmostColumn = CGFloat(grid.columns - 1)

        for (row, opacity) in opacities.enumerated() {
            let text = Text(prompt.character)
                .font(.system(size: fontSize, weight: .regular, design: .serif))
                .foregroundStyle(PaperPalette.sumi.opacity(opacity))
            let point = CGPoint(
                x: layout.origin.x
                    + rightmostColumn * (layout.cellSize + layout.columnGap)
                    + layout.cellSize / 2,
                y: layout.origin.y + CGFloat(row) * layout.cellSize + layout.cellSize / 2
            )
            context.draw(text, at: point)
        }
    }

    private func gridLayout(in size: CGSize) -> GridLayout {
        let columns = CGFloat(grid.columns)
        let rows = CGFloat(grid.rows)
        let widthUnits = columns + CGFloat(max(grid.columns - 1, 0)) * Self.columnGapRatio
        let cellSize = min(size.width / widthUnits, size.height / rows)
        let columnGap = cellSize * Self.columnGapRatio
        let gridWidth = columns * cellSize + CGFloat(max(grid.columns - 1, 0)) * columnGap
        let gridHeight = rows * cellSize

        return GridLayout(
            cellSize: cellSize,
            columnGap: columnGap,
            origin: CGPoint(
                x: (size.width - gridWidth) / 2,
                y: (size.height - gridHeight) / 2
            )
        )
    }

    private struct GridLayout {
        let cellSize: CGFloat
        let columnGap: CGFloat
        let origin: CGPoint
    }
}

private struct StrokeOrderGuideView: View {
    let grid: ManuscriptGrid
    let strokeOrderSVGs: [Data]

    var body: some View {
        GeometryReader { geometry in
            let layout = gridLayout(in: geometry.size)
            let visibleStrokes = Array(strokeOrderSVGs.reversed().prefix(grid.characterCapacity))

            ZStack(alignment: .topLeading) {
                ForEach(visibleStrokes.indices, id: \.self) { index in
                    let position = cellPosition(for: index)
                    let origin = CGPoint(
                        x: layout.origin.x + CGFloat(position.column) * (layout.cellSize + layout.columnGap),
                        y: layout.origin.y + CGFloat(position.row) * layout.cellSize
                    )

                    SVGReferenceView(data: visibleStrokes[index])
                        .padding(layout.cellSize * 0.08)
                        .frame(width: layout.cellSize, height: layout.cellSize)
                        .opacity(0.34)
                        .position(
                            x: origin.x + layout.cellSize / 2,
                            y: origin.y + layout.cellSize / 2
                        )
                }
            }
        }
    }

    private func cellPosition(for index: Int) -> (column: Int, row: Int) {
        let columnOffset = index / grid.rows
        return (
            column: max(grid.columns - 1 - columnOffset, 0),
            row: index % grid.rows
        )
    }

    private func gridLayout(in size: CGSize) -> GridLayout {
        let columns = CGFloat(grid.columns)
        let rows = CGFloat(grid.rows)
        let widthUnits = columns + CGFloat(max(grid.columns - 1, 0)) * ManuscriptPaperView.columnGapRatio
        let cellSize = min(size.width / widthUnits, size.height / rows)
        let columnGap = cellSize * ManuscriptPaperView.columnGapRatio
        let gridWidth = columns * cellSize + CGFloat(max(grid.columns - 1, 0)) * columnGap
        let gridHeight = rows * cellSize

        return GridLayout(
            cellSize: cellSize,
            columnGap: columnGap,
            origin: CGPoint(
                x: (size.width - gridWidth) / 2,
                y: (size.height - gridHeight) / 2
            )
        )
    }

    private struct GridLayout {
        let cellSize: CGFloat
        let columnGap: CGFloat
        let origin: CGPoint
    }
}
