# STEEL WARDEN 0.5.0 – Phase 1: Architektur- und Zustandsaudit

Stand vor der Änderung: Commit b9118df. Untersucht wurden `DamageModel.js`, `CombatUnits.js`,
`SystemsLink.js`, `WalkerSystems.js` (mit `systems/*.js`), `WalkerMotion.js`, `WeaponSystem.js`,
`StartupAutomation.js` und `HitVolumes.js`. Mitgelesen wurden die Stellen, an denen sie verbunden
sind: `MissionState.update`, `MissionCombat`, `CockpitHits`, `WorldLink`, `Projectiles`,
`Targeting`, `AIController` und `cockpitData`.

## 1. Datenfluss pro Simulationsschritt (60 Hz, `MissionState.update`)

```
SystemsLink.update ──► motion.limits = WalkerSystems.drive        (Spieler)
MissionCombat.applyPlayerLimits ──► CombatUnits.applyLimits(player): Beine SCHWER ×0,6, Wrack
WalkerMotion.update (Spieler)
MissionEntities.update ──► WalkerMotion.update (KI-Einheiten, Grenzen aus dem VORIGEN Schritt)
MissionCombat.update
   ├ CombatUnits.update: Schilde aller Einheiten; applyLimits(KI-Einheiten)
   ├ WeaponSystem.update(Spieler) ──► Wärme ──► WalkerSystems.addWeaponHeat
   ├ Projectiles.update ──► onHit ──► hitUnit ──► DamageModel.applyHit ──► CombatUnits.apply
   └ Targeting.update(Reichweite = sensorRange[Stufe Sensoren])
AIDirector.update ──► AIController.step ──► WeaponSystem.update(KI, canFire: true, power: 1)
CockpitHits.update (kritisch, Rauch), WorldLink.update (Lava: applyRaw Beine, Bodenwärme)
WalkerSystems.update ──► Flags, Lampen
StartupAutomation.update(flags) ──► bewegt nur Schalter (cause 'auto')
```

Schaden entsteht an genau fünf Stellen, und jede ruft das `DamageModel` einmal auf:

| Quelle | Aufruf | Weitergabe |
|---|---|---|
| Geschoss/Rakete | `Projectiles.collide` → `onHit` → `hitUnit` → `applyHit` | Projektil wird danach deaktiviert (`kill`) |
| Strahl (LUX-40) | `beamFrom` → `hitUnit(scale = dt)` | pro Schritt anteilig |
| Splash (SPEER, Mörser) | `splash` → `applyRaw` | direkt getroffene Einheit ausgenommen |
| Reaktorexplosion | `CombatUnits.explode` → `applyRaw('torso')` | Wracks mit Reaktor ausgenommen, keine Endlosschleife |
| Lava | `WorldLink.update` → `applyRaw('legs', dt)` | pro Schritt anteilig |
| Debug-Treffer | `CockpitHits.applyHit` | nur Debug-Taste |

**Ergebnis: Es gibt keine doppelte Schadensanwendung.** Jede Quelle trifft das DamageModel genau
einmal, `CombatUnits.apply` wertet nur die zurückgegebenen Stufenwechsel aus und rechnet selbst
keinen Schaden.

## 2. Was vollständig ist

- **Schaden:** Schildseiten mit Verschiebung, Panzerung, innere Struktur, Stufen, EMP (Schilde
  leer, Regeneration gesperrt), Übungsoption „unverwundbar“.
- **Folgen von Schaden:** Arm verloren (Waffen aus, Teil fällt, Bergung), Beine zerstört (kniet,
  stationär), Torso zerstört (Explosion, Flächenschaden, Wrack), Beine SCHWER (Tempo ×0,6),
  Sensorstufe (Zielreichweite), Monitorausfall, Risse, kritischer Alarm.
- **Startprozedur:** stetige Werte für Batterie, APU, Kühlmittel, Reaktor mit Zündung, Leerlauf,
  Vollast, Wärmebilanz, Notabschaltung, Sperre und zweitem Kreis, dazu Hydraulik, Monitore, Gyro,
  Sensoren, Schilde, Waffen und Beinsperre. Die Automatik bewegt nur echte Schalter.
