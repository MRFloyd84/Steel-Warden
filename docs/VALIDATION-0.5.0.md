# STEEL WARDEN 0.5.0 – Phase 2.1: Bewegungsvalidierung und Balancing

Grundlage: Stand nach Phase 2 (`456e048`, `docs/MOTION-0.5.0.md`). Vorgehen: erst messen, dann
nur dort ändern, wo die Messung einen Bedarf zeigt. Kein neues Physiksystem, keine Umbauten.

Alle Werte stammen aus tatsächlich ausgeführten Läufen:

- **Node, headless, deterministisch:** echte `WalkerMotion`, `WalkerSystems`, `DamageModel`, 60 Hz,
  flacher harter Boden (`tests/motionMetrics.mjs`, `tests/validation.test.mjs`).
- **Browser (Puppeteer, `dist/index.html`):** KI-Kurse, Rückzug, Kampf, Startprozeduren und die
  Gegenprobe im Spiel. Die KI würfelt (`Math.random`). Deshalb gibt es für diese Werte
  Wiederholungsläufe, und sie streuen.

## Ergebnis in Kürze

| Punkt | Befund | Änderung |
|---|---|---|
| 1 Energie/Beschleunigung | Die Zeit bis 90 % änderte sich mit der Energie gar nicht, weil Tempo und Beschleunigung denselben Faktor hatten. | Eigener, stärkerer Beschleunigungsfaktor, milderer Tempofaktor. Bremsen ist jetzt unabhängig von der Energie. |
| 2 Wärme | Der Antrieb erzeugte keine Wärme. | Eigener Wärmekanal für tatsächlich genutzte Überleistung, höchstens 10 °C/s. |
| 3 KI und Drehträgheit | Kein Aufschaukeln, keine Festfahrer und kein schlechterer Rückzug durch die Drehträgheit. | Keine. Ein Festfahrer am Hangar ist ein alter Wegfindungsfehler und als offen dokumentiert. |
| 4 Rückstoß | Er war begrenzt und ging zurück, ließ den Torso bei Dauerfeuer aber um 0,28° (mit Gyro) bzw. 0,49° (ohne) angehoben. | Ein Stabilisator gleicht den mittleren Rückstoß bei Dauerfeuer aus. Einzelschüsse bleiben unverändert. |
| 5 Regression | 41 alte Tests, 9 neue und alle Browser-Suiten laufen grün. | Eine alte Prüfung (`driveAccel === driveEnergy`) ist bewusst angepasst. |

---

## 1. Energieverteilung und Beschleunigung

### Ursache

In Phase 2 skalierte derselbe Faktor (SCHILD/WAFFE ×0,855, ANTRIEB ×1,15) das Höchsttempo und die
Beschleunigung. Die Zeit bis 90 % des Höchsttempos ist v/a, der Faktor kürzt sich also heraus.
Absolut wirkte die Energie zwar (KESTREL bis 10 m/s: SCHILD 1,68 s, ANTRIEB 1,25 s), aber nur über
den gemeinsamen Faktor. Tastatur- und Achsenschub verhielten sich gleich, weil die Beschleunigung
begrenzt und nicht der Schubhebel.

### Vergleich (vor der Änderung gemessen, Achsenschub voll)

Werte: Zeit bis 90 % / bis 10 m/s, KOLOSS nur bis 90 %.

| Variante | KESTREL SCHILD | KESTREL ANTRIEB | BASTION SCHILD | BASTION ANTRIEB | KOLOSS SCHILD | KOLOSS ANTRIEB |
|---|---|---|---|---|---|---|
| A, Phase 2 (ein Faktor) | 3,10 / 1,68 | 3,10 / 1,25 | 3,20 / 2,62 | 3,22 / 1,93 | 4,03 | 4,03 |
| B, Beschleunigung = Faktor² | 3,62 / 1,97 | 2,68 / 1,08 | 3,75 / 3,05 | 2,78 / 1,68 | 4,72 | 3,52 |
| **C, Tempo mild, Beschleunigung stark** | 3,78 / 1,90 | 2,48 / 1,07 | 3,93 / 2,95 | 2,57 / 1,65 | 4,93 | 3,23 |

