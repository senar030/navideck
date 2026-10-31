## Neu

- **Einheitliche Hero-Ansicht:** Hörbücher und Podcasts nutzen auf dem Smartphone dieselbe zentrierte Darstellung wie Alben und Künstler. Der Text steht wieder mittig, das Cover hat dieselbe Größe wie bei Musik-Alben.
- **Podcast-Hero wie beim Hörbuch:** Ist eine Folge bereits angefangen, zeigt der Hauptknopf „Weiterhören“ mit Prozentstand und restlicher Zeit; entlang der unteren Kante läuft der Fortschrittsbalken. Der runde Wiederholungs-Button startet die Folge von vorn.
- Ohne angefangene Folge heißt der Hauptknopf weiterhin „Neueste Folge“.

## Installation

### Windows

`Navideck-Setup-1.16.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.16.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.16.0-x86_64.AppImage --appimage-extract-and-run`.
