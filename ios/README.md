# Navideck für iOS

Native SwiftUI-App für Navidrome und andere Subsonic-Server. Sie teilt sich
Bibliothek, Zugangsdaten und Hörgewohnheiten mit der Web-App und der
Desktop-Version – nur die Oberfläche ist hier echtes iOS statt Web.

## Funktionsumfang (1.0)

- Anmeldung an Navidrome, Nextcloud Music (Passwort-Auth), Airsonic, Gonic …
- Startseite mit zuletzt gespielt, neu im Regal, meistgespielt und Zufall
- Alben mit Sortierung und Nachladen, Album-Detail mit Titelliste
- Interpreten mit Biografie, Alben und beliebten Titeln
- Playlists, Genres, Favoriten
- Suche über Titel, Alben und Interpreten
- Eigener Player: Warteschlange, Shuffle, Repeat, Spulen
- Sperrbildschirm-Steuerung und Now-Playing-Infos, Hintergrundwiedergabe
- Mehrere Server speichern und wechseln (Passwörter im Keychain)

Noch nicht enthalten (zweite Ausbaustufe): Podcasts, Hörbücher
(Audiobookshelf) und Radio.

## Bauen

Voraussetzungen: macOS mit Xcode 16 oder neuer, iOS 17 als Ziel.

```bash
cd ios
open Navideck.xcodeproj
```

In Xcode das Target **Navideck** wählen, unter *Signing & Capabilities* dein
Team eintragen und die Bundle-ID (`de.navideck.app`) auf etwas Eigenes ändern,
falls sie schon vergeben ist. Dann auf ein angeschlossenes iPhone oder den
Simulator starten.

Nur nach Änderungen an `project.yml` muss das Projekt neu erzeugt werden:

```bash
brew install xcodegen
cd ios && xcodegen generate
```

Kommandozeilen-Build für den Simulator:

```bash
cd ios
xcodebuild -project Navideck.xcodeproj -scheme Navideck \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

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
  Navideck.xcodeproj       generiert, direkt in Xcode zu öffnen
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
