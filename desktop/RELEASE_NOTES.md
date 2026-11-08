## Neu

- **Podcast-Folgen als Warteschlange:** Wird eine Folge gestartet, landen die übrigen Folgen aus derselben Ansicht mit in der Warteschlange – in genau der Reihenfolge, in der sie dort stehen.
  - **Neueste Episoden:** alle Folgen aus dem Widget, neueste zuerst.
  - **Podcast-Seite:** alle Folgen der Sendung, neueste zuerst.
  - **Episoden-Liste:** alle Folgen in der aktuell gewählten Sortierung.
  - **Suche, Weiterhören und Folgen-Detailseite:** jeweils die dort sichtbare Liste.
- **Fortschritt pro Folge:** Jede Folge in der Warteschlange startet dort, wo zuletzt gehört wurde. Nur die direkt angetippte Folge lässt sich über „Von vorn“ bei null beginnen.

## Behoben

- **Wiedergabe stoppt nicht mehr auf dem Sperrbildschirm:** iOS schließt die Audio-Session, sobald ein Titel im Hintergrund regulär zu Ende läuft — der nächste Titel bleibt dann stumm, bis die App wieder im Vordergrund ist. Navideck umgeht das jetzt, indem die Tonspur am Titelende nahtlos weiterläuft und der Rücksprung an den Anfang als Titelwechsel erkannt wird. Damit spielt auch eine lange Playlist bei gesperrtem iPhone weiter.
- **Sperrbildschirm-Steuerung bleibt zuverlässig:** Die Media-Session-Aktionen werden erneut registriert, sobald die Wiedergabe läuft. iOS ignoriert sonst Handler, die vor dem ersten Ton gesetzt wurden, und zeigt nur die Standard-Spulknöpfe.
- **Sperrbildschirm auf dem iPhone:** Die Steuerung zeigt den richtigen Zustand (läuft oder pausiert), und Play/Pause, Vor/Zurück sowie Spulen funktionieren. Navideck nutzt auf iOS ein einziges Audio-Element für die ganze Warteschlange; das verhindert, dass nach dem Fortsetzen zwar die Zeit weiterläuft, aber kein Ton zu hören ist.
- **Titelinfos auf dem Sperrbildschirm:** Metadaten, Zeitleiste und Wiedergabeposition werden laufend aktualisiert und beim Leeren der Warteschlange zurückgesetzt.
- **Neue Version wird erkannt:** Nach einem Update zeigt Navideck einen Hinweis „Neue Version verfügbar“ mit „Neu laden“. So lässt sich eine installierte Web-App auch dann aktualisieren, wenn sie noch auf dem alten Stand hängt.
- **App-Cache wird erneuert:** Der Service-Worker-Cache wird beim nächsten Start frisch aufgebaut, damit die aktuelle Version geladen wird.

## Installation

### Windows

`Navideck-Setup-1.20.0.exe` starten und über die bisherige Version installieren. Server und Sitzung bleiben erhalten. Der Installer ist nicht signiert; Windows SmartScreen fragt einmal nach: **Weitere Informationen → Trotzdem ausführen**.

### Linux / Bazzite

1. `Navideck-1.20.0-x86_64.AppImage` herunterladen.
2. Datei als ausführbar markieren (Rechtsklick → Eigenschaften, oder `chmod +x Navideck-*.AppImage`).
3. Per Doppelklick starten. Unter Bazzite lässt sie sich optional über **Startmenü → Rechtsklick → Zum Startmenü hinzufügen** anheften.

Die AppImage bringt Electron mit und braucht keine Systeminstallation. Falls Bazzite die Ausführung blockiert, hilft `./Navideck-1.20.0-x86_64.AppImage --appimage-extract-and-run`.