- **Waffen:** Kondensator, Magazine, Nachladen, Laden (SR-3), Strahlzeit, Salven, Ketten, Sequenz,
  Lauf- und Kernwärme.
- **Bewegung:** Trägheit, Hang, Bodenarten, dünnes Eis, Kollision, Torsodrehung, Haltung über die
  Hydraulik.
- **Trefferzonen:** eine orientierte Box je Mesh, Komponente am Mesh, abgeschossene Teile werden
  entfernt.

## 3. Gefundene Probleme

| # | Art | Befund | Beleg |
|---|---|---|---|
| P1 | widersprüchlicher Zustand | **Reaktor zerstört, Systeme laufen weiter.** Explodiert der Torso des Spielers, bleibt `WalkerSystems.s.reactor` auf `running` mit 100 %. Die Waffen dürfen weiter feuern (`canFire`), die Schilde laden mit voller Rate nach, der Kondensator lädt. Bis zum Missionsende (Verzögerung) bzw. dauerhaft in Missionen mit `failOnWalkerLost: false` ist der Walker ein feuerndes Wrack. | `MissionCombat.update`: `canFire: sys.canFire`, `power = sys.s.reactor.power`; `CombatUnits.update`: Schilde mit `playerShield.enabled` |
| P2 | widersprüchlicher Zustand | **Zielerfassung ohne Sensoren.** Die Reichweite der Aufschaltung hängt nur von der Schadensstufe der Sensoren ab, nicht vom Schalter SENSOREN bzw. `s.sensors.level`. Mit abgeschalteten Sensoren ist das Radar dunkel, aufschalten geht trotzdem bis 1 600 m. | `MissionCombat.sensorsRange`, `Targeting.candidates/update` |
| P3 | nur vorbereitet | **Störeffekt ohne Wirkung.** Waffen mit `effect: { kind: 'disrupt' }` (PZ-9) setzen `DamageModel.disruptedUntil`; das liest niemand. Laut `weapons.js` soll der Effekt die Elektronik stören. Seit der Waffenumstellung (b9118df) führt kein Walker die PZ-9 ab Werk. | `grep disruptedUntil` liefert nur die Zuweisung |
| P4 | Fehler | **Breitphase der Trefferzonen zu klein.** `HitVolumes.radius = Augenhöhe × 0,85` ist kleiner als die Ausdehnung der Zonen. Schüsse auf die äußeren Teile der Zonen werden vor dem Box-Test verworfen. Gemessen (Ecken der Zonen zum Wurzelpunkt): HALBERD 9,04 m bei Radius 8,33; MONOLITH 11,03 m bei 8,84; GOLIATH 9,70 m bei 9,52; KESTREL 6,46 m bei 5,27; auch der prozedurale OBELISK (8,35 m bei 7,65), der Fehler bestand also schon vor den Tripo-Modellen. | Messung im Browser, Abschnitt 6 |
| P5 | Fehler (latent) | **Walker ohne Schilde ergeben NaN.** `designShare = front / (front + rear)` und `gain × (max / max.front)` teilen durch 0, wenn alle Schilde 0 sind (Drohne `schwarm`). Schildwerte werden NaN. Die Drohne wird heute nicht eingesetzt. | `DamageModel` Konstruktor, `updateShields` |
| P6 | Reihenfolge | **KI-Grenzen hängen einen Schritt nach.** `applyLimits` der KI-Einheiten läuft in `CombatUnits.update`, also nach deren Bewegung im selben Schritt. Ein Beinschaden wirkt erst einen Schritt später. Deterministisch, aber anders als beim Spieler. | `MissionState.update`: `entities.update` vor `combat.update` |
| P7 | Redundanz | **Stufenschwellen doppelt.** `cockpitData` bestimmt die Reaktorstufe mit eigenen Zahlen (0,8 / 0,55 / 0,3) statt mit `stageIndex`. Heute stimmen sie überein, sie können aber auseinanderlaufen. | `cockpitData.updateCombatData` |
| P8 | Redundanz | **„Kritisch“ wird lokal berechnet.** `CockpitHits` bildet aus der inneren Torsostruktur einen eigenen Kritisch-Wert, den Lampen, Alarm und Effekte lesen. | `CockpitHits.update` |
| P9 | nur vorbereitet | **ENERGIE-Anteil „Antrieb“ ohne Wirkung.** Der Drehschalter verteilt Schilde, Waffen und Antrieb; die Anzeige zeigt den Antriebsanteil, die Bewegung nutzt ihn nicht. | `EnergyDisplay`, `ENERGY_PRESETS` |
| P10 | nur vorbereitet | **Gyro nur für die Anzeige.** Die Gyro-Ausrichtung wirkt bloß auf die künstliche Horizontanzeige, nicht auf Bewegung oder Waffen. | `cockpitData` (drift) |
| P11 | nur vorbereitet | Weitere vorbereitete Felder: Signatur (für A4, wird von der KI-Wahrnehmung schon gelesen), Sprungdüsen (`jumpJets: null`, Taste meldet „keine an Bord“), Baukosten (Phase C). | – |

