# Teil 2: Menüsystem — Skizze und Module

Stil bleibt: dunkles Panel, Bernstein-Überschriften, grüne Monospace-Schrift, CRT-Anmutung.
Alles skaliert über eine Einheit `--u` = min(100vw/1280, 100vh/720) px: 1280×720 → 1 px,
2560×1440 → 2 px. Abstände und Schriftgrößen sind Vielfache davon (CSS-Variablen).

## Bildschirme

```
TITEL                                   (3D-Szene: Walker im Hangar oder auf Schauplatz,
┌──────────────────────────────────────┐  langsame Kamerafahrt, zufällige Tageszeit;
│                                      │  Scanlines + Vignette über allem)
│          S T E E L   W A R D E N     │  CRT-Einschalten beim Erscheinen
│   WIDERSTANDSKOMMANDO · WALKER-…     │
│                                      │
│        — Taste drücken —  (blinkt)   │
│                         v0.4 · Datum │
└──────────────────────────────────────┘

HAUPTMENÜ
┌───────────────┬──────────────────────┐
│ STEEL WARDEN  │                      │
│ ▸ Kampagne  ░ │      3D-Szene        │
│ ▸ Übung       │                      │
│ ▸ Optionen    │                      │
│ ▸ Erprobung*  │                      │
│ ▸ Mitwirkende │                      │
│ ───────────── │                      │
│ Beschreibung  │                      │
│ des Eintrags  │                      │
└───────────────┴──────────────────────┘   * nur im Debug-Modus

EINSATZWAHL (Übung)
┌────────────────────────────────────────────────────────────┐
│ ÜBUNGSEINSATZ   [Schauplätze] [Gefechte] [Systemtests]  Q/E │
├──────────────────────┬─────────────────────────────────────┤
│ Duell              ▲ │ DUELL                               │
│ Hinterhalt           │ Beschreibung …                      │
│ Stellung             │ Schauplatz  Industriezone Brenn-Süd │
│ Welle                │ Tageszeit   Tag     Wetter  klar    │
│ Alarmstart           │ Gegner      1× SICHEL (Jäger)       │
│ Erster Einsatz     ▼ │ Start       sicher · Absetzpunkt    │
│ (scrollt im Bereich) │ ┌──────────────┐                    │
│                      │ │ Übersichts-  │ Start ◆ Nav ○      │
│                      │ │ karte        │ Gegner ▲ Gebiet ┅  │
│                      │ └──────────────┘                    │
├──────────────────────┴─────────────────────────────────────┤
│ [Zurück]                                   [Weiter ▸]      │
└────────────────────────────────────────────────────────────┘

EINSATZVORBEREITUNG
┌──────────────────────┬─────────────────────────────────────┐
│ WALKER  ◀ BASTION ▶  │                                     │
│ Tonnage   ████░░ 50 t│     3D: Walker auf Drehplattform    │
│ Tempo     ███░░░ …   │                                     │
│ Panzerung ████░░ …   │                                     │
│ Reaktor   ███░░░ …   │                                     │
│ Hardpoints ███░░ 5   │                                     │
│ BEWAFFNUNG (Werk)    │                                     │
│ LA  LUX-40 …         │                                     │
│ ÜBUNG                │                                     │
│ Verwundbar   ◀ ja ▶  │                                     │
│ Munition     ◀ begr▶ │                                     │
│ Schwierigk.  ◀ Norm▶ │                                     │
│ Tageszeit    ◀ Miss▶ │                                     │
│ Wetter       ◀ Miss▶ │                                     │
│ Startproz.   ◀ voll▶ │                                     │
├──────────────────────┴─────────────────────────────────────┤
│ [Zurück]                               [EINSATZ BEGINNEN]  │
└────────────────────────────────────────────────────────────┘

LADEN: Missionsname, Schauplatz, Balken (Terrain · Modelle · Audio), wechselnder Hinweis.

OPTIONEN  [Spiel] [Grafik] [Audio] [Steuerung]
  Zeilen „Bezeichnung   ◀ Wert ▶“ oder Schieberegler; links/rechts ändert sofort.
  Unten: [Standard wiederherstellen] [Zurück]. Steuerung = Belegungsbildschirm.

PAUSE (im Einsatz, Szene abgedunkelt, Ton gedämpft)
  Fortsetzen · Einsatzziele · Steuerung (Ansicht) · Optionen · Neu starten · Abbrechen (Bestätigung)

NACHBESPRECHUNG
  Ergebnis · Einsatzzeit ab deploy · Abschüsse mit Zerstörungsart · eigener Schaden je
  Komponente · Treffergenauigkeit · [Erneut] [Zum Hauptmenü]
```

## Module

| Datei | Aufgabe |
|---|---|
| `src/ui/menu/MenuStack.js` | Bildschirm-Stapel: push/pop/replace, Eingabe über Aktionen (Kontext `menu`), räumliche Fokus-Navigation, Fokus je Bildschirm gemerkt, Tastenwiederholung, Stick, Maus (Hover/Klick/Rad), Menügeräusche, Übergänge |
| `src/ui/menu/MenuPage.js` | Basis eines Bildschirms (Wurzel-Element, fokussierbare Elemente `[data-focus]`, Reiter, Links/Rechts-Werte) |
| `src/ui/menu/TitleScreen.js`, `MainMenu.js`, `MissionSelect.js`, `MissionPrep.js`, `OptionsScreen.js`, `CreditsScreen.js`, `ConfirmDialog.js` | die Bildschirme |
| `src/ui/menu/PauseMenu.js`, `ObjectivesPage.js`, `BindingsPage.js` | Pausenmenü im Einsatz |
| `src/ui/menu/DebriefPage.js` | Nachbesprechung |
| `src/ui/menu/LoadingScreen.js` | Ladebildschirm (gehört dem Spiel, überlebt den Zustandswechsel) |
| `src/ui/menu/missionInfo.js`, `MissionMap.js` | Missionsangaben aus Daten, Übersichtskarte aus dem Höhenfeld |
| `src/core/Settings.js`, `src/data/options.js` | Einstellungen (localStorage, try/catch), Optionen als Daten mit Wirkung |
| `src/render/MenuScene.js` | 3D-Hintergrund: Walker im Hangar/auf Schauplatz, Kamerafahrt, Drehplattform |
| `src/ui/menu.css` | Raster, Variablen, Fokusrahmen, Scroll-Andeutung, Scanlines, Vignette, CRT-Effekte |

Missionsdaten bekommen `description` und `category` (`theater` · `combat` · `system` · `debug`).
Neue Menü-Aktionen: links/rechts (Pfeile, A/D, Steuerkreuz), Reiter (Q/E, Bild↑/↓, LB/RB).