**Gewählt: C.** Spielerisch ist ANTRIEB damit vor allem Antritt: schneller aus der Deckung,
schneller wieder auf Tempo nach Kurven und Bremsungen. Es ist kein Dauerplus beim Höchsttempo. Ein
Höchsttempo von +15 % hätte den Abstand zwischen den Gewichtsklassen verwischt; +8 % lässt ihn
erkennbar. Technisch braucht es nur einen zweiten Faktor im bestehenden Datenpfad.

### Umsetzung

- `src/data/systems.js`:
  - `DRIVE_ENERGY`, Tempo: Empfindlichkeit 0,3, Grenzen 0,9 bis 1,08.
  - `DRIVE_ENERGY.accel`: Empfindlichkeit 1,0, Grenzen 0,75 bis 1,35.
  - Neue Funktion `driveAccelFactor(split)`; `driveEnergyFactor` bleibt der Tempofaktor.
  - Daraus ergibt sich: SCHILD/WAFFE Tempo ×0,927 und Beschleunigung ×0,758; ANTRIEB Tempo ×1,08 und
    Beschleunigung ×1,35; AUSGL bleibt ×1.
- `MachineCondition`: `driveAccel` kommt aus dem eigenen Faktor (0, wenn sich der Walker nicht
  bewegen kann). Die Debug-Zeile zeigt „Beschl. ×…“.
- `WalkerMotion`: **Bremsen hängt nicht mehr vom Energieanteil ab.** In Phase 2 bremste SCHILD
  schwächer (×0,855); mit ×0,758 wäre das deutlich spürbar und nicht plausibel geworden. Die
  Bremsrate ist jetzt `acceleration × brakeFactor`. Für KI-Einheiten ändert sich dadurch nichts,
  denn ihr Faktor ist 1. Nebenwirkung: Ein Walker, der sich nicht mehr bewegen darf (Faktor 0),
  bremst jetzt aus. Vorher behielt er rechnerisch seine Geschwindigkeit, bis andere Logik griff.

### Messung nachher (`node tests/motionMetrics.mjs SCHILD|AUSGL|ANTRIEB`)

| Walker | v max SCHILD / AUSGL / ANTRIEB m/s | 0→90 % SCHILD / AUSGL / ANTRIEB s | bis 8 m/s SCHILD / AUSGL / ANTRIEB s |
|---|---|---|---|
| KESTREL | 22,25 / 24,00 / 25,92 | 3,78 / 3,10 / 2,48 | 1,52 / 1,15 / 0,85 |
| MARDER | 18,55 / 20,00 / 21,60 | 3,68 / 3,02 / 2,40 | 1,77 / 1,35 / 1,00 |
| BASTION | 14,84 / 16,00 / 17,28 | 3,93 / 3,22 / 2,57 | 2,35 / 1,78 / 1,33 |
| HALBERD | 12,52 / 13,50 / 14,58 | 3,92 / 3,20 / 2,57 | 2,78 / 2,12 / 1,57 |
| GOLIATH | 10,20 / 11,00 / 11,88 | 4,67 / 3,82 / 3,05 | 4,07 / 3,08 / 2,28 |
| KOLOSS | 7,88 / 8,50 / 9,18 | 4,93 / 4,03 / 3,23 | – (7,88 < 8) / 4,22 / 3,13 |

Phase 2 zum Vergleich: SCHILD 0→90 % gleich wie AUSGL (KESTREL 3,10 s, KOLOSS 4,03 s), Höchsttempo
KESTREL SCHILD 20,51 m/s.

---

## 2. Wärmelast durch den Antrieb

### Befund

Es gab keine indirekte Antriebswärme. Die Reaktorwärme hängt nur von der Reaktorleistung ab, und
die ist unabhängig von der Stellung immer „voll“. `WalkerSystems` hatte zwei äußere Wärmekanäle:
Waffen (`pendingHeat`) und Boden (`externalRate`). Keiner davon sieht die Bewegung.

Gleichgewichtstemperatur bei zusätzlicher Wärmerate (vorher gemessen, Warnung bei 700 °C):

| zusätzlich | KESTREL | BASTION | KOLOSS |
|---|---|---|---|
| 0 °C/s (Stand) | 650 °C | 627 °C | 557 °C |
| +4 °C/s | 663 | 638 | 566 |
| +8 °C/s | 675 | 650 | 575 |

