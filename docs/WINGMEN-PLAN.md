# STEEL WARDEN – Flügelleute (Phase B5, vorgezogen)

Wunsch (Rene): mit einem Team rausgehen. Entscheidungen:

| Frage | Entscheidung |
|---|---|
| Aufstellung | in der Einsatzvorbereitung, bis zu 3 Flügelleute, Walker je Platz frei wählbar; die Mission begrenzt die Plätze (0–3) |
| Befehle | alle 7 aus dem Fahrplan, über das Funkmenü (F) und eigene Tasten |
| Piloten | benannt, mit Rufzeichen, Funksprüchen und Moral im Einsatz; Erfahrung, Verwundung und Tod speichert erst die Kampagne (C) |
| Eigenbeschuss | ja, die Schüsse des Spielers treffen die eigenen Flügelleute, die sich dann über Funk melden |

## Bestand (geprüft)

- **KI kennt Seiten.** `AIDirector.hostilesOf(u)` liefert alle Einheiten der anderen Seite,
  `unitsOfSide` hält Walker einer Seite auseinander, `Perception.look` arbeitet für jedes Ziel.
  Gegner nehmen damit auch Flügelleute wahr und greifen sie an.
- **Die Seite steht fest.** `CombatUnits.prep` setzt `u.side` hart auf `player` (Spieler) oder
  `enemy` (alle anderen).
- **Kein Eigenbeschuss.** Geschosse (`Projectiles.collide`), Strahlen (`beamFrom`) und
  Splitterwirkung (`splash`) überspringen die eigene Seite.
- **Gegnerlisten.** Aufschalten (`Targeting.candidates`), Radarkontakte (`units.enemies`),
  Abschusszähler (`setWreck`) und die Abschussliste behandeln jede Nicht-Spieler-Einheit als Gegner.
- **Funkmenü (F) mit den 7 Befehlen** gibt es schon. Es antwortet „keine Flügelleute“.
- **Aufträge** (`MissionScript`, Schritt `destroy: 'all'`) zählen `director.controllers`.

## Aufbau

### Daten
- `src/data/pilots.js`:
  - drei Piloten mit Namen, Rufzeichen, Aggression und Moral
  - Funknamen ZWEI, DREI, VIER (der Spieler ist EINS)
  - Funksprüche
- Mission: `wingmen: 0..3`. Ohne Angabe gilt 3. Das Duell (`test-duel`) hat 0 Plätze.
- Einsatzvorbereitung: ein Abschnitt „Team“ mit einer Zeile je Platz. Jede Zeile wechselt durch
  „—“ und die sechs Walker. Die Auswahl wird gespeichert, vorbelegt ist allein (alles „—“).
- Missionsparameter `wingmen: [walkerId|null, …]`. Für Tests gibt es die URL `?wingmen=marder,bastion`.

### Seiten und Eigenbeschuss
- `MissionEntities.addUnit({ side })` → `CombatUnits.prep` übernimmt die Seite.
- `units.enemies` liefert nur noch Seite `enemy`, `units.allies` die Flügelleute.
- Eine Regel an einer Stelle, `canHit(owner, unit)` (`src/sim/friendlyFire.js`):
  - Die eigene Einheit wird nie getroffen.
  - Verschiedene Seiten treffen sich immer.
  - Auf derselben Seite trifft nur der Spieler, also seine Schüsse die Flügelleute.
  - Gegner untereinander und Flügelleute untereinander oder gegen den Spieler treffen sich
    weiterhin nicht. Flügelleute schießen außerdem nicht, wenn ein Freund in der Schusslinie steht.
- Die Regel gilt für Geschosse, Strahlen und Splitter. `hitUnit` merkt sich den Schützen
  (`unit.lastHitBy`); trifft der Spieler einen Flügelmann, folgt das Ereignis
  `combat:friendlyFire` und darauf ein Funkspruch (höchstens alle 6 s je Pilot).
- Aufschalten, Radar-Gegnerliste und Abschüsse betreffen nur die Seite `enemy`. Abschüsse werden
  dem Schützen gutgeschrieben (`lastHitBy`).

