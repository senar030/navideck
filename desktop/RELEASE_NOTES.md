## Neu

- **Eine Suche für alles:** Die Suche durchsucht jetzt alle verbundenen Quellen. Neben Künstlern, Alben und Titeln erscheinen auch Hörbücher, Autoren, Podcast-Sendungen und passende Podcast-Folgen. Die Treffer sind nach Bereichen gruppiert.
- **Auch ohne Musikserver:** Die Suche ist schon sichtbar, wenn nur Hörbücher oder Podcasts verbunden sind. Das Suchfeld heißt jetzt „Alben, Hörbücher, Podcasts“.
- **Podcast-Folgen:** Bei Audiobookshelf werden auch Episodentitel durchsucht; die Treffer lassen sich direkt abspielen oder im Podcast öffnen.
- **Kein seitliches Wackeln:** Das Such-Overlay lässt sich auf dem Smartphone nicht mehr horizontal verschieben. Es scrollt nur noch vertikal.

## Installation

### Windows

`Navideck-Setup-1.13.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.13.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.13.0-x86_64.AppImage --appimage-extract-and-run`.