### Umsetzung: Wärme nur aus tatsächlich genutzter Überleistung

- `WalkerMotion.overloadOf` berechnet in jedem Schritt `driveOverload` (0..1) aus der
  tatsächlichen Bewegung:
  - **Tempoanteil:** Geschwindigkeit über dem Nenn-Höchsttempo für Boden und Steigung, bezogen auf
    den Überschuss `(speedFactor − 1)`. Das geht nur, wenn speedFactor > 1 ist, also mit ANTRIEB.
  - **Beschleunigungsanteil:** Beschleunigung beim Anfahren über der Nennbeschleunigung, bezogen
    auf `(accelFactor − 1)`.
  - Es zählt der größere der beiden Anteile.
- `WalkerSystems.setDriveOverload(o)` setzt einen **eigenen Kanal** `reactor.driveRate =
  driveOverloadHeat × o`. Der Wert `driveOverloadHeat` steht in `src/data/systems.js` → `reactor`
  und beträgt 10 °C/s.
- `reactor.js` addiert `driveRate × dt` genau einmal in der bestehenden Wärmebilanz. Waffenwärme
  (`pendingHeat`, `weaponHeatRate` für die Anzeige) und Bodenwärme bleiben getrennt.
- `SystemsLink.update` gibt im festen Schritt den Wert des vorigen Schritts (1/60 s alt) an die
  Systeme weiter. Das gilt nur für den Spieler; KI-Einheiten haben keine Reaktorsimulation.

Damit entsteht keine Wärme allein durch die Schalterstellung. Wer mit ANTRIEB steht oder unter
Nenntempo geht, erzeugt keine zusätzliche Wärme.

### Messung nachher (headless, 180 s, Reaktor nach `forceHot`)

| Walker | AUSGL Vollgas | ANTRIEB Stand | ANTRIEB halber Schub | ANTRIEB Vollgas | ANTRIEB Stop-and-go 4 s/4 s |
|---|---|---|---|---|---|
| KESTREL | 650 °C, Last 0 | 650 °C, Last 0 | 650 °C, Ø 0,01 | 681 °C, Last 1,0 | 675 °C, Ø 0,52 |
| BASTION | 627 °C | 627 °C | 627 °C | 655 °C | 650 °C |
| KOLOSS | 557 °C | 557 °C | 557 °C | 580 °C | 577 °C |

`pendingHeat` und `weaponHeatRate` blieben in allen Läufen bei 0.

Gegenprobe im Browser (`range`, heiß gestartet):

| Walker | Stand mit ANTRIEB | Vollgas mit ANTRIEB, 60 s | wieder AUSGL |
|---|---|---|---|
| KESTREL | 650 °C, driveRate 0 | 681 °C bei 25,7 m/s, Überlast 1,0 | 650 °C |
| KOLOSS | 557 °C, driveRate 0 | 580 °C bei 8,96 m/s | 557 °C |

Der Antrieb allein erreicht die Hitzewarnung nicht (höchstens ≈ 680 °C). Mit Waffenfeuer kommt
der Reaktor unter ANTRIEB früher an die Warnschwelle. Das ist der gewollte Preis für die
Überleistung.

---

## 3. KI-Navigation mit Drehträgheit

Browserkurse (`ainav.mjs`, Wahrnehmung des Spielers abgeschaltet, damit die Kurse ungestört
laufen). Jeder Walker fährt jeden Kurs mit Phase-2-Drehträgheit („Träge“) und ohne sie
(`turnLag = 0`).

- **A, enger Zickzack um vier Ecken.**
  - Die Trägheit kostet 0,6 bis 1,0 s (≈ +2 %).
  - Größte Querabweichung, träge / ohne: KESTREL 1,3 / 2,1 m, BASTION 3,7 / 4,8, GOLIATH 5,4 / 6,7,
    KOLOSS 6,2 / 7,4, MONOLITH 4,8 / 6,0.
  - Mit Trägheit ist die Abweichung also *kleiner*, weil der Regler weicher fährt.
  - Bei allen Walkern genau 4 Richtungswechsel (die vier Ecken), also kein Pendeln und kein
    Festfahren.