Keine Probleme gefunden in `StartupAutomation` (bewegt nur Schalter, stoppt bei Notabschaltung)
und `WalkerMotion` (übernimmt nur die gesetzten Grenzen). Auch `WeaponSystem` zieht Magazin,
Energie und Wärme je Schuss bzw. je Salve genau einmal ab.

## 4. Bedarf für `MachineCondition.js`

Nachgewiesen. Zustände aus Schaden und Systemen werden heute an fünf Stellen jeweils für sich
übersetzt: Zielreichweite in `MissionCombat`, Beine und Wrack in `CombatUnits.applyLimits`,
Antrieb in `WalkerSystems.drive`, Reaktorstufe in `cockpitData`, Kritisch-Wert in `CockpitHits`.
Daraus entstehen P1 bis P3 und P7/P8.

### Schnittstelle

```js
import { MachineCondition, evaluateCondition } from './sim/MachineCondition.js';

unit.condition = new MachineCondition(unit, systems | null); // CombatUnits.prep (Spieler: systems)
const c = unit.condition.evaluate();   // reine Funktion des aktuellen Zustands
evaluateCondition({ damage, systems, wreck, immobile, lostArms, hardpoints }) // dieselbe Rechnung, ohne Objekt
```

Rückgabe (alle Werte 0..1, eingefroren):

| Wert | Quelle | Verbraucher |
|---|---|---|
| `reactorIntegrity` | innere Torsostruktur | Cockpit (Reaktorstufe), Kritisch-Wert |
| `reactorAvailable` | Wrack-Art `reactor` → 0, sonst 1 | Waffen, Schilde, Antrieb (P1) |
| `reactorOutput` | Reaktorleistung / Vollast (Systeme) × verfügbar; KI ohne Systeme: 1 | Kondensator, Schildrate |
| `drivePower` | Reaktorleistung × Beinfaktor (SCHWER ×0,6) × verfügbar, 0 wenn stationär | `motion.limits.speedFactor` |
| `hydraulicPower` | Druck / Bereitschaftsdruck; 0 wenn stationär | `motion.limits.stance` |
| `movementStability` | Beinzustand × Hydraulik × (0,7 + 0,3 × Gyro) | Anzeige/Debug (Phase 2) |
| `weaponStabilization` | (0,5 + 0,5 × Gyro) × Reaktor verfügbar | Anzeige/Debug (Phase 2) |
| `sensorPerformance` | `sensorRange[Stufe]` × Sensorpegel (Systeme) × Störung | Zielreichweite, Radar (P2, P3) |
| `weaponsOnline` | `canFire` (Systeme) und Reaktor verfügbar | `WeaponSystem.update(canFire)` |
| `shieldsOnline` | Flag SCHILDE und Reaktor verfügbar | Schildladung |
| `weaponAvailability` | Anteil der Waffen-Hardpoints an nicht verlorenen Teilen | Anzeige/Debug |
| `canMove`, `critical`, `disrupted`, `reactorStage` | abgeleitet | Grenzen, Lampen, Cockpit |

