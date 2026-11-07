# Teil 2 – Karten-Erweiterung: Plan

Alles bleibt prozedural, Low-Poly und datengetrieben. Neue Logik liegt in `src/world/`
(ohne Three.js-Abhängigkeit, wo möglich), Darstellung in `src/render/world/`.

## Module

| Datei | Aufgabe |
|---|---|
| `data/theaters.js` | 7 Schauplätze; neu je Theater: `features`, `surface` (Grundmaske), `scatter`, `structureRules`, `weather` (typisch), `gravity` |
| `data/surfaces.js` | Bodenarten hart / weich / Wasser / Lava / dünnes Eis / heiß: Tempo, Kühlung, Hitze, Beinschaden, Einbruch, Schrittklang, Farbe |
| `data/structures.js` | Baupläne der Bauwerke (Teile, Trefferzonen, Panzerung, Kollision), Streuobjekt-Modelle, Sites |
| `data/weather.js` | klar, Schneesturm, Sandsturm, Ascheregen, Bodennebel, Regen |
| `world/FeatureField.js` | Feature-Generatoren (Kämme, Senken, Schluchten, Plateaus mit Aufgang, Krater, Flüsse/Kanäle, Deiche, Lavaflüsse, Eisseen, Spalten, Adern, Straßenraster) |
| `render/terrain/TerrainSampler.js` | `heightAt` mit Features, `surfaceAt`, `fluidAt` (Wasser-/Lava-/Eisspiegel) |
| `render/terrain/FluidBuilder.js` | flache Wasser-/Lava-/Eisflächen je Chunk, leicht animiert, Lava selbstleuchtend |
| `world/WorldObjects.js` | alle Bauwerke: räumliches Raster, Kollision für Walker, Strecken-Test für Geschosse und Sichtlinie, Schaden und Zerstörungsstufen, Bus-Ereignis |
| `world/ScatterField.js` | Streuobjekte je Chunk per Seed (Dichte, Hangneigung, Abstand), Cache; große Objekte kollidieren |
| `render/world/PartBuilder.js` | Bauplan → Low-Poly-Geometrie (wie der Walker-Builder) |
| (in `world/WorldObjects.js`) | Bauwerk-Meshes je Stufe, Trümmer; Rauch/Feuer/Explosion über `MissionCombat.structureStage` |
| `render/world/ScatterRenderer.js` | Instancing je Modell und Detailstufe, Sichtweite, mit dem Terrain gestreamt |
| `render/Weather.js` | Partikel um die Kamera, Nebel, Wind; Partikel auf der Kanzelscheibe |
| `render/world/AreaFence.js` | holografischer Zaun am Einsatzgebiet |
| `world/area.js` | Polygon: innen/außen, Abstand zur Grenze |
| `states/WorldLink.js` | Mission ↔ Welt: Kollision anmelden, Bodenwirkung (Hitze, Lava, Eis), Scheibenwetter, Wind, Einsatzgebiet, Debug-Zeilen |
| `sim/WalkerMotion.js` | Bodenart: Bremsen, Einbrechen; Kollision mit Bauwerken |

## Feature-Generatoren

Jeder Generator arbeitet auf einem gejitterten Zellraster (wie die Krater): pro Zelle per Seed
„ja/nein“ und Form. `heightAt` fragt die Zelle und ihre Nachbarn ab, dadurch deterministisch,
unbegrenzt und ohne Speicher. Missionen können zusätzlich feste Features setzen
(`mission.features`, z. B. die Bodenproben).

```js
features: [
  { type: 'river', cell: 700, chance: 0.6, width: [14, 26], depth: 5, meander: 0.35, fluid: 'water', dikes: { height: 3, width: 10 } },
  { type: 'canyon', cell: 600, chance: 0.5, width: [18, 40], depth: [25, 45], length: [300, 600] },
  { type: 'plateau', cell: 800, chance: 0.4, radius: [70, 140], height: [18, 34], ramp: true },
  { type: 'basin', ... }, { type: 'ridge', ... }, { type: 'crater', ... },
  { type: 'lake', cell: 650, chance: 0.4, radius: [40, 90], depth: 3, fluid: 'thinIce' },
  { type: 'veins', cell: 120, width: 1.5 },          // Synthese: leuchtende Adern (Farbe/Maske)
  { type: 'roads', grid: 180, width: 14 },            // Brenn-Süd: eingeebnetes Straßenraster
]
```

Höhe: Grundrauschen → Features (Absenken, Anheben, Einebnen) → Missions-Hügel → eingeebnete
Zonen (Start, Sites). Flüssigkeiten: Wasser- und Lavaflächen liegen auf festem Spiegel über
dem Bett; dünnes Eis ist begehbar (Höhe = Eisspiegel), bricht aber unter schweren Walkern.

## Bodenmaske

`sampler.surfaceAt(x, z)` liefert `hard | soft | water | lava | thinIce | hot`:
Flüssigkeits-Features zuerst, dann Feature-Masken (heiße Zonen, Schneewehen, Schlamm am Ufer),
dann die Theater-Grundmaske (`surface: { base, soft: { scale, threshold } }`).

| Bodenart | Wirkung (Werte in `data/surfaces.js`) |
|---|---|
| hart | – |
| weich | bremst: `1 − perTon · Tonnage`, mindestens `min` |
| Wasser | bremst leicht, kühlt den Reaktor (°C/s), Schrittklang platschend |
| Lava | heizt (°C/s), Beinschaden pro Sekunde, Schaum/Glut |
| dünnes Eis | bricht ab Tonnage: Walker sinkt ein, kurz bewegungsunfähig, danach Waten |
| heiß | heizt leicht |