### Flügelleute in der KI
- `src/ai/WingmanController.js` erbt von `AIController`. Wahrnehmung, Zielen, Feuern, Fahren,
  Wegfindung und Ausweichen bleiben unverändert; neu ist nur `think()` mit dem Befehlsmodus.
- `src/ai/Flight.js` verwaltet das Team:
  - setzt die Flügelleute beim Start auf begehbare Plätze neben bzw. hinter den Spieler
  - gibt Befehle aus und quittiert sie
  - teilt Kontakte im Team (wie das Synthese-Netz)
  - führt Moral und Funkmeldungen
  - liefert den Status für Funkmenü, Radar und Nachbesprechung
- `AIDirector` stellt den Flügelleuten Navigationsgitter, Sicht und Wegesuche bereit und ruft sie
  im festen Schritt auf. Sie stehen nicht in `controllers`, damit Aufträge, Verstärkung,
  Artillerie-Netz und Debug-Zählung der Gegner unverändert bleiben.
- `spot()` meldet nur noch Einheiten der Gegenseite an die Artillerie. Bisher gab es nur eine
  Seite mit KI, mit Flügelleuten würde die gegnerische Artillerie sonst eigene Einheiten als Ziel
  bekommen.

Befehle (gelten für alle Flügelleute):

| Befehl | Taste | Verhalten |
|---|---|---|
| Formation | Shift+1 | Keil hinter dem Spieler, Gegner bis 450 m um den Spieler werden bekämpft, Leine 500 m |
| Mein Ziel angreifen | Shift+2 | Das aufgeschaltete Ziel (oder das unter dem Fadenkreuz) angreifen bis es ausfällt, dann Formation; ohne Ziel: Rückfrage |
| Freies Feuer | Shift+3 | Normale Jäger-KI: Gegner suchen und bekämpfen, Leine 1 500 m um den Spieler |
| Navpunkt anlaufen | Shift+4 | Zum aktiven Navpunkt, dort halten, Gegner im Umkreis von 400 m bekämpfen |
| Stellung halten | Shift+5 | Am jetzigen Ort bleiben, Gegner von dort bekämpfen (Leine 120 m) |
| Zurückfallen / zu mir | Shift+6 | Gefecht abbrechen, mit voller Fahrt zum Spieler, danach Formation |
| Beine zielen | Shift+7 | Umschalter: auf die Beine des Ziels zielen statt auf den Torso |

Vor dem Ausrücken warten die Flügelleute am Startplatz. Beim Alarmstart (scramble) verteidigen
sie von dort aus.

Moral: Der Startwert kommt vom Piloten.
- Sie sinkt bei schweren Treffern, beim Ausfall eines Kameraden und durch Eigenbeschuss.
- Sie steigt bei Abschüssen und langsam in ruhigen Phasen.
- Unter 0,25 fällt der Pilot zum Spieler zurück und lehnt „Mein Ziel angreifen“ ab, bis sie sich
  erholt.

Ein Flügelmann ohne Beine kämpft vom Platz aus weiter. Fällt sein Reaktor aus, ist er verloren.
Der Einsatz scheitert weiterhin nur am Walker des Spielers.

### Anzeigen
- Funkmenü: Liste der Flügelleute mit Walker, Zustand und Befehl, dazu der aktive Befehl und
  „Beine zielen“.
- Radar: Flügelleute als hohler Kreis mit ihrer Nummer.
- HUD: kleine Marke mit Nummer und Rufzeichen über jedem Flügelmann im Blickfeld. Steht ein
  Flügelmann unter dem Fadenkreuz, wird das Fadenkreuz grün („FREUND“).
- Nachbesprechung: Abschnitt „Team“ mit Pilot, Walker, Zustand, Abschüssen und Eigenbeschuss;
  die Abschüsse des Spielers getrennt von denen des Teams.

## Prüfung (ausgeführt)

### Node-Tests
`npm test` ergibt 69/69 bestanden. Neu ist `tests/wingmen.test.mjs` mit 16 Tests.

- **Prüfaufbau:** Bewegung, Waffen, Schaden sowie `Flight`, `WingmanController` und
  `AIController` sind echt. Welt und Director sind schlanke Platzhalter (flach, offen,
  Sicht 900 m).
