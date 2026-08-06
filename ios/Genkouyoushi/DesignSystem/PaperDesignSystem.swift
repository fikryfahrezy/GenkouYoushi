import SwiftUI

enum PaperPalette {
    static let canvas = Color(red: 0.89, green: 0.87, blue: 0.81)
    static let canvasDeep = Color(red: 0.82, green: 0.79, blue: 0.72)
    static let paper = Color(red: 0.985, green: 0.969, blue: 0.91)
    static let paperShadow = Color(red: 0.25, green: 0.22, blue: 0.16).opacity(0.16)
    static let sumi = Color(red: 0.12, green: 0.11, blue: 0.09)
    static let mutedSumi = Color(red: 0.34, green: 0.32, blue: 0.27)
    static let faintSumi = Color(red: 0.52, green: 0.49, blue: 0.42)
    static let grid = Color(red: 0.42, green: 0.53, blue: 0.43)
    static let gridFaint = Color(red: 0.42, green: 0.53, blue: 0.43).opacity(0.32)
    static let vermilion = Color(red: 0.73, green: 0.20, blue: 0.14)
    static let vermilionSoft = Color(red: 0.73, green: 0.20, blue: 0.14).opacity(0.12)
    static let indigo = Color(red: 0.18, green: 0.27, blue: 0.31)
}

enum PaperSpacing {
    static let xSmall: CGFloat = 4
    static let small: CGFloat = 8
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
    static let xLarge: CGFloat = 32
}

enum PaperRadius {
    static let control: CGFloat = 3
    static let panel: CGFloat = 4
    static let sheet: CGFloat = 1
}

struct PaperPanel<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(PaperSpacing.medium)
            .background(PaperPalette.paper.opacity(0.72), in: RoundedRectangle(cornerRadius: PaperRadius.panel))
            .overlay {
                RoundedRectangle(cornerRadius: PaperRadius.panel)
                    .stroke(PaperPalette.sumi.opacity(0.08), lineWidth: 1)
            }
    }
}

struct PaperIconButton: View {
    let title: String
    let systemImage: String
    var isSelected = false
    var role: ButtonRole?
    let action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            VStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 28, height: 24)

                Text(title)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? PaperPalette.paper : PaperPalette.mutedSumi)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                isSelected ? PaperPalette.indigo : Color.clear,
                in: RoundedRectangle(cornerRadius: PaperRadius.control)
            )
            .contentShape(RoundedRectangle(cornerRadius: PaperRadius.control))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

struct PaperToolButton: View {
    let title: String
    let systemImage: String
    var isSelected = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .semibold))
                Text(title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
            }
            .foregroundStyle(isSelected ? PaperPalette.paper : PaperPalette.sumi)
            .padding(.horizontal, 14)
            .frame(height: 40)
            .background(
                isSelected ? PaperPalette.indigo : PaperPalette.paper.opacity(0.92),
                in: RoundedRectangle(cornerRadius: PaperRadius.control)
            )
            .overlay {
                if !isSelected {
                    RoundedRectangle(cornerRadius: PaperRadius.control)
                        .stroke(PaperPalette.sumi.opacity(0.1), lineWidth: 1)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
