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

## Stand: Ausbaustufe 1 (Grundgerüst)

Game-Loop mit festem Simulationstakt, Zustandsmaschine Menü → Einsatz → Nachbesprechung,
gestreamtes Low-Poly-Terrain mit LOD, vier Schauplätze, Tageszeiten, Eingabeschicht
(Tastatur, Maus mit Pointer-Lock, Gamepad), Debug-Overlay.

## Datenpflege

- `src/data/config.js` – Engine-Einstellungen (Auflösung, Sichtweite, Terrain-LOD)
- `src/data/theaters.js` – Schauplätze: Geländeform, Farbpalette, Himmel, Nebel
- `src/data/lighting.js` – Tageszeiten
- `src/data/missions.js` – Einsätze
- `src/data/inputBindings.js` – Tastenbelegung; Overrides per localStorage-Key `steelwarden:bindings`
