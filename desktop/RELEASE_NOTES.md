## Neu

- **Zufällige Widgets bleiben stabil:** „Zufällige Bücher“, „Zufällige Autoren“, „Zufällige Alben“ und „Zufällige Künstler“ behalten ihre Auswahl für die laufende Sitzung. Ein Ausflug in ein Buch oder Album und der Weg zurück zeigen dieselbe Reihe – erst der Neu-würfeln-Knopf am Widget-Kopf wählt eine andere Auswahl.
- **Scrollposition wird gemerkt:** Wer weit nach unten scrollt, etwas öffnet und dann zurückgeht, landet wieder an der Stelle, an der er geklickt hat – auf dem Smartphone genauso wie am Desktop. Neue Seiten starten weiterhin oben. Auch nachgeladene Listen werden beim Zurückgehen so weit geladen, bis die alte Position wieder erreicht ist.
- **Zurück-Knopf zentriert:** Der Zurück-Knopf sitzt jetzt vertikal mittig in der Kopfzeile und damit auf einer Linie mit dem Symbol daneben.

## Installation

### Windows

`Navideck-Setup-1.10.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.10.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.10.0-x86_64.AppImage --appimage-extract-and-run`.
