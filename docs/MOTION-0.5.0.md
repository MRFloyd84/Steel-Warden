# STEEL WARDEN 0.5.0 – Phase 2: Walker-Bewegung und Systemintegration

Grundlage: Commit 05bfccd (Phase 1). Geprüft vor der Änderung: `WalkerMotion.js` (Schub mit
Trägheit, Hang, Boden, Federn für Nicken und Rollen, Gang), `CombatUnits.applyLimits`,
`MachineCondition.js`, `ENERGY_PRESETS` (nur für Schilde und Waffen genutzt, der Antriebsanteil
nur angezeigt), Gyro (nur Horizontanzeige) sowie die Walker-Daten (`tonnage`, `maxSpeed`,
`acceleration`, `turnRate`, `torsoTwistRate` sind je Walker gesetzt). Es gab keinen Rückstoß.

## 1. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/sim/WalkerMotion.js` | Federn nach Masse, Drehträgheit der Beine, Bremsen nach Masse, Stabilität (Rollen, Tritt, Federdämpfung), Hinken, `recoil()`, Shift+C mit Drehträgheit |
| `src/sim/MachineCondition.js` | `driveEnergy`, `driveAccel`, `gyro` (nur ausgerichtet und mit Strom), `limp`; `drivePower` = Reaktor × Beine × Energie; reine Helfer `spreadFactor`, `recoilImpulse` |
| `src/states/combat/CombatUnits.js` | `applyLimits` setzt zusätzlich `accelFactor`, `stability`, `limp` |
| `src/states/combat/MissionCombat.js` | Energieverteilung aus `energySplitOf`; Streuung beim Gehen und Rückstoß für Spielerschüsse |
| `src/data/systems.js` | Stellung `ANTRIEB` (Schilde 0,25 / Waffen 0,25 / Antrieb 0,5), `DRIVE_ENERGY`, `energySplitOf`, `driveEnergyFactor` |
| `src/data/panelLayouts.js` | Drehschalter ENERGIE: vierte Stellung ANTRIEB (Ausgangsstellung bleibt AUSGL) |
| `src/data/config.js` → `feel` | Masse-, Stabilitäts- und Rückstoßkennwerte (alle kommentiert) |
| `src/data/combat.js` → `condition` | `limpFromStage`, `moveSpread` |
| `tests/motion.test.mjs`, `tests/motionMetrics.mjs` | neu: 15 Tests, Messwerkzeug (`node tests/motionMetrics.mjs [Szenario]`) |

## 2. Umgesetzte Mechaniken

### Energieverteilung
- Der ENERGIE-Schalter wird an einer Stelle gelesen (`energySplitOf`). `MissionCombat` nimmt daraus
  die Anteile für Schilde und Waffen (unverändert), `MachineCondition` den Antriebsanteil. Jeder
  Anteil hat genau einen Verbraucher.
- Antriebsfaktor = 1 + 0,6 × (Anteil / 0,33 − 1), begrenzt auf 0,75…1,15:
  SCHILD und WAFFE ×0,855, AUSGL ×1, ANTRIEB ×1,15. Er wirkt auf Höchsttempo (`speedFactor`) und
  Beschleunigung (`accelFactor`).
- `drivePower = Reaktorleistung × Beinfaktor × Energie`, aber nur wenn der Walker sich überhaupt
  bewegen kann. Bei zerstörtem Reaktor, zerstörten Beinen oder angezogener Beinsperre bleibt es 0,
  egal wie viel Energie anliegt.
- Neue Stellung ANTRIEB: Damit „mehr Antriebsenergie“ überhaupt wählbar ist. Bisher hatte keine
  Stellung mehr als 0,33.

### Gyroskop
- Der Gyro-Wert ist die Ausrichtung, aber nur im Zustand „wird ausgerichtet“ oder „ausgerichtet“
  und mit Strom. Ausgefallen, aus oder ohne Strom: 0.
