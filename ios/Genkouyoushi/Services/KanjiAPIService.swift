import Foundation

struct KanjiReference: Equatable, Sendable {
    let character: String
    let strokeOrderSVGs: [Data]
}

protocol KanjiServing: Sendable {
    func lookup(character: String, includesNumbers: Bool) async throws -> KanjiReference
}

enum KanjiServiceError: LocalizedError {
    case invalidCharacter
    case invalidResponse
    case notFound
    case server(statusCode: Int)
    case malformedStrokeData

    var errorDescription: String? {
        switch self {
        case .invalidCharacter:
            "Enter one Japanese character."
        case .invalidResponse:
            "The kanji service returned an invalid response."
        case .notFound:
            "That character was not found."
        case .server(let statusCode):
            "The kanji service failed with status \(statusCode)."
        case .malformedStrokeData:
            "The stroke-order data could not be decoded."
        }
    }
}

actor KanjiAPIService: KanjiServing {
    private let baseURL: URL
    private let session: URLSession

    init(
        baseURL: URL = URL(string: "https://kanji-api.fahrezy.work")!,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.session = session
    }

    func lookup(character: String, includesNumbers: Bool = false) async throws -> KanjiReference {
        let value = character.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.count == 1 else { throw KanjiServiceError.invalidCharacter }

        let endpoint = baseURL
            .appending(path: "kanji")
            .appending(path: value)
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "with_number", value: String(includesNumbers))]
        guard let url = components?.url else { throw KanjiServiceError.invalidCharacter }

        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw KanjiServiceError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200..<300:
            break
        case 404:
            throw KanjiServiceError.notFound
        default:
            throw KanjiServiceError.server(statusCode: httpResponse.statusCode)
        }

        let payload = try JSONDecoder().decode(Response.self, from: data)
        let strokes = payload.strokeOrders.compactMap { encoded in
            Data(base64Encoded: encoded)
        }
        guard !strokes.isEmpty, strokes.count == payload.strokeOrders.count else {
            throw KanjiServiceError.malformedStrokeData
        }

        return KanjiReference(character: payload.kanji, strokeOrderSVGs: strokes)
    }

    private struct Response: Decodable {
        let kanji: String
        let strokeOrders: [String]

        enum CodingKeys: String, CodingKey {
            case kanji
            case strokeOrders = "stroke_orders"
        }
    }
}