Regeln:

- `MachineCondition` liest nur, schreibt nie in DamageModel oder WalkerSystems. Es bleibt eine
  einzige Schadenssimulation.
- Deterministisch: keine Zufallszahlen, keine Uhrzeit. Die Zeit kommt aus `damage.time`.
- Bestehende Schnittstellen bleiben: `WalkerSystems.drive`, `canFire`, `CombatUnits.applyLimits`,
  `MissionCombat.sensorsRange` und `readout()` behalten Namen und Form und liefern die Werte nun
  aus der Zustandsrechnung.

## 5. Geplante Änderungen (nur begründete)

1. Neu: `MachineCondition.js` nach Abschnitt 4.
2. P1: Waffen, Schilde und Kondensator des Spielers über `reactorAvailable` / `reactorOutput`.
3. P2/P3: Zielreichweite = `sensorPerformance` (Sensorpegel × Schadensstufe × Störung).
4. P4: `HitVolumes.updateBounds()` bestimmt den Radius der Breitphase aus den Zonen der aktuellen
   Pose und wird jeden Schritt aufgerufen.
5. P5: Teilen durch 0 im DamageModel abgesichert.
6. P6: Grenzen aller Einheiten vor deren Bewegung setzen (`MissionCombat.applyUnitLimits`).
7. P7/P8: Reaktorstufe und Kritisch-Wert aus der Zustandsrechnung.

Bewusst **nicht** umgesetzt, weil es Spielverhalten neu festlegen würde: der Antriebsanteil der
ENERGIE-Verteilung (P9) sowie Gyro bzw. Stabilität als Wirkung auf Streuung und Bewegung (P10).
Die Werte werden berechnet und angezeigt; ihre Wirkung ist eine Balance-Entscheidung für Phase 2.

## 6. Messung P4 (Browser, Paradeplätze)

| Walker | Radius Breitphase | größter Abstand Rumpfzonen | größter Abstand Beinzonen |
|---|---|---|---|
| KESTREL | 5,27 | 4,57 | **6,46** |
| MARDER | 5,87 | 5,47 | 5,73 |
| BASTION | 7,82 | 6,91 | 7,10 |
| HALBERD | 8,33 | **9,04** | 8,12 |
| GOLIATH | 9,52 | 8,72 | **9,70** |
| KOLOSS | 11,56 | 9,68 | 9,82 |
| SPLITTER | 4,55 | 4,54 | 3,50 |
| SICHEL | 6,80 | 6,66 | 5,97 |
| MONOLITH | 8,84 | **9,67** | **11,03** |
| OBELISK (Bauplan) | 7,65 | **8,35** | 7,46 |

## 7. Umsetzung und Prüfung

Geändert: `src/sim/MachineCondition.js` (neu), `HitVolumes.js` (`updateBounds`), `DamageModel.js`
(Teilen durch 0), `CombatUnits.js` (Zustand je Einheit, `applyLimits` aus dem Zustand,
`applyUnitLimits`), `MissionCombat.js` (Waffen, Schilde, Leistung, Zielreichweite aus dem Zustand),
`MissionState.js` (KI-Grenzen vor der Bewegung, Debug-Zeile), `CockpitHits.js` (Kritisch-Wert),
`cockpitData.js` (Reaktorstufe), `data/combat.js` (Störfaktor, Kennwerte der Anzeigewerte).

Tests: `npm test` (Node, 26 Fälle in `tests/`). Im Browser liefen außerdem der Automatikstart per
Shift+S, Sensoren und Aufschaltung, Reaktorzerstörung, die Raketen-Suite, Steuerung, Gefecht,
Wracks, Startphase, Alarmstart und Menüablauf.