- **B, durch die Häuserreihen.** +0,1 bis 0,9 s, keine Kollisionen, keine Festfahrer.
- **C, Patrouille.** MARDER fährt sich bei (−83, −355) am hangarLong fest, **mit und ohne Trägheit**:
  in Wiederholungsläufen 5/7/3 Hänger mit Trägheit gegenüber 1/8/2 ohne. `checkStuck` löst ihn
  jedes Mal durch Zurücksetzen. → Das ist kein Trägheitsproblem, sondern ein Wegfindungsfehler aus
  der Zeit vor Phase 2 (siehe Offene Probleme).
- **D, Kampf.** Der Spieler kreist in 250 m Abstand. Keine Festfahrer, keine Kollisionen.
  Richtungswechsel 3 bis 9, mit und ohne Trägheit ähnlich; OBELISK steht als Artillerie (0).
- **E, Rückzug, 25 s.** Ein Einzellauf zeigte für MARDER nur −2 m mit Trägheit gegenüber 247 m
  ohne. Wiederholt mit je drei Läufen:

  | Walker | mit Trägheit | ohne |
  |---|---|---|
  | MARDER | 247 / 253 / 242 m | 268 / 243 / 101 m |
  | KOLOSS | 109 / 120 / 119 m | 126 / 127 / 125 m |

  Die Ausreißer kommen von der KI-Zufälligkeit, nicht von der Trägheit; insgesamt gedreht wurde in
  allen Läufen ähnlich (MARDER 185° bis 236°, KOLOSS 245° bis 263°). Der KOLOSS verliert mit
  Trägheit ≈ 10 m in 25 s, weil er langsamer eindreht. Das ist erwartet und klein.

**Keine Änderung an der KI.** Eine Vorhaltung im Regler (`drive()` mit vorhergesagtem Winkel)
wurde erwogen, aber die Daten zeigen keinen Bedarf. Die Änderungen aus 2.1 betreffen die KI nicht:
KI-Einheiten haben Energie und Beschleunigung ×1, keinen Rückstoß und keine Reaktorwärme. Die
Kursmessungen bleiben deshalb gültig.

---

## 4. Rückstoß bei Dauerfeuer

### Befund vor der Änderung

Gleiches Skript, Stabilisator abgeschaltet; 20 s Dauerfeuer im Stand, danach 5 s Pause.

| Walker | Waffe | Gyro | max ° | Mittel 15–20 s ° | min nach Feuerende ° | 5 s danach ° |
|---|---|---|---|---|---|---|
| KOLOSS | RK-30 18/s | an | 0,369 | 0,280 | −0,089 | −0,0009 |
| KOLOSS | RK-30 | aus | 0,677 | 0,493 | −0,186 | −0,0035 |
| BASTION | RK-30 | an | 0,360 | 0,276 | −0,087 | −0,0001 |
| BASTION | RK-30 | aus | 0,665 | 0,486 | −0,184 | −0,0004 |
| KESTREL | AK-20 10/s | an | 0,203 | 0,154 | −0,050 | 0,0000 |
| KESTREL | AK-20 | aus | 0,376 | 0,272 | −0,106 | 0,0000 |
| BASTION | SK-6 1/s | an | 0,180 | 0,059 | −0,050 | 0,0000 |
| GOLIATH | SR-3 0,25/s | an | 0,671 | 0,055 | −0,002 | 0,0000 |
| GOLIATH | SR-3 | aus | 1,242 | 0,096 | −0,009 | 0,0001 |

Der Rückstoß war begrenzt und kehrte zurück, schaukelte sich also nicht auf. Solange der Abzug
gehalten wurde, blieb der Torso aber um den mittleren Rückstoß angehoben, nämlich um
Impulsrate ÷ Federsteifigkeit. Unabhängig von der Masse waren das bei der RK-30 ≈ 0,28°. Genau
diese „langfristige Torsoposition“ schließt die Vorgabe aus.

### Umsetzung: Stabilisator gegen Dauerfeuer (`WalkerMotion.updateRecoil`)

- Jeder Schuss tritt den Torso wie bisher. Zählt er als Dauerfeuer, kommt sein Impuls zusätzlich
  in einen Tiefpass. Als Dauerfeuer gilt ein Schuss, der höchstens `recoilHoldGap` = 0,25 s nach dem
  vorigen fällt.
