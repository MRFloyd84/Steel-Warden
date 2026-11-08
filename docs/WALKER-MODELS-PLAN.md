# Walker- und Synthese-Modelle aus Tripo

Auftrag: „die Walker bitte als aktuelle Mechs einbauen, die Synthese sind Gegner“ — die zwölf
mitgelieferten Tripo-GLBs (auto-gerigt, Mixamo-Skelett, 16 000–61 000 Dreiecke, PBR-Texturen).

## Zuordnung

| Modell (Tripo-ID) | Einheit | Grund |
|---|---|---|
| b19a4802 (Vogelbeine, Cockpitkapsel) | KESTREL (leicht) | Vogelbein-Läufer, klein |
| 15e339ba (dunkel, Kanonenarm) | MARDER (leicht) | schlank, zwei Armwaffen |
| 4fc32435 (grün, humanoid) | BASTION (mittel) | Allrounder |
| ae447b27 (Raketenkästen) | HALBERD (mittel) | Raketenträger, Schulterlafetten |
| 94c4f974 (grün, schwere Arme) | GOLIATH (schwer) | Armgeschütze |
| 7e98f740 (grün, kantig, hoch) | KOLOSS (Sturm) | größter, Schulterlafetten |
| 5738cc5d (Dreibein, rote Augen) | SPLITTER (Späher) | dünn, schnell |
| 7332d940 (violetter Kristall, Klauen) | SICHEL (Jäger) | Nahkampf-Silhouette |
| f6483e2e (wuchtig, Kanone) | MONOLITH (Brecher) | schwer |
| 496aa3b3 (Kristallturm) | Abwehrstachel (Bauwerk) | statisch |

Nicht eingebunden: Drohne (keine Flugphysik, Lufteinheit nur Daten), Vierbein-Kriecher (Rig
kennt zwei Beine), OBELISK behält den prozeduralen Bauplan (kein passendes Modell).

## Ansatz: starre Segmente auf dem eigenen Rig

Skinning im Browser würde das Spielgerüst umgehen (IK-Beine, Torsodrehung, Armzielen,
Trefferzonen je Bauteil, abgeschossene Arme). Daher:

1. `tools/import_walkers.py` wendet das Skinning einmal an (Ruhepose), teilt jedes Mesh-Teil
   als Ganzes einem Segment zu (Becken, Torso, Sensoren, Arme, Ober-/Unterschenkel, Füße) —
   per Skin-Gewicht und Abstand zu den Knochen, Teile über Knie/Knöchel werden je Dreieck
   geschnitten; Korrekturen je Modell (`FIXES`, `SHORT_ARMS`).
2. Drehung nach −Z, Maßstab auf die bisherige Walker-Höhe, reduziert auf ≈ 3 500–7 500
   Dreiecke, Flächenfarbe aus der Textur, auf 9 Farben reduziert; leuchtende Kristallflächen
   der Synthese werden selbstleuchtend.
3. GLB mit einem Mesh je Segment plus Gelenkpunkten. `render/walker/WalkerMeshes.js` baut daraus
   Plan und Geometrien: Hüfthöhe, Bein- und Schenkellängen, Hüftbreite, Kniestellung
   (Vogelbein erkannt), Torso-Drehpunkt und Schultern kommen aus dem Modell.
4. Hardpoints: die Montagepunkte des prozeduralen Plans werden in die Bauteilgrenzen des
   Modells übertragen; Waffenmodelle und Mündungen bleiben.
5. Fehlt eine Datei oder steht Optionen → Grafik → Walker-Modelle auf „klassisch“, gilt der
   prozedurale Plan wie bisher.

## Test

- `test-parade` (alle sechs Walker laufen), neue `test-parade-synth` (Synthese + Stachel).
- Regression: Raketen-Suite (Trefferzonen), Duell, Wrack Beine/Reaktor, Menü-Vorschau.
