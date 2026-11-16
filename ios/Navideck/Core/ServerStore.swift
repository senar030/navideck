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

struct ServerProfile: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var name: String
    var baseURL: String
    var username: String
    var auth: SubsonicAuth
    var addedAt: Date

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

    private(set) var profiles: [ServerProfile] = []
    private(set) var activeID: UUID?

    var active: ServerProfile? {
        profiles.first { $0.id == activeID }
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
        if let raw = defaults.string(forKey: Self.activeKey), let id = UUID(uuidString: raw) {
            activeID = profiles.contains(where: { $0.id == id }) ? id : profiles.first?.id
        } else {
            activeID = profiles.first?.id
        }
    }

    private func persist() {
        let defaults = UserDefaults.standard
        if let data = try? JSONEncoder().encode(profiles) {
            defaults.set(data, forKey: Self.profilesKey)
        }
        defaults.set(activeID?.uuidString, forKey: Self.activeKey)
    }

    /// Adds or updates the server for this host/account pair and returns it.
    func save(baseURL: URL, username: String, password: String, auth: SubsonicAuth) -> ServerProfile {
        let id = profiles.first {
            $0.baseURL == baseURL.absoluteString && $0.username == username
        }?.id ?? UUID()

        let profile = ServerProfile(
            id: id,
            name: Format.host(baseURL),
            baseURL: baseURL.absoluteString,
            username: username,
            auth: auth,
            addedAt: Date()
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
            activeID = profiles.first?.id
        }
        persist()
    }
}
