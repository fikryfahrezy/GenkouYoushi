import Foundation
import UIKit
import Vision

protocol KanjiRecognizing: Sendable {
    func recognize(imageData: Data, crop: CGRect) async throws -> [KanjiRecognitionCandidate]
}

struct KanjiRecognitionCandidate: Identifiable, Hashable, Sendable {
    let character: String
    let confidence: Float

    var id: String { character }
}

nonisolated enum KanjiRecognitionError: LocalizedError {
    case invalidImage
    case noKanjiFound
    case recognitionInProgress
    case lookupInProgress

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            "The selected image could not be read."
        case .noKanjiFound:
            "No kanji was found in that image. Try a tighter, clearer photo."
        case .recognitionInProgress:
            "Another photo is already being scanned."
        case .lookupInProgress:
            "A kanji reference is still loading. Try again in a moment."
        }
    }
}

actor KanjiRecognitionService: KanjiRecognizing {
    func recognize(imageData: Data, crop: CGRect) async throws -> [KanjiRecognitionCandidate] {
        guard
            let image = UIImage(data: imageData),
            let orientedImage = normalizedImage(from: image),
            let cgImage = croppedImage(from: orientedImage, normalizedCrop: crop)
        else {
            throw KanjiRecognitionError.invalidImage
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["ja-JP"]
        request.usesLanguageCorrection = false

        let handler = VNImageRequestHandler(cgImage: cgImage)
        try handler.perform([request])

        var confidenceByCharacter: [String: Float] = [:]
        for observation in request.results ?? [] {
            for recognizedText in observation.topCandidates(5) {
                for scalar in recognizedText.string.unicodeScalars where Self.isKanji(scalar) {
                    let character = String(scalar)
                    confidenceByCharacter[character] = max(
                        confidenceByCharacter[character] ?? 0,
                        recognizedText.confidence
                    )
                }
            }
        }

        let candidates = confidenceByCharacter
            .map { KanjiRecognitionCandidate(character: $0.key, confidence: $0.value) }
            .sorted {
                if $0.confidence == $1.confidence {
                    return $0.character < $1.character
                }
                return $0.confidence > $1.confidence
            }

        guard !candidates.isEmpty else {
            throw KanjiRecognitionError.noKanjiFound
        }
        return Array(candidates.prefix(5))
    }

    private func normalizedImage(from image: UIImage) -> CGImage? {
        if image.imageOrientation == .up {
            return image.cgImage
        }

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let rendered = UIGraphicsImageRenderer(size: image.size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
        return rendered.cgImage
    }

    private func croppedImage(from image: CGImage, normalizedCrop: CGRect) -> CGImage? {
        let unitBounds = CGRect(x: 0, y: 0, width: 1, height: 1)
        let crop = normalizedCrop.standardized.intersection(unitBounds)
        guard crop.width > 0, crop.height > 0 else { return nil }

        let imageBounds = CGRect(x: 0, y: 0, width: image.width, height: image.height)
        let pixelCrop = CGRect(
            x: crop.minX * CGFloat(image.width),
            y: crop.minY * CGFloat(image.height),
            width: crop.width * CGFloat(image.width),
            height: crop.height * CGFloat(image.height)
        )
        .integral
        .intersection(imageBounds)

        guard pixelCrop.width > 0, pixelCrop.height > 0 else { return nil }
        return image.cropping(to: pixelCrop)
    }

    private nonisolated static func isKanji(_ scalar: UnicodeScalar) -> Bool {
        switch scalar.value {
        case 0x3400...0x4DBF, 0x4E00...0x9FFF, 0xF900...0xFAFF:
            true
        default:
            false
        }
    }
}
