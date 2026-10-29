## Behoben

- **Weiterhören bei Hörbüchern:** Ein Hörbuch startet jetzt an der gemerkten Stelle, ohne dass die Datei vorher noch einmal neu geladen wird. Bisher konnte der Player die bereits laufende Anfrage verwerfen und von vorn beginnen – hörbar als kurzes Anspielen und anschließendes Hängen.
- **Kein Sprung mitten in die Wiedergabe:** Die Position wird gesetzt, bevor der Ton beginnt. Vorher lief das Buch kurz an der falschen Stelle weiter, während der Sprung zur gespeicherten Stelle noch lud.
- **Mehrteilige Bücher:** Die Startdatei und die Position darin werden jetzt auch bei fehlenden oder ungenauen Dateigrenzen korrekt bestimmt. Eine gespeicherte Position genau am Ende wird als Neustart behandelt, statt am letzten Sekundenende hängen zu bleiben.
- **Fortschritt gehört zum richtigen Titel:** Der Hörfortschritt wird dem tatsächlich geladenen Track zugeordnet, nicht dem eventuell noch nicht aktualisierten Warteschlangeneintrag.

## Installation

### Windows

`Navideck-Setup-1.11.1.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.11.1-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.11.1-x86_64.AppImage --appimage-extract-and-run`.
