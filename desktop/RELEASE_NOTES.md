## Behoben

- **Linux-AppImage im Steam Game Mode:** Die AppImage startet jetzt auch im Gaming Mode. Steam startet die AppImage direkt; dabei kam Electrons Sandbox in der Game-Mode-Umgebung nicht hoch und der Prozess beendete sich wieder. Die Linux-AppImage startet Electron deshalb jetzt über einen kleinen Starter immer mit `--no-sandbox`. Im Desktop-Modus ändert sich sonst nichts.

## Installation

### Windows

`Navideck-Setup-1.17.2.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.17.2-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.17.2-x86_64.AppImage --appimage-extract-and-run`.