## Bauwerke

```js
depot: {
  name: 'Versorgungsdepot', faction: 'human', radius: 14, height: 9,
  armor: 300, structure: 200,          // Trefferpunkte bis beschädigt / bis Trümmer
  parts: [ { box: [w, h, d], at: [x, y, z], rot, color, zone: 'main' }, { cyl: … }, … ],
  collide: [ { box: [w, d], at: [x, z] } | { circle: r, at } ],   // Walker-Kollision
  blocksSight: true, onDestroy: 'fire',
}
```

Zerstörungsstufen intakt → beschädigt (dunkler, geneigte Teile, Rauch) → Trümmer (flache
Trümmerbrocken, Brandstelle, Feuer, keine Kollision mehr). Trefferzonen sind Boxen aus den
Teilen; der Strecken-Test läuft über ein Raster (64 m Zellen). Ereignis: `world:structure`
`{ id, type, stage }`. Sites: `SITES.outpost = { flatten: { radius, falloff }, items: [ … ] }`,
in der Mission `sites: [{ type: 'outpost', at: [x, z], rotation }]`.

## Streuobjekte

Je Theater `scatter: [{ model: 'rock', density: 60 /km², slope: [0.85, 1], scale: [0.8, 2.2], minDist: 12, collide: 2.5 }]`.
Erzeugt je Terrain-Chunk per Seed, gecacht. Darstellung: ein `InstancedMesh` je Modell und
Detailstufe (nah/fern), neu befüllt wenn der Walker die Chunk-Grenze überschreitet; Sichtweite
begrenzt (`config.scatter.viewDistance`). Große Objekte (Felsen, Säulen, Bögen) kollidieren
und blockieren Geschosse.

## Wetter

```js
sandstorm: { fog: { far: 0.35, color: '#b08a5a' }, particles: { kind: 'sand', count: 2500, size: 0.4, fall: 1, wind: [18, 0, 6] },
             canopy: { kind: 'sand', rate: 30 }, wind: 0.9, camRange: 0.4, lockRate: 0.6, lockJitter: 0.15 }
```

Partikel in einer Box um die Kamera (Wrap-Around), Scheibenpartikel in einer eigenen
Canvas-Schicht über der Kanzelscheibe, Windgeräusch als Loop. Auswirkungen: Nebel (Sichtweite),
Raketenkamera sieht im selben Nebel plus Rauschen, Aufschaltung wächst langsamer und reißt bei
Sandsturm gelegentlich kurz ab. Missionsfeld `weather`, sonst das typische Wetter des Theaters.

## Einsatzgebiet

`mission.area: [[x, z], …]` (Polygon). Radar zeigt die Grenzlinie; ab 200 m Abstand zur Grenze
steht ein holografischer Zaun (Gitterband, Deckkraft nach Abstand). Verlassen → Funkwarnung,
Rückkehr → Funkmeldung, sonst keine Folgen.

## Performance

Instancing für Streuobjekte, Bauwerke als zusammengeführte Geometrie je Stufe, Streuobjekte und
Bauwerk-Sichtbarkeit mit dem Terrain-Streaming, Kollisionsabfragen über ein Raster.
Debug-Overlay: Objekte sichtbar/gesamt, Draw Calls, Bodenart unter dem Walker.

## Testmissionen

Je Schauplatz eine (Kalvik, Ashmar, Brenn-Süd, Selene-7, Morrow, Tessar, Kernwelt) mit
typischem Wetter, einer Site und Streuobjekten, dazu „Bodenproben“: alle Bodenarten als
Streifen nebeneinander.

## Testergebnisse (headless, festes Zeitraster)

| Boden | KESTREL (leicht) | KOLOSS (schwer) | Reaktor | Sonstiges |
|---|---|---|---|---|
| hart | 87 km/h | 30,8 km/h | – | – |
| weich | 76,8 km/h | 16,9 km/h | – | bremst nach Tonnage |
| Wasser | 67 km/h | 21,4 km/h | −9 °C/s | platschende Schritte |
| Lava | 64,8 km/h | 22,9 km/h | +22 °C/s | Beine −72 in 10 s |
| dünnes Eis | 86,4 km/h, hält | bricht ein: 2,2 m, 4 s fest, danach 16,8 km/h | – | Funkspruch |
| heiß | 87 km/h | 30,9 km/h | +4 °C/s | – |

- Bauwerk: Versorgungsdepot des Stützpunkts mit BASTION (alle Waffen) in 3 s zu Trümmern;
  `world:structure` meldet `damaged`, dann `rubble`.
- Kollision: Walker läuft gegen den Hangar und bleibt 20 m vor dessen Mitte stehen.
- Sichtlinie: Ziel hinter dem Felsbogen-Pfeiler ist nicht aufschaltbar, eine Aufschaltung reißt nach 1,5 s ab.
- Optische SPEER durch den Felsbogen und rechts herum: Treffer am verdeckten MARDER (Torso).
- Sandsturm: Sichtweite 285 m statt 950 m, 2 s Aufschaltung braucht 3,3 s statt 2,0 s.
- Einsatzgebiet: Funk bei Annäherung, beim Verlassen und bei der Rückkehr.