- `movementStability` = Beine × Hydraulik × (0,7 + 0,3 × Gyro). Geringere Stabilität bedeutet:
  - **Torsostabilisierung:** Die Federn für Nicken und Rollen sind schwächer gedämpft
    (bis −45 %), der Torso schwingt länger nach.
  - **Bewegungsunruhe:** Rollen beim Gehen bis ×2, Kopfstoß je Schritt bis ×1,8.
- `weaponStabilization` = 0,5 + 0,5 × Gyro:
  - **Zielstabilisierung beim Gehen:** Die Streuung der Spielerwaffen steigt mit Gangstärke ×
    (1 − Stabilisierung): ausgerichtet ×1, ohne Gyro bei vollem Gang ×2, im Stand immer ×1.
  - **Rückstoß:** Der Gyro nimmt 60 % des Rückstoßes heraus.
- Ohne Gyro bleibt der Walker voll fahrbar: gleiches Tempo, gleiche Beschleunigung, Waffen
  feuern; nur unruhiger und ungenauer im Gehen.

### Masse (aus `tonnage` der Walker-Daten, keine neuen Gewichte)
- Torsofedern: Steifigkeit × s, Dämpfung × √s mit s = 50 t / Tonnage (gleiches Dämpfungsmaß).
  Leichte Walker schwingen schnell und kurz, schwere langsam und lang.
- Drehträgheit der Beine: Zeitkonstante 0,06 s + 0,0045 s/t (KESTREL 0,17 s, KOLOSS 0,51 s).
  Die Drehrate selbst bleibt der Datenwert `turnRate`.
- Bremsen: Bremsfaktor × (50 t / Tonnage)^0,2 — schwere Walker tragen ihren Schwung weiter.
- Beschleunigung und Höchsttempo bleiben die Datenwerte (`acceleration`, `maxSpeed`).
- Shift+C (Beine zum Torso) berücksichtigt die Drehträgheit: Die Beine laufen rechtzeitig aus, ein
  Rest wird nachgedreht, die Torsorichtung bleibt dabei exakt erhalten.

### Beschädigte Beine
- Der vorhandene Tempofaktor bei SCHWER (×0,6) wird nur einmal angewendet, in `drivePower`.
- Neu ist nur das Verhalten: Ab Stufe MITTEL hinkt der Walker (`limp` = 1 − Beinstabilität:
  MITTEL 0,15, SCHWER 0,40). Jeder zweite Schritt setzt hart auf, der Torso kippt zur Seite. Dazu
  kommt die geringere Stabilität (Rollen, Nachschwingen).

### Rückstoß (bisher nicht vorhanden)
- Impuls auf das Nicken je Schuss = 2 × Waffengewicht × Typ (ballistisch 1, Energie 0,35, Rakete
  0,25) / Tonnage / max(1, Feuerrate) × (1 − 0,6 × Stabilisierung). Gewicht, Typ und Feuerrate
  kommen aus `weapons.js`.
- Nur Spielerwaffen, im festen Simulationsschritt, wirkt auf das Nicken und damit auf das Zielen.

### KI-Einheiten
- Sie haben keine Cockpitsysteme: Antriebsfaktor 1, Gyro 1. Der Schalter und der Gyro des
  Spielers wirken nicht auf sie (Test und Browserprüfung). Ihre eigenen Beinschäden wirken wie
  bisher (Tempo) und neu auf Stabilität und Hinken. Massefedern, Drehträgheit und Bremsen gelten
  für alle Walker gleich, auch für die Synthese.

## 3. Messwerte vorher / nachher

Ebener, harter Boden, 60 Hz, Schub per Achse, `node tests/motionMetrics.mjs`. Die Werte sind
reproduzierbar (gleiche Zahlen bei jedem Lauf, siehe Test „deterministic“).

**Vorher** (Commit 05bfccd):

