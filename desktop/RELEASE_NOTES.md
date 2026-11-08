## Behoben

- **Sperrbildschirm auf dem iPhone:** Die Steuerung zeigt jetzt den richtigen Zustand (läuft oder pausiert), und Play/Pause, Vor/Zurück sowie Spulen funktionieren. Navideck nutzt auf iOS nur noch ein Audio-Element für die ganze Warteschlange. Das verhindert, dass nach dem Fortsetzen zwar die Zeit weiterläuft, aber kein Ton zu hören ist.
- **Titelinfos auf dem Sperrbildschirm:** Metadaten, Zeitleiste und Wiedergabeposition werden laufend aktualisiert und beim Leeren der Warteschlange zurückgesetzt.
- **Neue Version wird erkannt:** Nach einem Update zeigt Navideck einen Hinweis „Neue Version verfügbar“ mit „Neu laden“. So lässt sich eine installierte Web-App auch dann aktualisieren, wenn sie noch auf dem alten Stand hängt.
- **App-Cache wird erneuert:** Der Service-Worker-Cache wird beim nächsten Start frisch aufgebaut, damit die aktuelle Version geladen wird.

## Installation

### Windows

`Navideck-Setup-1.19.2.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.19.2-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.19.2-x86_64.AppImage --appimage-extract-and-run`.
