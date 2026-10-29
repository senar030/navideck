## Neu

- **Sortieren überall gleich:** Die Sortieroptionen stehen jetzt untereinander in einem kleinen Fenster. Die aktive Option trägt einen Pfeil **↑** oder **↓**; ein zweiter Klick auf sie dreht die Reihenfolge (z. B. neu → alt oder alt → neu). Das gilt für Alben, Bücher, Autoren, Sendungen, Episoden, Titellisten und die Warteschlange.
- **Autoren-Bücher:** Die Autorenseite zeigt jetzt die Bücher des Autors. Audiobookshelf liefert sie nur auf Anfrage mit (`include=items`); vorher blieb die Seite bei „Autor wird geladen …“ stehen.

## Installation

### Windows

`Navideck-Setup-1.8.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.8.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.8.0-x86_64.AppImage --appimage-extract-and-run`.
