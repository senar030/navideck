# Navideck für iOS

Native SwiftUI-App für Navidrome und andere Subsonic-Server. Sie teilt sich
Bibliothek, Zugangsdaten und Hörgewohnheiten mit der Web-App und der
Desktop-Version – nur die Oberfläche ist hier echtes iOS statt Web.

## Funktionsumfang (1.1.4)

- Anmeldung an Navidrome, Nextcloud Music (Passwort-Auth), Airsonic, Gonic …
- Vier Tabs (Start, Musik, Podcast, Optionen) plus feste Buttons „Start“ und
  „Suche“ unten: „Start“ fährt die runde Glas-Navigation mit allen Zielen aus,
  „Suche“ öffnet die Live-Suche
- Live-Suche als Overlay: Treffer erscheinen schon beim Tippen (Titel, Alben,
  Interpreten), gruppiert mit Covern, „Alle/Weniger“, letzte Suchanfragen und
  direkter Sprung in Album oder Interpret
- „Musik“ bündelt Kürzlich hinzugefügt, Kürzlich gespielt, Häufig gespielt,
  Alben, Interpreten, Playlists, Genres, Favoriten, Radio und Downloads;
  Umschalter zwischen Kacheln und Liste, bearbeitbare Reihenfolge (Ziehen) und
  ein-/ausblendbare Bereiche inklusive Zurücksetzen
- Die drei Alben-Sammlungen (Kürzlich hinzugefügt/gespielt, Häufig gespielt)
  zeigen ihre Alben als Kacheln oder Liste
- Startseite mit Sofortmix, zuletzt gespielt, neu im Regal, meistgespielt und Zufall
- Sofortmix: zufällige Titel, Anzahl und ausgeschlossene Genres in den Einstellungen
- Alben mit Sortierung und Nachladen, Album-Detail mit Titelliste
- Interpreten mit Biografie, Alben und beliebten Titeln
- Playlists, Genres, Favoriten; Playlists und Titellisten auf- und absteigend sortierbar
- Podcasts mit Sendern, neuesten Folgen und Folgenlisten; Folgen lassen sich
  fortsetzen („Weiterhören“) und einzeln herunterladen; lange Sender werden
  seitenweise geladen und zwischen Tab-Wechseln zwischengespeichert
- Internet-Radio aus der Serverliste
- Downloads: Alben, Playlists, Interpreten und einzelne Titel offline verfügbar,
  eigene Offline-Ansicht mit Speicherverwaltung
- Eigener Player: Warteschlange, Shuffle, Repeat, Spulen
- Sperrbildschirm-Steuerung und Now-Playing-Infos, Hintergrundwiedergabe
- Menü im Now Playing: „Zum Album“, „Zum Interpreten“, Warteschlange, Download
- Streaming-Qualität (Original bis 128 kbit/s) in den Einstellungen
- Cover-Cache (Speicher + Platte, eine Auflösung pro Cover) mit Vorladen und
  sofortiger Anzeige aus dem Speicher
- Durchsichtige Glas-Optik (Liquid Glass) für Navigationskapsel, Mini-Player-Pill
  und die beiden runden Symbol-Buttons „Start“ und „Suche“ (ohne Text); Wischen
  nach links oder rechts auf der Pill leert die Warteschlange; eckige Cover,
  quadratischer Play-Button im Now Playing
- Mehrere Server speichern und wechseln (Passwörter im Keychain)

Noch nicht enthalten: Hörbücher (Audiobookshelf). Offline-Downloads gibt es
bisher nur in der iOS-App – Web und Desktop streamen weiterhin ausschließlich
vom Server (siehe `AGENTS.md` zur plattformübergreifenden Parität).

## Bauen

Voraussetzungen: macOS mit Xcode 16 oder neuer, iOS 17 als Ziel.

Das Xcode-Projekt wird aus `project.yml` erzeugt und liegt bewusst nicht im
Repository: Der Projektordner liegt in einem Nextcloud-Ordner, und Xcode
schreibt beim Öffnen ständig hinein – dadurch entstanden Duplikate
(`Navideck 2.xcodeproj` …) und irgendwann fehlte `project.pbxproj`.

Deshalb arbeitet Xcode auf einer lokalen Kopie außerhalb der Cloud:

```bash
node scripts/ios-workdir.mjs --open
```

Das synchronisiert `ios/` nach `~/Developer/navideck-ios`, erzeugt dort das
Xcode-Projekt und öffnet es. Dein Signing-Team wird aus `.ios-team` (lokal,
nicht im Repo) übernommen, alternativ aus `NAVIDECK_TEAM`.

In Xcode das Target **Navideck** wählen, unter *Signing & Capabilities* dein
Team eintragen (falls noch nicht geschehen) und die Bundle-ID
(`de.navideck.app`) auf etwas Eigenes ändern, falls sie schon vergeben ist.
Dann das angeschlossene iPhone oder den Simulator starten.

## Aufs iPhone bringen

1. iPhone per Kabel verbinden und entsperren, „Vertrauen“ bestätigen.
2. **Einstellungen → Datenschutz & Sicherheit → Entwicklermodus** einschalten
   (Neustart + Code).
3. Einmalig signieren: in Xcode *Signing & Capabilities* → *Team*.
4. Installieren und starten:

```bash
cd ~/Developer/navideck-ios
xcodebuild -project Navideck.xcodeproj -scheme Navideck \
  -destination 'id=<UDID>' -allowProvisioningUpdates build
xcrun devicectl device install app --device <UDID> \
  DD-device/Build/Products/Debug-iphoneos/Navideck.app
xcrun devicectl device process launch --device <UDID> de.navideck.app
```

Beim ersten Start blockiert iOS die App, bis das Zertifikat unter
*Einstellungen → Allgemein → VPN & Geräteverwaltung* vertraut wurde.
Kostenlose Apple-IDs signieren 7 Tage; danach Build erneut installieren.

## Ohne Xcode aufs iPhone (CI)

Der Workflow **iOS build** baut bei jedem Push auf `ios/**` eine unsignierte
IPA und legt sie als Artefakt `Navideck-unsigned-ipa` ab.

1. GitHub → *Actions* → **iOS build** → letzten Lauf öffnen
2. Artefakt herunterladen und entpacken
3. IPA mit [Sideloadly](https://sideloadly.io) oder
   [AltStore](https://altstore.io) und der eigenen Apple-ID signieren und
   installieren

Ein kostenloser Apple-Account signiert für **7 Tage**; danach muss die App neu
signiert werden. Mit einem bezahlten Developer-Programm entfällt das.

## Aufbau

```
ios/
  project.yml              XcodeGen-Projektdefinition
  Navideck.xcodeproj       generiert (nicht im Repo), direkt in Xcode zu öffnen
  Navideck/
    App/                   Einstiegspunkt und AppModel
    Core/                  Modelle, Subsonic-Client, Serververwaltung, Keychain
    Player/                AVPlayer, Warteschlange, Now Playing, Remote-Steuerung
    UI/                    SwiftUI-Ansichten
    Resources/             Assets und App-Icon
  scripts/make-icon.swift  erzeugt das App-Icon aus den Favicon-Formen
```

## Wichtig für Änderungen

Die App ist eine von vier Auslieferungen (Web, Windows/Linux, iOS). Neue
Funktionen und Fehlerbehebungen werden in allen betroffenen Versionen
umgesetzt – siehe `AGENTS.md` im Projektwurzelverzeichnis.