- **Regeln:** `canHit`, Plätze je Mission, Aufschalt-Liste ohne Flügelleute.
- **Team:** Funknamen, Seite, Warten bis zum Ausrücken, dann Formation.
- **Formation:** 40 s Marsch, jeder Flügelmann bleibt unter 30 m von seinem Platz.
- **Stellung halten:** unter 15 m Drift, während der Spieler 250 m weggeht. Danach bringt
  „Formation“ das Team wieder zurück.
- **Navpunkt, Zurückfallen, Rückfrage:** Navpunkt anlaufen, Zurückfallen, Rückfrage ohne
  aktiven Navpunkt.
- **Mein Ziel angreifen:** Rückfrage ohne Ziel. Mit Ziel nähert sich das Team an und feuert;
  ist das Ziel ausgeschaltet, geht es zurück in Formation.
- **Leine und freies Feuer:** In Formation bleibt das Team an der Leine, bei freiem Feuer jagt es.
- **Beine zielen:** an und aus.
- **Schusslinie:** Steht ein Freund darin, sperrt sie das Feuer.
- **Moral:** Zusammenbruch, Rückzug, Ablehnung und Erholung.
- **Funk bei Verlusten:** Bei Verlust nur der Beine kommt „Beine weg“, bei einem Reaktortreffer nur
  „ausgefallen“.
- **Eigenbeschuss-Funk:** höchstens einmal alle 6 s.
- **Abschuss-Gutschrift:** Spieler, Team, unbekannt, verlorener Flügelmann.
- **Ohne Flügelleute:** keine Änderung.

### Browser (Puppeteer, `dist/index.html`)

Jeder Befehl wurde einzeln mit drei Flügelleuten (MARDER, BASTION, GOLIATH) auf `test-synth`
geprüft. Die Gegner wurden dafür mit `spawnGroup` gesetzt.

| Lauf | Ergebnis |
|---|---|
| Formation, 40 s Marsch | Platzabstand 14–17 m |
| Formation, zwei SPLITTER 420 m voraus | Das Team feuert aus der Leine, höchstens 91 m vom Spieler entfernt |
| Mein Ziel angreifen, SICHEL 790 m | Ziel nach 57 s ausgeschaltet; „Ziel ausgeschaltet. Zurück in Formation.“ |
| Ohne Ziel | „Negativ, kein Ziel markiert.“ |
| Stellung halten, Spieler geht 320 m | Drift 0 m; nach „Formation“ 13–14 m vom Platz |
| Navpunkt ALPHA | Alle drei stehen in „Stellung“ 56–71 m um den Punkt |
| Zurückfallen aus 320–352 m | Nach 25 s alle unter 100 m, danach Formation |
| Freies Feuer, SPLITTER 650 m | Gejagt und ausgeschaltet (ZWEI: Abschuss) |
| Beine zielen gegen MONOLITH | Beine 73 %, Torso 96 % |
| Eigenbeschuss: der Spieler feuert 4 s auf ZWEI | Schaden, `lastHitBy` = Spieler, Funkwarnung, Moral sinkt |
| Spieler in der Schusslinie von DREI | DREI hält das Feuer („FREUND“) |
| Verlust von DREI | „DREI (FUNKE) ist ausgefallen!“, Moral der anderen −0,15 |
| Ganzer Einsatz `test-ambush` | Team am KNICK, Spieler betritt die Schlucht, die Patrouille kommt. Das Team schaltet sie aus (ZWEI 2 Abschüsse), Auftrag erfüllt, Nachbesprechung mit Teamtabelle |
| Einsatzvorbereitung über das Menü | Drei Plätze gewählt; der Einsatz startet mit ZWEI MARDER, DREI BASTION und VIER KOLOSS im Zustand „wartet“ |
| Duell | Abschnitt Team: „Dieser Einsatz ist allein zu fliegen.“ |
| Hangarstart (`test-industrial`) | Das Team wartet vor dem Hangar, begehbar, und folgt nach dem Ausrücken |
| Alarmstart (`test-scramble`, kalt) | Das Team wartet am Hangar und kämpft aus der Stellung |

