# STEEL WARDEN

Mech-Kampagnensimulator im Browser (Three.js, ES-Module, Vite).

## Start

```
npm install
npm run dev        # Dev-Server mit Hot Reload
npm run build      # statischer Build nach dist/
```

`dist/index.html` läuft per Doppelklick offline (klassisches Skript, kein Server nötig).

Schnellstart-Parameter (Dev und Build):

- `?mission=test-ice` – Menü überspringen (IDs siehe `src/data/missions.js`)
- `?debug=1` – Debug-Overlay sofort anzeigen

## Stand

- **Ausbaustufe 1 (Grundgerüst):** Game-Loop mit festem Simulationstakt, Zustandsmaschine
  Menü → Einsatz → Nachbesprechung, gestreamtes Low-Poly-Terrain mit LOD, vier Schauplätze,
  Tageszeiten, Eingabeschicht (Tastatur, Maus, Gamepad), Debug-Overlay.
- **Erweiterung Schritt 1 (Cockpit-Grundmodell):** begehbares 3D-Cockpit (Variante `standard`)
  als eigener Render-Pass, freies Umsehen, Schubhebel und Seitenknüppel als bewegte 3D-Objekte,
  5 CRT-Monitore mit Nachleuchten, alle Schalter der Startprozedur als 3D-Modelle aus Daten,
  Schubhebel mit Nullraste, Beine/Torso getrennt, Schrittwippen, Bremsnicken.
- **Erweiterung Schritt 2 (Interaktion + Audio):** Cockpit-Cursor im freien Blick (Rand dreht
  den Kopf), alle Schalter, Kappen, Drehregler, Taster und Lampen bedienbar, Schubhebel ziehbar.
  Schalterzustände als Simulationszustand (`sim/CockpitControls.js`). Hybride Audio-Engine:
  eingebettete Samples plus prozedurale Klicks; Schritte, Servo, Reaktor, Lüftung, Knarzen.

## Bedienung im Cockpit

- Rechte Maustaste halten oder `V`: freier Blick mit Cockpit-Cursor; Maus über den Bildrand
  hinaus dreht den Kopf
- Linksklick (oder `F`, Pad A): Schalter umlegen, Schutzkappe öffnen, offene Kappe schließen
- Drehregler: linke/rechte Hälfte anklicken oder Mausrad
- Taster und Lampen: gedrückt halten (Lampentest); Schubhebel: anklicken und ziehen

## Sounds

Rohdateien in `assets/sounds-raw/`, Aufbereitung mit `python3 tools/prepare_sounds.py`
(braucht numpy und ffmpeg) nach `src/audio/samples/`. Die Samples werden ins Bundle
eingebettet, damit der Offline-Build per `file://` funktioniert. Klang und Mischung:
`src/data/sounds.js`. Herkunft: `CREDITS.md`.

## Datenpflege

- `src/data/config.js` – Engine-Einstellungen und Fahrgefühl (`feel`, `view`, `cockpit`)
- `src/data/walkers.js` – Walker-Werte (bisher BASTION MW-1)
- `src/data/cockpits.js` – Cockpit-Varianten: Kanzel, Paneele, Sitz, Kabel, Innenlicht
- `src/data/panelLayouts.js` – Schalter, Lampen, Monitore und Hebel auf den Paneelen
- `src/data/sounds.js` – Sound-Ereignisse, Loops, Mischpult, Bewegungs-Sounds
- `src/data/theaters.js` – Schauplätze: Geländeform, Farbpalette, Himmel, Nebel
- `src/data/lighting.js` – Tageszeiten
- `src/data/missions.js` – Einsätze
- `src/data/inputBindings.js` – Tastenbelegung; Overrides per localStorage-Key `steelwarden:bindings`