- Der Tiefpass steigt mit `recoilCompTime` = 1,0 s. Kommt 0,25 s lang kein Schuss, fällt er mit
  `recoilReleaseTime` = 0,1 s.
- Das Ziel der Nick- und Kopffeder verschiebt sich um `−Rate × Stabilisierung ÷ Steifigkeit`. Bei
  vollem Gyro (Stabilisierung 1) hebt das den mittleren Rückstoß auf; ohne Gyro (0,5) zur Hälfte.
- Die Stabilisierung ist `weaponStabilization` aus `MachineCondition`; `MissionCombat` gibt sie
  mit jedem Schuss mit.
- Einzelschüsse und langsame Waffen bleiben unverändert, weil der erste Schuss einer Folge nicht
  mitzählt. Die SR-3 tritt also weiter mit 0,67° bzw. 1,24°.
- Die Kennwerte stehen in `src/data/config.js` → `feel`.

### Messung nachher

| Walker | Waffe | Gyro | max ° | Mittel 15–20 s ° | min nach Feuerende ° | 5 s danach ° |
|---|---|---|---|---|---|---|
| KOLOSS | RK-30 | an | 0,247 | −0,011 | −0,158 | −0,0004 |
| KOLOSS | RK-30 | aus | 0,556 | 0,238 | −0,183 | −0,0022 |
| BASTION | RK-30 | an | 0,268 | −0,016 | −0,207 | 0,0000 |
| BASTION | RK-30 | aus | 0,575 | 0,231 | −0,239 | −0,0002 |
| KESTREL | AK-20 | an | 0,169 | −0,013 | −0,144 | 0,0000 |
| KESTREL | AK-20 | aus | 0,343 | 0,126 | −0,170 | 0,0000 |
| BASTION | SK-6 | an | 0,180 | 0,059 | −0,050 | 0,0000 |
| GOLIATH | SR-3 | an | 0,671 | 0,055 | −0,002 | 0,0000 |
| GOLIATH | SR-3 | aus | 1,242 | 0,096 | −0,009 | 0,0001 |

- Mit Gyro liegt der Mittelwert bei Dauerfeuer jetzt bei ≈ 0° statt 0,28°, und auch die
  Spitzen sinken (0,37° → 0,25°).
- Ohne Gyro bleibt der halbe Versatz. Das ist absichtlich, denn der Gyro soll einen Unterschied
  machen.
- Nach Feuerende schwingt der Torso einmal kurz bis −0,16° bis −0,21° nach unten (vorher −0,09°)
  und ist nach 5 s wieder neutral. Der Ausschlag liegt innerhalb des Zitterbands während des
  Feuerns.
- Ein Aufschaukeln gibt es nicht: Die Spitzen in den Sekunden 10–20 sind nicht größer als in 0–10.
- Gegenprobe im Browser: KESTREL feuert 8 s alle Waffen im Stand, Mittel 0,010°, max 0,091°, danach
  0,0000°.

---

## 5. Regression

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 50/50 bestanden: 41 bestehende und 9 neue in `tests/validation.test.mjs` |
| Angepasst | `motion.test.mjs`: Statt `driveAccel === driveEnergy` wird jetzt `driveAccel === driveAccelFactor(Stellung)` geprüft. Das ist die gewollte Änderung aus Punkt 1. Die Prüfung „Höchsttempo = maxSpeed × driveEnergyFactor“ gilt unverändert. |
| Automatischer Start (Node) | bestanden (KESTREL, BASTION, KOLOSS; deterministisch) |
| Handstart (Node, MARDER) | bestanden |
| Automatischer Start im Browser (`p05 --auto-only`) | bereit nach 82 s wie zuvor, 33 m gelaufen, 13 Schüsse, keine Fehler |
| Handstart und Zustand im Browser (`p05`) | keine Fehler; Debug-Zeile mit „Beschl. ×…“ |
| Energieverteilung, Gyro, Beinschaden | Node-Tests aus Phase 2 grün (Tempo je Stellung, Gyro aus, Hinken, Beine SCHWER) |
| Steuerung (`ctl`) | 22/22 OK, Shift+C eingeschlossen |
| Raketenlenkung (`suite`) | Trefferbilder identisch mit dem Stand vor 2.1 |
| Kampf (`a3fight`) | keine Fehler; Ablauf streut durch den KI-Zufall |
| Menüs (`menuflow`) | alle Schritte, keine Fehler |