| Walker | t | v max m/s | 0→90 % s | Bremsweg m | Bremszeit s | Nicken max ° | Nachschwingen s | Drehen 90 % s | Winkel 2 s ° | Rollen ° | Kopf m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KESTREL | 25 | 24.00 | 3.10 | 25.5 | 2.15 | 10.12 | 2.35 | 0.02 | 151.2 | 0.30 | 0.005 |
| MARDER | 35 | 20.00 | 3.02 | 20.7 | 2.08 | 8.68 | 2.35 | 0.02 | 131.1 | 0.42 | 0.007 |
| BASTION | 50 | 16.00 | 3.22 | 17.6 | 2.23 | 6.51 | 2.27 | 0.02 | 90.8 | 0.60 | 0.009 |
| HALBERD | 60 | 13.50 | 3.20 | 14.9 | 2.23 | 5.49 | 2.23 | 0.02 | 76.6 | 0.72 | 0.012 |
| GOLIATH | 80 | 11.00 | 3.82 | 14.5 | 2.65 | 3.76 | 1.67 | 0.02 | 60.5 | 0.96 | 0.017 |
| KOLOSS | 100 | 8.50 | 4.03 | 11.8 | 2.80 | 2.75 | 1.63 | 0.02 | 48.4 | 1.20 | 0.021 |

**Nachher, AUSGL, Gyro ausgerichtet:**

| Walker | t | v max m/s | 0→90 % s | Bremsweg m | Bremszeit s | Nicken max ° | Nachschwingen s | Drehen 90 % s | Winkel 2 s ° | Rollen ° | Kopf m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KESTREL | 25 | 24.00 | 3.10 | 22.2 | 1.87 | 11.61 | 1.65 | 0.40 | 138.9 | 0.30 | 0.005 |
| MARDER | 35 | 20.00 | 3.02 | 19.2 | 1.95 | 9.31 | 1.93 | 0.52 | 117.5 | 0.42 | 0.007 |
| BASTION | 50 | 16.00 | 3.22 | 17.6 | 2.23 | 6.51 | 2.27 | 0.67 | 78.3 | 0.60 | 0.009 |
| HALBERD | 60 | 13.50 | 3.20 | 15.4 | 2.32 | 5.30 | 2.45 | 0.77 | 64.4 | 0.72 | 0.012 |
| GOLIATH | 80 | 11.00 | 3.82 | 15.9 | 2.92 | 3.43 | 2.12 | 0.98 | 48.2 | 0.96 | 0.017 |
| KOLOSS | 100 | 8.50 | 4.03 | 13.6 | 3.22 | 2.39 | 2.30 | 1.18 | 36.6 | 1.20 | 0.021 |

**Nachher, Energie SCHILD** (WAFFE identisch):

| Walker | t | v max m/s | 0→90 % s | Bremsweg m | Bremszeit s | Nicken max ° | Nachschwingen s | Drehen 90 % s | Winkel 2 s ° | Rollen ° | Kopf m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KESTREL | 25 | 20.51 | 3.10 | 19.0 | 1.87 | 9.92 | 1.65 | 0.40 | 138.9 | 0.30 | 0.005 |
| MARDER | 35 | 17.09 | 3.00 | 16.4 | 1.95 | 7.96 | 1.92 | 0.52 | 117.5 | 0.42 | 0.007 |
| BASTION | 50 | 13.67 | 3.20 | 15.1 | 2.23 | 5.56 | 2.23 | 0.67 | 78.3 | 0.60 | 0.010 |
| HALBERD | 60 | 11.54 | 3.20 | 13.2 | 2.32 | 4.53 | 2.38 | 0.77 | 64.4 | 0.72 | 0.012 |
| GOLIATH | 80 | 9.40 | 3.82 | 13.6 | 2.92 | 2.93 | 2.08 | 0.98 | 48.2 | 0.96 | 0.017 |
| KOLOSS | 100 | 7.26 | 4.03 | 11.6 | 3.22 | 2.05 | 2.25 | 1.18 | 36.6 | 1.20 | 0.021 |

**Nachher, Energie ANTRIEB:**

