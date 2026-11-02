## Neu

- **Radioseite im Deck-Modus:** Statt vieler schmaler Kacheln stehen die Sender jetzt untereinander in einer breiten Liste. Cover und Schrift sind deutlich größer, das Play-Symbol ist auf dem Touchscreen immer sichtbar. Das gilt für gefolgte Sender und die Suchergebnisse.

## Installation

### Windows

`Navideck-Setup-1.18.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.18.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.18.0-x86_64.AppImage --appimage-extract-and-run`.