Neue Tests:

- Energie wirkt stärker auf die Beschleunigung als auf das Tempo.
- 0→90 % folgt der Stellung bei allen sechs Walkern.
- Bremsen ist unabhängig von der Energie.
- Keine Wärme im Stand oder bei Nenntempo mit ANTRIEB.
- Wärme bei Überleistung, getrennt vom Waffenkanal.
- Wärme wird genau einmal gezählt (`driveRate × dt`).
- Dauerfeuer RK-30/AK-20: kein Aufschaukeln, kein Dauerversatz, Rückkehr zur Mitte.
- Ohne Gyro bleibt ein Teilversatz, der nach Feuerende ebenfalls verschwindet.
- Einzelschüsse treten weiterhin voll.

Nicht als Node-Test vorhanden: die KI-Kurse. Sie brauchen Welt, Navigationsgitter und Renderer und
laufen nur im Browser-Harness außerhalb des Repos. Ihre Ergebnisse stehen oben.

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/data/systems.js` | `DRIVE_ENERGY` (Tempo mild, `accel` stark), `driveAccelFactor`, `reactor.driveOverloadHeat` |
| `src/sim/MachineCondition.js` | `driveAccel` aus eigenem Faktor, Debug-Zeile |
| `src/sim/WalkerMotion.js` | Bremsen ohne Energieanteil, `driveOverload`/`overloadOf`, Stabilisator `updateRecoil`, `recoil(impulse, comp)` |
| `src/sim/WalkerSystems.js` | `setDriveOverload`, Zustand `reactor.driveRate` |
| `src/sim/systems/reactor.js` | `driveRate × dt` in der Wärmebilanz |
| `src/states/SystemsLink.js` | gibt `driveOverload` im festen Schritt an die Systeme |
| `src/states/combat/MissionCombat.js` | gibt die Waffenstabilisierung an `recoil` |
| `src/data/config.js` | `recoilCompTime`, `recoilHoldGap`, `recoilReleaseTime` |
| `tests/motion.test.mjs` | eine Prüfung angepasst (siehe oben) |
| `tests/validation.test.mjs` | neu, 9 Tests |

## Offene Probleme

1. **Patrouille am hangarLong (alt, nicht durch Phase 2).**
   - `NavGrid` sperrt eine Zelle mit einer Probe von `cell × 0,45` = 5,4 m Radius, ohne den
     Radius des Walkers (2,5 + 0,04·t).
   - `lineFree` hält deshalb die Linie dicht am Hangar für frei, und der MARDER schleift an der Ecke.
   - `checkStuck` löst das jedes Mal. Eine Korrektur (Walker-Radius in der Probe oder in
     `lineFree`) wirkt auf alle Karten und Wege und gehört in einen eigenen, gemessenen Schritt.
     Deshalb ist sie hier bewusst nicht gemacht.
2. **KI-Messungen streuen.** Die KI verwendet `Math.random`. Für belastbare Vergleiche braucht es
   Wiederholungsläufe oder einen Zufallsgenerator mit festem Startwert (für 0.5.x vorgeschlagen).
3. **Nachschwingen nach dem Feuern.** Mit Stabilisator schwingt der Torso nach Feuerende einmal
   kurz bis −0,2° nach unten. Das ist spielerisch unauffällig, ließe sich aber mit einem weicheren
   Abklingen glätten, falls es im Cockpit stört.
4. **Antriebswärme wird nicht eigens angezeigt.** Sie fließt in die Reaktortemperatur, die die
   bestehenden Anzeigen zeigen. Ein eigener Balken „Antrieb“ auf dem Energiemonitor wäre eine
   Oberflächenaufgabe für später.
5. **Wahrnehmung in Testmissionen.** Die KI ortet den Reaktor des Spielers in Testmissionen schon auf
   4,5 km. Für die Kurse wurde sie abgeschaltet. Das ist kein Bewegungsthema, ist aber vermerkt.
