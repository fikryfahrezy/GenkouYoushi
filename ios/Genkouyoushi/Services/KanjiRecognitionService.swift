import Foundation
import UIKit
import Vision

protocol KanjiRecognizing: Sendable {
    func recognize(imageData: Data) async throws -> String
}

nonisolated enum KanjiRecognitionError: LocalizedError {
    case invalidImage
    case noKanjiFound

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            "The selected image could not be read."
        case .noKanjiFound:
            "No kanji was found in that image. Try a tighter, clearer photo."
        }
    }
}

actor KanjiRecognitionService: KanjiRecognizing {
    func recognize(imageData: Data) async throws -> String {
        guard let image = UIImage(data: imageData), let cgImage = image.cgImage else {
            throw KanjiRecognitionError.invalidImage
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["ja-JP"]
        request.usesLanguageCorrection = false

        let handler = VNImageRequestHandler(cgImage: cgImage)
        try handler.perform([request])

        let candidates = request.results?.compactMap {
            $0.topCandidates(1).first?.string
        } ?? []

        for text in candidates {
            if let scalar = text.unicodeScalars.first(where: Self.isKanji) {
                return String(scalar)
            }
        }
        throw KanjiRecognitionError.noKanjiFound
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