| Walker | t | v max m/s | 0→90 % s | Bremsweg m | Bremszeit s | Nicken max ° | Nachschwingen s | Drehen 90 % s | Winkel 2 s ° | Rollen ° | Kopf m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KESTREL | 25 | 27.60 | 3.10 | 25.5 | 1.87 | 13.35 | 1.67 | 0.40 | 138.9 | 0.30 | 0.006 |
| MARDER | 35 | 23.00 | 3.02 | 22.1 | 1.95 | 10.71 | 1.95 | 0.52 | 117.5 | 0.42 | 0.007 |
| BASTION | 50 | 18.40 | 3.22 | 20.3 | 2.23 | 7.48 | 2.30 | 0.67 | 78.3 | 0.60 | 0.009 |
| HALBERD | 60 | 15.52 | 3.20 | 17.7 | 2.32 | 6.10 | 2.48 | 0.77 | 64.4 | 0.72 | 0.011 |
| GOLIATH | 80 | 12.65 | 3.82 | 18.3 | 2.92 | 3.94 | 2.13 | 0.98 | 48.2 | 0.96 | 0.017 |
| KOLOSS | 100 | 9.77 | 4.03 | 15.6 | 3.22 | 2.75 | 2.33 | 1.18 | 36.6 | 1.20 | 0.021 |

**Nachher, Gyro aus:**

| Walker | t | v max m/s | 0→90 % s | Bremsweg m | Bremszeit s | Nicken max ° | Nachschwingen s | Drehen 90 % s | Winkel 2 s ° | Rollen ° | Kopf m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KESTREL | 25 | 24.00 | 3.10 | 22.2 | 1.87 | 12.14 | 2.07 | 0.40 | 138.9 | 0.39 | 0.007 |
| MARDER | 35 | 20.00 | 3.02 | 19.2 | 1.95 | 9.74 | 2.42 | 0.52 | 117.5 | 0.55 | 0.008 |
| BASTION | 50 | 16.00 | 3.22 | 17.6 | 2.23 | 6.81 | 2.77 | 0.67 | 78.3 | 0.78 | 0.011 |
| HALBERD | 60 | 13.50 | 3.20 | 15.4 | 2.32 | 5.54 | 2.52 | 0.77 | 64.4 | 0.94 | 0.015 |
| GOLIATH | 80 | 11.00 | 3.82 | 15.9 | 2.92 | 3.58 | 2.82 | 0.98 | 48.2 | 1.25 | 0.021 |
| KOLOSS | 100 | 8.50 | 4.03 | 13.6 | 3.22 | 2.50 | 2.92 | 1.18 | 36.6 | 1.56 | 0.026 |

**Nachher, Beine SCHWER** (Tempofaktor 0,6 einmal):

| Walker | t | v max m/s | 0→90 % s | Bremsweg m | Bremszeit s | Nicken max ° | Nachschwingen s | Drehen 90 % s | Winkel 2 s ° | Rollen ° | Kopf m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KESTREL | 25 | 14.40 | 1.87 | 7.9 | 1.13 | 12.34 | 2.08 | 0.40 | 138.9 | 0.55 | 0.009 |
| MARDER | 35 | 12.00 | 1.82 | 6.9 | 1.17 | 9.89 | 2.43 | 0.52 | 117.5 | 0.78 | 0.013 |
| BASTION | 50 | 9.60 | 1.93 | 6.3 | 1.33 | 6.91 | 2.77 | 0.67 | 78.3 | 1.22 | 0.019 |
| HALBERD | 60 | 8.10 | 1.93 | 5.5 | 1.38 | 5.63 | 2.50 | 0.77 | 64.4 | 1.62 | 0.023 |
| GOLIATH | 80 | 6.60 | 2.30 | 5.7 | 1.75 | 3.64 | 2.80 | 0.98 | 48.2 | 2.04 | 0.031 |
| KOLOSS | 100 | 5.10 | 2.42 | 4.9 | 1.93 | 2.54 | 2.30 | 1.18 | 36.6 | 2.05 | 0.038 |

**Nachher, Beine SCHWER und Gyro aus:**

