## Neu

- **Scharfe Ecken:** Unter **Einstellungen → Darstellung → Ecken** gibt es jetzt die Wahl zwischen **Rund** und **Scharf**. „Scharf“ stellt Flächen, Chips, Cover, Pills und runde Knöpfe komplett eckig dar – auch in der Deck-Ansicht.
- **Linux-Variante:** Navideck gibt es ab dieser Version auch als AppImage für Linux und Bazzite.

## Installation

### Windows

`Navideck-Setup-1.6.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.6.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.6.0-x86_64.AppImage --appimage-extract-and-run`.
