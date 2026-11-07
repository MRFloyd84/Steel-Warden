# Phase A3 – Synthese-Gegner und KI: Plan

## Module

| Datei | Aufgabe |
|---|---|
| `data/enemies.js` | Synthese-Einheiten (Späher SPLITTER, Jäger SICHEL, Brecher MONOLITH, Belagerer OBELISK, Drohne SCHWARM als Platzhalter) im Walker-Format plus `ai`, `salvage`, `faction`; Geschütz-Daten für Abwehrstachel und Geschützturm |
| `data/enemyModels.js` | Baupläne der Synthese im Format von `walkerModels.js` (gleiche Gelenke): Beinstil `insect`, asymmetrische Splitter, abgesetzte Panzerplatten, Leuchtadern (`glow`) |
| `data/weapons.js` | Synthese-Waffen (Splitterwerfer, Lanze, Impuls, Hammer, Schwarmraketen, Mörser mit ballistischer Bahn) |
| `data/difficulty.js` | 5 Stufen: Reaktion, Streuung, Vorhalt, Taktik, Verstärkung, Anzahl, Sicht |
| `ai/NavGrid.js` | grobes Raster (12 m) über dem Gelände: Steigung, Wasser, Lava, Eis, Bauwerke, große Felsen; Zellen werden beim ersten Zugriff bewertet und gemerkt; A* mit Binärheap, Begrenzung der Knoten, Pfadglättung per Sichtstrahl im Raster |
| `ai/Perception.js` | Sichtprüfung (Kegel, Reichweite × Licht × Wetter, Sichtlinie Gelände + Bauwerke), Ortung strahlender Ziele, Lärm, Gedächtnis mit Verblassen |
| `ai/AIController.js` | Zustandsmaschine je Einheit, Steuern (Schub/Drehen wie der Spieler), Zielen mit Vorhalt/Streuung/Reaktionszeit, Feuern über das eigene `WeaponSystem`, Aufschaltung für Lenkraketen |
| `ai/AIGroup.js` | Gruppe: Synthese-Netz (Kontakte mit Verzögerung), Formation, Rollen, Fokusziel, Verstärkung anfordern |
| `ai/AIDirector.js` | alle Gruppen, gestaffelter KI-Takt, Pfad-Budget, Spawns (Rand oder Landefähre), Wellen, Geschütze, Lärm, Debug-Anzeige, Einfrieren |
| `ai/Gunner.js` | Geschütz-KI für Abwehrstachel und Geschützturm (Kopf dreht sich, Feuer aus der Mündung) |
| `render/AIDebugView.js` | Debug-Modus: Zustand/Ziel über jeder Einheit, Sichtkegel, Pfade, letzte bekannte Spielerposition |
| `states/MissionScript.js` | einfache Erfolgsprüfung: Navpunkte, Patrouille stellen, Extraktion erreicht / Walker zerstört |

## Gegner-Datenformat

```js
sichel: {
  id, name: 'SICHEL', faction: 'synth', class: 'medium', tonnage, maxSpeed, turnRate, torsoTwistLimit, …  // wie walkers.js
  shields, armor, hardpoints, defaultLoadout, defaultChains, geometry: 'sichel',
  ai: { profile: 'hunter', preferredRange: 320, aggression: 0.6, morale: 0.5, flankChance: 0.35,
        sight: { range: 900, coneDeg: 120 }, detectEmitting: 1600, retreatAt: 0.3, callsHelp: false },
  salvage: { scrap: 180, weaponDropChance: 0.4 },
}
```

Profile: `scout` (flankiert, ruft Verstärkung, geht nah ran), `hunter` (Standard), `bruiser` (langsam,
hält Abstand, Raketen), `artillery` (feuert nur auf Kontakte anderer, ballistisch), `turret` (stationär).

## Wahrnehmung

- Sicht alle 0,3–0,5 s je Einheit (gestaffelt): Reichweite × Tageszeit (Nacht 0,45) × Wetter (Nebelfaktor), Kegel ±60°,
  im Nahbereich (60 m) rundum. Sichtlinie: Gelände-Raycast + `WorldObjects.blocked`.
- Strahlt das Ziel (`emitting`, Spieler: Schalter SENSOREN an), ist seine Position bis `detectEmitting` bekannt
  (Kontakt „geortet“, ohne Sicht: kein Direktfeuer, aber Untersuchen/Artillerie).
- Lärm: Schüsse (600–900 m) und Explosionen (1000 m) melden eine Position an Einheiten im Umkreis.
- Gruppe: jeder Kontakt geht mit 0,8 s Verzögerung ins Synthese-Netz.
- Gedächtnis: letzte bekannte Position mit Zeitstempel; nach `memory` s (Standard 25) vergessen.

## Zustandsmaschine

```
Ruhe/Patrouille ─Lärm/Netz→ Untersuchen ─Sicht→ Angriff ⇄ Flankieren
      ↑                          │                │  └─Schaden/Moral→ Rückzug
      └──── Gedächtnis leer ── Suchen ←─Ziel weg──┘
Späher bei Erstkontakt: Verstärkung rufen → Flankieren
Beine zerstört: Angriff ohne Bewegung (stationär)
```

