# Waffen an den Tripo-Modellen

Auftrag: Waffen so einsetzen, wie sie an Mechs und Gegnern modelliert sind; Waffenmodule so
anpassen, dass sie Sinn ergeben. Lizenz: mit Tripo-Credits bezahlt → Rechte bei Rene.
Entscheidungen: GOLIATH bekommt mehr Panzerung statt mehr Waffen; MONOLITH führt eine große
Schwarm-Salve (L) am Armwerfer.

## Umsetzung

- `data/walkerMeshes.js` → `WALKER_MESH_MOUNTS`: je Hardpoint das Teil, an dem die Mündungen
  hängen (`attach`), und die Suche nach den modellierten Rohren (Segmente, optionaler Kasten,
  Zahl der Rohre bzw. Werferraster `[Spalten, Reihen]`).
- `render/walker/muzzleFinder.js`: vorderste Punkte im Suchbereich = Rohrenden, nach Rohren
  gruppiert. Läuft beim Bau des Modells (`WalkerMeshes.js`), Ergebnis in Teil-Koordinaten.
- `WeaponModels.js`: modellierte Waffen bekommen kein zusätzliches Waffenmodell; mehrere
  Mündungen feuern reihum (Doppelrohre, Rotorkanonen, Werferrohre). Klassische Modelle wie bisher.
- Importer: Schulterkästen des BASTION zum Torso, Raketenwerfer des MONOLITH zum linken Arm.

## Walker

| Mech | Hardpoints → Werkswaffe | Gewicht t |
|---|---|---|
| KESTREL | LA S Energie LUX-12 (Kinn, 2 Rohre) · RA S Universal LUX-12 (Kinn, 2 Rohre) · CT S Universal ZK-1 (Schlitz unter der Kanzel) · TS S Rakete FALKE-4 (Gitterkästen oben, abwechselnd) | 3,5 → 4,5 / 6 |
| MARDER | LA M Ballistik AK-20 (Doppelrohr) · RA M Energie LUX-40 · LT S Energie LUX-12 · RT S Rakete FALKE-4 (Kästen oben) | 9,5 / 10 |
| BASTION | LA M Rakete FALKE-4 (2×2-Werfer) · RA M Ballistik AK-20 (Zwillingskanone) · LS M Rakete HABICHT-8 (X-Klappe) · RS M Energie LUX-40 (Lüftungskasten) · CT S Universal ZK-1 | 14,5 → 13 / 16 |
| HALBERD | LS L Rakete SPEER (3×3) · RS L Rakete HABICHT-8 (3×3) · LA M Universal IMP-2 (Faust) · RA M Energie LUX-40 (Faust) | 15,5 / 20 |
| GOLIATH | RA L Ballistik SR-3 (Doppelrohr) · LA M Rakete HABICHT-8 (2×2) · LT/RT M Energie LUX-40 (Brustschlitze); Panzerung +~18 % | 23,5 → 16,5 / 28 |
| KOLOSS | LA/RA L Ballistik RK-30 (neu, Rotorkanone, 3 Rohre) · LS/RS M Rakete HABICHT-8 (Brust oben, 2×2) · LT/RT S Rakete FALKE-4 (Brust unten, 2×2) | 29,5 → 24 / 38 |

## Synthese

| Gegner | Hardpoints → Waffe |
|---|---|
| SPLITTER | LT Splitterwerfer (Linse am Ausleger) · CT Splitterwerfer (rotes Auge) |
| SICHEL | LA Kristalllanze (Klaue) · RA Impulsprisma (Klaue) · CT Impulsprisma (Brustkristall) |
| MONOLITH | RA Kristallhammer (Sechskantkanone) · LA Große Schwarmsalve L (6er-Werfer, 12 Raketen) · CT Impulsprisma (Brustkristall) |
| OBELISK | unverändert (Bauplan, Waffenmodelle sichtbar) |
| Abwehrstachel | Impulsprisma aus der Kristallspitze |

## Neue Waffen

- **RK-30 Rotorkanone** (L, ballistisch, 7 t): 18 Schuss/s à 5, 90er-Magazin, 550 m.
- **Große Schwarmsalve** (L, Rakete, Synthese, 5 t): 12 Schwarmraketen je Salve, 10 s Nachladen.
