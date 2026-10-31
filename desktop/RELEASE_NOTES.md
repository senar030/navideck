## Behoben

- **Weiterhören auf dem iPhone:** Ein angefangenes Hörbuch spielte kurz an und blieb dann stumm, weil der Player schon loslegte, während der Sprung zur gemerkten Stelle noch lief. Die Wiedergabe wartet jetzt auf das echte Ende des Sprungs statt auf ein verfrühtes Puffersignal – auf langsamen Verbindungen gibt es dadurch kein Anspielen an der falschen Stelle mehr.

## Installation

### Windows

`Navideck-Setup-1.12.1.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.12.1-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.12.1-x86_64.AppImage --appimage-extract-and-run`.
