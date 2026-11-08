## Behoben

- **Wiedergabe läuft weiter:** Am Ende eines Liedes bleibt die Wiedergabe nicht mehr stehen. Der Player wechselt zuverlässig zum nächsten Titel der Warteschlange.
- **Robuster Wechsel auf dem Smartphone:** Falls der vorbereitete nächste Titel auf dem zweiten Audio-Element nicht anläuft, wird er nach kurzer Zeit auf dem gerade benutzten Element neu gestartet.
- **Ende-Erkennung:** Ein zusätzlicher Wächter am Titelende springt auch dann weiter, wenn ein mobiler Browser das `ended`-Ereignis verschluckt.

## Installation

### Windows

`Navideck-Setup-1.19.1.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.19.1-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.19.1-x86_64.AppImage --appimage-extract-and-run`.
