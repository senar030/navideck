## Neu

- **Luftigerer Hörbuch-Hero:** Auf dem Smartphone ist das Cover etwas kleiner, der Text steht linksbündig unter dem Cover und die Abstände sind größer. Die vielen Zeilen im Hero wirken dadurch nicht mehr so gedrängt.
- **Weiterhören mit Fortschritt:** Ist ein Hörbuch bereits angefangen, zeigt der Hauptknopf jetzt direkt unter „Weiterhören“ den Prozentstand und die restliche Hörzeit. Entlang der unteren Kante läuft ein Balken mit dem bereits gehörten Anteil.
- **Von vorn als Symbol:** Der Textknopf „Von vorn“ ist jetzt ein runder Button mit Wiederholungs-Symbol; der Tooltip bzw. die Sprachausgabe sagt weiterhin „Von vorn abspielen“.

## Installation

### Windows

`Navideck-Setup-1.15.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.15.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.15.0-x86_64.AppImage --appimage-extract-and-run`.