Angriff hält `preferredRange` (zu weit: annähern, zu nah: zurück), sonst Kreisen um das Ziel mit
Richtungswechsel; bei schwachen Schilden Deckung hinter einem Bauwerk oder großen Fels auf der dem Ziel
abgewandten Seite. Zielen: Vorhalt nach Geschossflugzeit × Vorhaltgüte, Zielpunkt mit Fehler, der
alle `reaction` s neu gewürfelt wird; Torso dreht unabhängig von den Beinen. Lenkraketen: Aufschaltung
läuft, solange das Ziel sichtbar im Kegel ist → Warnung beim Spieler; danach Start im Modus aktiv.

## Navigationsraster

Zelle 12 m, Kosten: Steigung (> 0,6 gesperrt), Wasser ×3, Lava gesperrt, dünnes Eis für ≥ 50 t gesperrt,
weicher Boden ×1,5, Bauwerke/große Felsen gesperrt. A* (8 Nachbarn, max. 4000 Knoten), Glättung durch
Überspringen von Wegpunkten mit freier Rasterlinie. Neuberechnung frühestens alle 2 s je Einheit, global
höchstens 3 Pfade je Simulationsschritt. Ausweichen untereinander: Abstoßung in der Wunschrichtung.

## Schwierigkeitsgrade (`data/difficulty.js`)

| | Reaktion | Streuung | Vorhalt | Flanke/Deckung/Fokus | Verstärkung | Anzahl |
|---|---|---|---|---|---|---|
| Anfänger | 1,4 s | 4,5° | 0,2 | –/–/– | ×1,8 | ×0,6 |
| Grün | 1,0 s | 3,2° | 0,45 | ✓/–/– | ×1,4 | ×0,8 |
| Normal | 0,7 s | 2,2° | 0,7 | ✓/✓/– | ×1,0 | ×1,0 |
| Veteran | 0,45 s | 1,4° | 0,85 | ✓/✓/✓ | ×0,8 | ×1,2 |
| Elite | 0,3 s | 0,8° | 1,0 | ✓/✓/✓ | ×0,6 | ×1,4 |

## Umsetzung – Abweichungen und Ergänzungen

- **Schießen für alle:** `MissionCombat.fireFrom()` / `beamFrom()` feuern für jeden Schützen
  (Walker oder Geschütz). Geschosse treffen keine Einheiten der eigenen Seite (`unit.side`),
  ein Geschütz trifft sein eigenes Gebäude nicht. Jeder Walker hat jetzt ein `WeaponSystem`.
- **Ballistik:** `def.ballistic` fällt mit Schwerkraft; der Mörser bekommt je Schuss Richtung
  und Ladung (45°-Bogen, nah 60°) mit Vorhalt über die Flugzeit.
- **Spotten:** der Belagerer bekommt die Daten aller Synthese-Einheiten (nicht nur der eigenen
  Gruppe), sobald einer das Ziel sieht — sonst stünde er in eigener Gruppe (Wellen) blind.
- **Flankieren** nur zu Punkten, die begehbar sind und Sicht auf das Ziel haben (sonst
  flankierten Einheiten im Canyon über die Hochebene davon).
- **Rückzug** nach schwerem Schaden einmalig, nach 30 s kommt die Einheit für das letzte
  Gefecht zurück; Moralbruch hält 15 s. Wachen bleiben im Umkreis von 250 m ihres Postens.
- **Geschütze** feuern in Salven (Stachel 3 s / 2 s Pause, Turm 1,2 s / 2,2 s) mit mehr Streuung.
- **Zielpunkt einer Komponente** ist jetzt die Mitte ihres größten Volumens (bei Beinen: ein
  Beinsegment, nicht der Hüftblock) — vorher lag der Mittelwert zwischen den Beinen und die
  Zielkapsel-Konvergenz schoss durch die Lücke.
- **Hangar:** neues Bauwerk `hangarBay` mit offenem Tor und einzeln kollidierenden Wänden.

## Testergebnisse (headless, swiftshader)

| Test | Ergebnis |
|---|---|
| Duell, Spieler passiv 40 s | Anfänger 26 Treffer / 103 Schaden, Normal 153 / 306, Elite 297 / 611 (Strahl zählt je Schritt) |
| Duell, Spieler kämpft (Bot, Normal / Elite / Anfänger) | Sieg nach 39 s / 19,5 s / 20 s, erhaltener Schaden 106 / 173 / 0 |
| Hinterhalt, SENSOREN aus | Patrouille kommt um den Knick, Späher sieht → Verstärkung, 40 s später Jäger vom Ostende |
| Stellung | Stachel und Türme feuern in Salven, MONOLITH schaltet auf: Warnung `lock` → `missile` |
| Welle (GOLIATH-Bot) | Wellen 1 und 2 vernichtet, Welle 3 landet; OBELISK schießt nach Spotten (Einschläge 8–32 m neben dem Ziel, Flugzeit 14 s) |
| Beine | Jäger kniet, schießt kniend weiter (26 Schüsse in 8 s), „Beine · 100 % = 180 Schrott“, Adern verblassen |
| Reaktor | Explosion Radius 27,5 m, 17 Schaden am Spieler in 22 m, Kopfstoß, 2 Trümmerteile |
| Erster Einsatz (Bot, Normal) | ALPHA → Patrouille vernichtet → Landefähre mit MONOLITH → Extraktion: „completed“ nach 250 s |
| 21 aktive Einheiten | KI 0,07 ms je Schritt (Halten) bzw. 0,47 ms (im Feuergefecht), Simulation gesamt 0,2–0,75 ms; ≈ 16 Draw Calls je Einheit |
| A2b-Suite, Steuerungstest | unverändert |