| Walker | t | v max m/s | 0→90 % s | Bremsweg m | Bremszeit s | Nicken max ° | Nachschwingen s | Drehen 90 % s | Winkel 2 s ° | Rollen ° | Kopf m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KESTREL | 25 | 14.40 | 1.87 | 7.9 | 1.13 | 12.70 | 2.48 | 0.40 | 138.9 | 0.60 | 0.010 |
| MARDER | 35 | 12.00 | 1.82 | 6.9 | 1.17 | 10.19 | 2.47 | 0.52 | 117.5 | 0.85 | 0.014 |
| BASTION | 50 | 9.60 | 1.93 | 6.3 | 1.33 | 7.12 | 2.88 | 0.67 | 78.3 | 1.34 | 0.022 |
| HALBERD | 60 | 8.10 | 1.93 | 5.5 | 1.38 | 5.80 | 3.10 | 0.77 | 64.4 | 1.81 | 0.026 |
| GOLIATH | 80 | 6.60 | 2.30 | 5.7 | 1.75 | 3.74 | 2.85 | 0.98 | 48.2 | 2.27 | 0.034 |
| KOLOSS | 100 | 5.10 | 2.42 | 4.9 | 1.93 | 2.62 | 3.07 | 1.18 | 36.6 | 2.25 | 0.043 |

**Rückstoß** (größte Waffe der Werksbewaffnung, Spitzenwert des Nickens nach einem Schuss im Stand):

| Walker | Waffe | Gyro ausgerichtet ° | Gyro aus ° |
|---|---|---|---|
| KESTREL | FALKE-4 (1,5 t, Rakete) | 0,06 | 0,11 |
| MARDER | AK-20 (4 t, ballistisch) | 0,06 | 0,10 |
| BASTION | AK-20 (4 t, ballistisch) | 0,05 | 0,08 |
| HALBERD | SPEER (6 t, Rakete) | 0,16 | 0,29 |
| GOLIATH | SR-3 (7 t, ballistisch) | 0,67 | 1,17 |
| KOLOSS | RK-30 (7 t, ballistisch, 18 Schuss/s) | 0,03 je Schuss | 0,06 je Schuss |

**Im Spiel** (Browser, Paradeplatz, Mittel aus Lauf über offenes Gelände; kleine Abweichungen
durch Bodenwellen):

| Walker | AUSGL m/s | SCHILD m/s | ANTRIEB m/s | Gyro aus m/s | Rückstoß größte Waffe |
|---|---|---|---|---|---|
| KESTREL | 24,24 | 20,71 | 27,85 | 24,24 | FALKE-4 0,11° (Salve) |
| MARDER | 20,19 | 17,26 | 23,24 | 20,19 | AK-20 0,09° |
| BASTION | 16,16 | 13,81 | 18,59 | 16,16 | AK-20 0,07° |
| HALBERD | 13,64 | 11,65 | 15,68 | 13,64 | SPEER 0,28° |
| GOLIATH | 11,11 | 9,50 | 12,78 | 11,11 | SR-3 1,10° |
| KOLOSS | 8,59 | 7,34 | 9,88 | 8,59 | RK-30 0,04° |

Die Grenzen im Spiel entsprechen exakt dem Zustand, z. B. GOLIATH mit SCHILD, Beinen SCHWER und
Gyro aus: Tempo 0,5127 (= 0,6 × 0,855), Beschleunigung 0,855, Stabilität 0,42, Hinken 0,40.

## 4. Testergebnisse (tatsächlich ausgeführt)

