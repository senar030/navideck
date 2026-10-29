## Neu

- **Autorinnen und Autoren mit großem Hero:** Die Autorenseite hat jetzt denselben Auftritt wie die Künstlerseiten – Autorenbild als Hintergrund und Cover, Name, Anzahl der Bücher, Gesamtdauer und ein direkter Hörknopf. Der Knopf startet das zuletzt gehörte Buch an der gemerkten Stelle; ohne Fortschritt beginnt er beim ersten Buch.
- **Hörbücher starten schneller:** Die Detailseite und der Abspielknopf teilen sich jetzt die schon geladenen Buchdaten, statt das große Buch ein zweites Mal vom Server zu holen. Ein Buch, das bereits geladen ist, spielt sofort an. Die Daten werden 30 Sekunden gehalten und bei Metadaten-Änderungen, Downloads oder Löschungen verworfen.
- **Große Bücher bleiben flüssig:** Bücher mit sehr vielen Kapiteln zeigen zunächst 80 Kapitel; der Rest lässt sich mit einem Klick nachladen („Weitere … Kapitel anzeigen“).
- **Fortschritt korrekt:** Ein bereits beendetes Buch startet nicht mehr am Ende, sondern von vorn. „Weiterhören“ erscheint nur noch bei echtem, nicht abgeschlossenem Fortschritt.

## Installation

### Windows

`Navideck-Setup-1.9.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.9.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.9.0-x86_64.AppImage --appimage-extract-and-run`.