Screenshots wurden geprüft: Einsatzvorbereitung, HUD-Marken (Ring + Funkname), Radar,
Funkmenü mit Teamstatus und Nachbesprechung.

### Regression
- Node-Tests: 69/69 bestanden.
- `tools/check_credits.mjs`: grün.
- `tools/gen-controls.mjs`: 77 Aktionen, davon 7 neu.
- Browser-Suiten:

  | Suite | Ergebnis |
  |---|---|
  | Steuerung (`ctl`, Cockpit klassisch) | 22/22 |
  | Raketenlenkung (`suite`) | Trefferbilder wie zuvor |
  | Menüs (`menuflow`) | ohne Fehler |
  | Solo-Gefecht (`a3fight`) | ohne Fehler |
  | Automatischer Start (`p05 --auto-only`) | bereit nach 83 s |
  | Handstart (`p05`) | ohne Fehler |

### Beim Prüfen gefunden und behoben
1. **Debug-Schalter „Gegner einfrieren“:** Er hielt in `drive()` auch die Flügelleute an. Jetzt
   wirkt er nur noch auf die Gegnerseite.
2. **Abschuss doppelt gezählt:** Erst fallen die Beine, dann der Reaktor, und beide Male wurde
   gezählt. `combat:wreck` trägt jetzt `first`; gutgeschrieben wird nur beim ersten Mal.
3. **Widersprüchlicher Funk:** Bei einem Reaktortreffer kam erst „Beine weg … feuere weiter“, dann
   „ausgefallen“. Die Meldung zu den Beinen wartet jetzt 0,5 s und entfällt bei Ausfall.
4. **Freies Feuer ohne Kontakt:** Die Jäger-KI kannte die eigenen Zustände des Flügelmanns nicht
   und pendelte zwischen Suchen, Ruhe und Formation. Ohne Kontakt bleibt das Team jetzt direkt in
   Formation.
5. **Schwere Walker in Formation:** Sie hingen bis zu 35 m zurück. Jetzt nehmen sie das Tempo des
   Spielers mit (Anteil am eigenen Höchsttempo plus Aufholen).
6. **Sichtweite:** Die Kampfdistanz bleibt jetzt unter 80 % der aktuellen Sicht, und auf ein
   befohlenes, noch unsichtbares Ziel läuft der Flügelmann zu, bis er es sieht.
7. **Hangarstart:** Ein Keilplatz auf nicht begehbarem Gelände wird auf den nächsten begehbaren
   Punkt verschoben.

## Offen
- **Keine Erinnerung zwischen Einsätzen.** Erfahrung, Verwundung und Tod über Einsätze hinweg kommen
  mit der Kampagne (C). Jeder Einsatz beginnt mit vollen Walkern und der Startmoral.
- **Befehle gelten für alle.** Befehle an einzelne Flügelleute gibt es nicht (der Fahrplan sieht
  keine Taktikkarte vor).
- **Kein Eigenbeschuss durch Flügelleute.** Ihre Schüsse treffen den Spieler nicht, und sie halten
  zusätzlich die Schusslinie frei. So ist es entschieden; es lässt sich in `canHit` ändern.
- **Freies Feuer ohne Kontakt sucht nicht von selbst.** Ohne Kontakt bleibt das Team beim Spieler.
  Für Hinterhalte eignen sich „Navpunkt anlaufen“ oder „Stellung halten“.
- **Schwierigkeit.** Mit drei Flügelleuten werden Einsätze deutlich leichter; die
  Schwierigkeitsstufe skaliert weiter nur die Gegner. Ein Ausgleich (mehr Gegner je Flügelmann)
  wäre eine Missionsfrage für Phase B.
- **KOLOSS im Canyon.** Er braucht für 700 m Marsch etwa 2 Minuten. Das ist kein Fehler, sondern
  Masse und weicher Grund.
- **Unbestätigte Zustandsanzeige.** In einem Testlauf zeigte das Team kurz nach dem Start den
  Zustand „Ruhe“ statt „Formation“. Das ließ sich in drei weiteren Läufen nicht nachstellen.