- `npm test`: **41 von 41 bestanden.** Darin die 26 bestehenden Tests unverändert und 15 neue in
  `tests/motion.test.mjs`:
  - Energie: Anteile ergeben 1; Antriebsfaktor in den Grenzen; `drivePower` ist das Produkt mit
    einmal angewendeter Energie (alle sechs Walker, vier Stellungen); gemessenes Höchsttempo
    entspricht `maxSpeed × Faktor`.
  - Kein Wiederbeleben: Reaktor zerstört, stationär oder Beinsperre mit ANTRIEB ergibt Antrieb 0,
    und die Bewegung bleibt bei 0.
  - Waffen- und Schildversorgung: Kondensatorladung je Stellung wie bisher; gleicher
    Schildanteil ergibt gleiche Regeneration; der Antriebsanteil berührt beide nicht.
  - Gyro: Stabilitätswerte; mehr Rollen, Kopfbewegung und Nachschwingen ohne Gyro, aber
    gleiches Tempo und höchstens doppeltes Rollen (alle sechs); ohne Strom bzw. ausgefallen = 0.
  - Streuung beim Gehen und Rückstoß (schwer gegen leicht, Dauerfeuer, Gyro, Abklingen).
  - Masse: Drehantwort und relatives Bremsen nach Tonnage geordnet, Federfrequenz.
  - Beine: Faktor 0,6 genau einmal, Hinken ab MITTEL, weniger Stabilität, mehr Unruhe (alle sechs).
  - KI unabhängig vom Spielerschalter und -gyro; Messungen deterministisch; Shift+C mit
    Drehträgheit (alle sechs).
- **Im Browser:**
  - Energie, Gyro und Rückstoß für alle sechs Walker; Grenzen = Zustand.
  - KI-Grenzen bleiben 1, auch wenn der Spieler SCHILD und Gyro aus wählt.
  - Automatikstart Shift+S: bereit nach 82 s Spielzeit, läuft 33 m, 13 Schüsse.
  - Raketen-Suite, Gefecht (Sieg), Wrack Beine, Menüablauf, Kaltstart (Gegner ruhen),
    Hinterhalt (KI patrouilliert und sucht): ohne Seitenfehler.
  - Steuerung 22/22 OK. Dafür wurde die Wartezeit im Shift+C-Test von 3 s auf 6 s Echtzeit
    verlängert, weil die Beine jetzt mit Masse andrehen (BASTION 1,3 s Spielzeit statt 0,6 s) und
    der Headless-Browser langsamer als Echtzeit simuliert. Mit 3 s schlug der Test fehl
    (Verdrehung 1,4° statt < 1,15°).

## 5. Bekannte Probleme

- **Shift+C dauert länger:** KOLOSS braucht etwa 2,3 s statt 1,2 s. Das ist gewollt, könnte sich
  aber träge anfühlen.
- **Raketen-Suite schwankt:** Die Trefferzahlen streuen von Lauf zu Lauf (Zufallsstreuung der
  Waffen, schon vorher so).
- **KI-Navigation:** Die Drehträgheit gilt auch für die KI. Gefecht, Hinterhalt und Patrouille
  laufen, eine feine Wegtreue der KI-Pfade habe ich nicht gemessen.
- **Rückstoß der RK-30:** Bei Dauerfeuer summieren sich die kleinen Stöße zu einem leichten
  Anheben des Torsos. Das ist beabsichtigt, die Höhe habe ich aber nicht gesondert gemessen.
- **Energieanzeige:** Sie zeigt den Antriebsanteil (0,5 bei ANTRIEB), nicht den daraus folgenden
  Faktor ×1,15.
- **Sound zum Hinken:** Hinken und Rückstoß haben keinen eigenen Sound; die vorhandenen Schritt-
  und Waffensounds laufen weiter.

## 6. Vorschläge für Phase 3

1. **KI-Zustand nutzen:** Die KI zieht sich bei SCHWER-Beinen zurück und meidet Gehen bei
   geringer Stabilität, um genauer zu treffen.
2. **Hitze und Antrieb:** Überlast mit ANTRIEB erzeugt etwas Kernwärme, damit die Stellung einen
   Preis hat.
3. **Gelände und Stabilität:** Hang und weicher Boden senken die Stabilität (Hinken, Rutschen am
   Steilhang).
4. **Hydraulikschaden:** Treffer in die Beine senken den Hydraulikdruck (Haltung, Stabilität)
   statt nur Struktur.
5. **Anzeige:** Antriebsfaktor und Gyrostabilität auf dem Systemmonitor, Hinweis bei Gyro aus.
6. **Rückstoß für KI und Waffenmodelle:** sichtbares Zurückzucken der Arme beim Schuss.
