import Foundation

protocol PracticeStoring: Sendable {
    func loadAll() async throws -> [PracticeDocument]
    func save(_ document: PracticeDocument) async throws
    func delete(id: UUID) async throws
}

actor PracticeRepository: PracticeStoring {
    private let directory: URL
    private let encoder: PropertyListEncoder
    private let decoder: PropertyListDecoder

    init(directory: URL? = nil) {
        let applicationSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!
        self.directory = directory ?? applicationSupport
            .appending(path: "GenkouYoushi", directoryHint: .isDirectory)
            .appending(path: "Practice", directoryHint: .isDirectory)

        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary
        self.encoder = encoder
        self.decoder = PropertyListDecoder()
    }

    func loadAll() throws -> [PracticeDocument] {
        try ensureDirectory()
        let urls = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )
        return urls
            .filter { $0.pathExtension == "gypractice" }
            .compactMap { url in
                guard let data = try? Data(contentsOf: url) else { return nil }
                return try? decoder.decode(PracticeDocument.self, from: data)
            }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    func save(_ document: PracticeDocument) throws {
        try ensureDirectory()
        let data = try encoder.encode(document)
        try data.write(to: fileURL(for: document.id), options: .atomic)
    }

    func delete(id: UUID) throws {
        let url = fileURL(for: id)
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        try FileManager.default.removeItem(at: url)
    }

    private func ensureDirectory() throws {
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
    }

    private func fileURL(for id: UUID) -> URL {
        directory.appending(path: id.uuidString).appendingPathExtension("gypractice")
    }
}

