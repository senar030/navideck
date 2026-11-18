import Foundation

enum Format {
    /// `245` → `4:05`. Hours are only shown when a track really is that long.
    static func duration(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "--:--" }
        let total = Int(seconds.rounded())
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let rest = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, rest)
        }
        return String(format: "%d:%02d", minutes, rest)
    }

    /// `5000` → `1 Std. 23 Min.` for album and playlist headers.
    static func longDuration(_ seconds: Int?) -> String? {
        guard let seconds, seconds > 0 else { return nil }
        let minutes = seconds / 60
        if minutes >= 60 {
            return "\(minutes / 60) Std. \(minutes % 60) Min."
        }
        return "\(minutes) Min."
    }

    /// Turns whatever the user typed into a server URL. Missing schemes default
    /// to http, which is what a Navidrome on the LAN speaks.
    static func serverURL(_ text: String) -> URL? {
        var trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if !trimmed.contains("://") {
            // Local servers speak plain http, public ones almost always https.
            let host = trimmed.split(separator: "/").first.map(String.init) ?? trimmed
            trimmed = (isLocalHost(host) ? "http://" : "https://") + trimmed
        }
        while trimmed.hasSuffix("/") {
            trimmed.removeLast()
        }
        guard let url = URL(string: trimmed), let host = url.host, !host.isEmpty else {
            return nil
        }
        return url
    }

    /// LAN addresses and .local names are the ones that usually run plain http.
    private static func isLocalHost(_ host: String) -> Bool {
        let name = host.split(separator: ":").first.map(String.init)?.lowercased() ?? host.lowercased()
        if name == "localhost" || name.hasSuffix(".local") { return true }
        let parts = name.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 4 else { return false }
        if parts[0] == 10 || parts[0] == 127 { return true }
        if parts[0] == 192, parts[1] == 168 { return true }
        if parts[0] == 172, (16...31).contains(parts[1]) { return true }
        return false
    }

    /// `https://music.example.org` → `music.example.org`, used as a server label.
    static func host(_ url: URL) -> String {
        url.host ?? url.absoluteString
    }

    static func albumMeta(_ album: Album) -> String {
        var parts: [String] = []
        if let artist = album.artist, !artist.isEmpty { parts.append(artist) }
        if let year = album.year { parts.append(String(year)) }
        return parts.joined(separator: " · ")
    }
}
