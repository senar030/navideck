import Foundation
import Observation
import Security

/// Small wrapper around the keychain. Passwords never touch UserDefaults.
enum Keychain {
    private static let service = "de.navideck.credentials"

    static func set(_ value: String, account: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func value(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum ServerKind: String, Codable, Hashable, Sendable {
    case subsonic
    case audiobookshelf
}

/// What the user picked when adding the connection. Determines the label and
/// which login method is used.
enum ServerFlavor: String, Codable, Hashable, Sendable, CaseIterable {
    case navidrome
    case subsonic
    case subsonicLegacy
    case audiobookshelf

    var label: String {
        switch self {
        case .navidrome: return "Navidrome"
        case .subsonic: return "Subsonic / Airsonic"
        case .subsonicLegacy: return "Subsonic (Legacy-Passwort)"
        case .audiobookshelf: return "Audiobookshelf"
        }
    }

    var detail: String {
        switch self {
        case .navidrome: return "Empfohlen. Meldung mit Benutzer und Passwort (Token)."
        case .subsonic: return "Token-Anmeldung über Benutzer und Passwort."
        case .subsonicLegacy: return "Für alte Server ohne Token: Passwort wird direkt gesendet."
        case .audiobookshelf: return "Hörbücher und Podcasts. Benötigt einen API-Token."
        }
    }

    var kind: ServerKind {
        self == .audiobookshelf ? .audiobookshelf : .subsonic
    }

    var auth: SubsonicAuth {
        self == .subsonicLegacy ? .password : .token
    }
}

/// A library (music folder on Subsonic, library on Audiobookshelf) that can be
/// assigned to one of Navideck's categories.
struct MediaLibrary: Codable, Identifiable, Hashable, Sendable {
    var serverID: UUID
    /// Folder id or Audiobookshelf library id. `__server__` marks server-wide
    /// content such as Subsonic podcasts.
    var id: String
    var name: String
    /// "music", "podcast" or "book".
    var mediaType: String

    var key: String { "\(serverID.uuidString)|\(id)" }
}

struct ServerProfile: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var name: String
    var baseURL: String
    var username: String
    var auth: SubsonicAuth
    var addedAt: Date
    /// Older entries have no kind and are Subsonic servers.
    var kind: ServerKind
    /// Server type as picked by the user; older entries derive it from `kind`.
    var flavor: ServerFlavor

    enum CodingKeys: String, CodingKey {
        case id, name, baseURL, username, auth, addedAt, kind, flavor
    }

    init(
        id: UUID,
        name: String,
        baseURL: String,
        username: String,
        auth: SubsonicAuth,
        addedAt: Date,
        kind: ServerKind = .subsonic,
        flavor: ServerFlavor = .subsonic
    ) {
        self.id = id
        self.name = name
        self.baseURL = baseURL
        self.username = username
        self.auth = auth
        self.addedAt = addedAt
        self.kind = kind
        self.flavor = flavor
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        baseURL = try c.decode(String.self, forKey: .baseURL)
        username = try c.decode(String.self, forKey: .username)
        auth = try c.decode(SubsonicAuth.self, forKey: .auth)
        addedAt = try c.decode(Date.self, forKey: .addedAt)
        kind = (try? c.decodeIfPresent(ServerKind.self, forKey: .kind)) ?? .subsonic
        flavor = (try? c.decodeIfPresent(ServerFlavor.self, forKey: .flavor))
            ?? (kind == .audiobookshelf ? .audiobookshelf : .subsonic)
    }

    var url: URL? { URL(string: baseURL) }

    var displayName: String {
        name.isEmpty ? (url.map(Format.host) ?? baseURL) : name
    }
}

/// The servers this device knows. Passwords live in the keychain, keyed by the
/// profile's id; everything else is plain JSON in UserDefaults.
@MainActor
@Observable
final class ServerStore {
    private static let profilesKey = "navideck.servers.v1"
    private static let activeKey = "navideck.servers.active.v1"
    private static let absActiveKey = "navideck.servers.abs.v1"

    private(set) var profiles: [ServerProfile] = []
    private(set) var activeID: UUID?
    private(set) var absID: UUID?

    var active: ServerProfile? {
        profiles.first { $0.id == activeID && $0.kind == .subsonic }
    }

    var activeABS: ServerProfile? {
        profiles.first { $0.id == absID && $0.kind == .audiobookshelf }
    }

    var audiobookServers: [ServerProfile] {
        profiles.filter { $0.kind == .audiobookshelf }
    }

    init() {
        load()
    }

    private func load() {
        let defaults = UserDefaults.standard
        if let data = defaults.data(forKey: Self.profilesKey),
           let decoded = try? JSONDecoder().decode([ServerProfile].self, from: data) {
            profiles = decoded
        }
        let subsonic = profiles.filter { $0.kind == .subsonic }
        if let raw = defaults.string(forKey: Self.activeKey), let id = UUID(uuidString: raw),
           subsonic.contains(where: { $0.id == id }) {
            activeID = id
        } else {
            activeID = subsonic.first?.id
        }
        if let raw = defaults.string(forKey: Self.absActiveKey), let id = UUID(uuidString: raw),
           profiles.contains(where: { $0.id == id && $0.kind == .audiobookshelf }) {
            absID = id
        } else {
            absID = profiles.first(where: { $0.kind == .audiobookshelf })?.id
        }
    }

    private func persist() {
        let defaults = UserDefaults.standard
        if let data = try? JSONEncoder().encode(profiles) {
            defaults.set(data, forKey: Self.profilesKey)
        }
        defaults.set(activeID?.uuidString, forKey: Self.activeKey)
        defaults.set(absID?.uuidString, forKey: Self.absActiveKey)
    }

    /// Adds or updates the server for this host/account pair and returns it.
    func save(
        baseURL: URL,
        username: String,
        password: String,
        auth: SubsonicAuth,
        name: String? = nil,
        flavor: ServerFlavor = .subsonic
    ) -> ServerProfile {
        let id = profiles.first {
            $0.kind == .subsonic && $0.baseURL == baseURL.absoluteString && $0.username == username
        }?.id ?? UUID()

        let cleaned = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let profile = ServerProfile(
            id: id,
            name: cleaned.isEmpty ? Format.host(baseURL) : cleaned,
            baseURL: baseURL.absoluteString,
            username: username,
            auth: auth,
            addedAt: Date(),
            kind: .subsonic,
            flavor: flavor
        )

        if let index = profiles.firstIndex(where: { $0.id == id }) {
            profiles[index] = profile
        } else {
            profiles.append(profile)
        }
        activeID = id
        Keychain.set(password, account: id.uuidString)
        persist()
        return profile
    }

    func password(for profile: ServerProfile) -> String? {
        Keychain.value(account: profile.id.uuidString)
    }

    /// Adds or updates an Audiobookshelf server. The API token is stored in the
    /// keychain, like a password.
    func saveAudiobookshelf(baseURL: URL, token: String, name: String? = nil) -> ServerProfile {
        let id = profiles.first {
            $0.kind == .audiobookshelf && $0.baseURL == baseURL.absoluteString
        }?.id ?? UUID()

        let cleaned = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let profile = ServerProfile(
            id: id,
            name: cleaned.isEmpty ? Format.host(baseURL) : cleaned,
            baseURL: baseURL.absoluteString,
            username: "audiobookshelf",
            auth: .token,
            addedAt: Date(),
            kind: .audiobookshelf,
            flavor: .audiobookshelf
        )

        if let index = profiles.firstIndex(where: { $0.id == id }) {
            profiles[index] = profile
        } else {
            profiles.append(profile)
        }
        absID = id
        Keychain.set(token, account: id.uuidString)
        persist()
        return profile
    }

    func makeAudiobookshelfClient(for profile: ServerProfile) -> AudiobookshelfClient? {
        guard let url = profile.url, let token = password(for: profile) else { return nil }
        return AudiobookshelfClient(baseURL: url, token: token)
    }

    /// Renames a server; an empty name falls back to the host.
    func rename(_ profile: ServerProfile, to newName: String) {
        guard let index = profiles.firstIndex(where: { $0.id == profile.id }) else { return }
        var updated = profiles[index]
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.name = trimmed.isEmpty ? (updated.url.map(Format.host) ?? updated.baseURL) : trimmed
        profiles[index] = updated
        persist()
    }

    func setActiveABS(_ profile: ServerProfile) {
        absID = profile.id
        persist()
    }

    func deactivateABS() {
        absID = nil
        persist()
    }

    func makeClient(for profile: ServerProfile) -> SubsonicClient? {
        guard let url = profile.url, let password = password(for: profile) else { return nil }
        return SubsonicClient(
            baseURL: url,
            username: profile.username,
            password: password,
            auth: profile.auth
        )
    }

    func setActive(_ profile: ServerProfile) {
        activeID = profile.id
        persist()
    }

    func deactivate() {
        activeID = nil
        persist()
    }

    func remove(_ profile: ServerProfile) {
        profiles.removeAll { $0.id == profile.id }
        Keychain.delete(account: profile.id.uuidString)
        if activeID == profile.id {
            activeID = profiles.first(where: { $0.kind == .subsonic })?.id
        }
        if absID == profile.id {
            absID = profiles.first(where: { $0.kind == .audiobookshelf })?.id
        }
        persist()
    }
}
