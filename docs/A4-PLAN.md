# STEEL WARDEN – A4: Radar und Tarnung

Grundlage: ROADMAP A4 und der Abgleich mit EarthSiege 2. Leitidee: **Wer sendet, wird gesehen.**
Das Radar ist eine taktische Entscheidung, keine reine Anzeige.

## Bestand (geprüft)

- **Abstrahlung:** `unit.emitting` gilt heute für den Spieler, sobald SENSOREN an sind und der Bus
  Strom hat. Gegner nutzen den Wert über `ai.detectEmitting` (Ortung ohne Sicht), Anti-Radar-Raketen
  zielen auf strahlende Einheiten.
- **Signatur:** `player.signature` (kalt bis Reaktor) aus `data/systems.js`; Faktor auf die
  Sichtweite plus Ortung ohne Sicht.
- **Radaranzeige:** Sie zeigt alle Gegner im eingestellten Bereich (Drehknopf RADAR m,
  250–2000 m), dazu den Aufschaltkegel des Torsos, Navpunkte, das Einsatzgebiet und seit gestern
  die Flügelleute.
- **Aufschalten:** im Torsokegel (32°) mit Sichtlinie; aktive und halbaktive Raketen brauchen die
  volle Aufschaltung.
- **Tasten:** R (Radar aktiv/passiv) und Shift+R (Reichweite) sind belegt und melden „folgt mit
  dem neuen Radar“.
- **Verstärkungsruf:** Ein Späher (SPLITTER) ruft im Zustand `callHelp` über
  `AIDirector.callReinforcements` Verstärkung.

## Bausteine

### 1. Radarmodus des Spielers
- Neuer Kippschalter **RADAR AKTIV/PASSIV** (`radarMode`) im Cockpit, umschaltbar mit R.
  Shift+R schaltet den Bereichsknopf weiter.
- Ab Werk steht er auf **AKTIV**. Damit bleibt das bisherige Verhalten (SENSOREN an = strahlt)
  unverändert, und Passiv ist die neue Schleichoption.
- **Abstrahlung:** SENSOREN an und Bus mit Strom und Radar AKTIV, oder Störsender an.
- **AKTIV:** Das Radar zeigt jede Einheit im eingestellten Bereich, zu der eine freie Linie
  besteht. Gelände und Gebäude decken also; das ist Option C aus dem Abgleich, nötig, damit
  Hinterhalte hinter Hügeln und im Canyon möglich bleiben. Aktive und halbaktive Raketen können
  aufschalten.
- **PASSIV:**
  - Das Radar zeigt nur strahlende Einheiten, bis 2 000 m und ohne Sichtlinie (die Abstrahlung
    selbst verrät sie).
  - Dazu kommt ein **Gefahrenkreis**: die Entfernung, ab der dich die Gegner im Einsatz bemerken
    können. Das ist das Größte aus Signatur-Ortung, ihrer Sichtweite × Licht × Wetter × deiner
    Signatur und der Radarreichweite strahlender Gegner.
  - Aktive und halbaktive Raketen schalten nicht auf („RADAR PASSIV“); ungelenkt, Anti-Radar und
    optisch gehen weiter.
- **Datenlink in beiden Modi:** Was ein Flügelmann sieht oder ortet, steht auch auf deinem Radar
  (gesehen in den letzten 3 s).
- Die Kontakte werden viermal pro Sekunde neu bestimmt, damit nicht jedes Bild Sichtlinien rechnen
  muss.

### 2. Radar der KI
- Neue KI-Werte `radar` (Reichweite, wenn die Einheit strahlt) und `emits` (strahlt ab Start).
  - **Gegner:** Nur der Späher SPLITTER strahlt ab Werk (1 600 m), die anderen haben 1 200 m,
    wenn eine Mission sie strahlen lässt.
  - **Flügelleute:** strahlen erst auf Befehl.
- `Perception.look` bekommt die Radarreichweite des Beobachters: Ein strahlender Beobachter ortet
  alles im Bereich mit freier Linie (`located`, also Position bekannt, aber keine Sicht zum
  direkten Feuern).
- Einheiten, deren Mission sie ausdrücklich strahlen lässt, behalten das wie bisher.

### 3. Störsender (Ausrüstung)
- **Ausrüstung ST-2 STÖRSENDER:** Größe S, universal, 1,5 t, wie die Zielkapsel in der Bewaffnung
  wählbar. Ein- und ausschalten mit J. Im Betrieb zieht er 4 Energie/s aus dem Waffenkondensator
  und ist ausgefallen, wenn sein Hardpoint ausfällt.
- **Wirkung im Betrieb:**
  - **Gegnerische Aufschaltung:** dauert dreimal so lange.
  - **Gegnerische aktive und halbaktive Raketen** verlieren über 200 m Abstand ihr Ziel. Das gilt
    je Rakete mit 60 % Chance, festgelegt aus ihrer Seriennummer und damit reproduzierbar.
  - **Verstärkungsruf:** Ein Späher in 900 m Umkreis kann nicht rufen, die Leitstelle meldet
    einmal „Synthese-Funk gestört“.
  - **Nachteil:** Der Sender strahlt. Gegner in 700 m Umkreis wissen, wo du bist, und
    Anti-Radar-Raketen finden dich.

### 4. Bereitschaftslicht je Waffe
Auf der Waffenseite bekommt jede Waffe eine Lampe. Sie ist grün, wenn diese Waffe das gewählte
Ziel jetzt treffen kann:
- geladen und nicht ausgefallen
- Waffen scharf
- Ziel im Torsokegel mit freier Linie
- Entfernung höchstens Waffenreichweite
- bei aktiver oder halbaktiver Lenkung aufgeschaltet

Ohne Ziel ist die Lampe aus.

### 5. Funkbefehle 8 und 9
- **Feuer einstellen / Feuer frei** (Shift+8): ein Umschalter. Die Flügelleute halten das Feuer,
  bewegen sich aber weiter nach Befehl. Sie schießen trotzdem zurück, wenn sie selbst getroffen
  werden.
- **Funkstille / Radar an** (Shift+9): ein Umschalter. Ab Werk herrscht Funkstille, also kein
  Radar. Mit Radar orten die Flügelleute 1 200 m mit freier Linie und füttern so den Datenlink,
  strahlen dafür aber und werden geortet.
- Das Funkmenü zeigt beide Zustände.

### Mission
- Briefing des Hinterhalts: Statt „SENSOREN aus“ steht dort jetzt „Radar auf PASSIV oder SENSOREN
  aus“. Der SPLITTER strahlt jetzt; mit passivem Radar siehst du ihn kommen.

## Prüfung
- **Node-Tests:**
  - Abstrahlungsregel
  - Kontaktliste aktiv/passiv mit Sichtlinie und Bereich
  - Datenlink
  - Gefahrenkreis
  - Raketen-Sperre im Passivbetrieb
  - KI-Radarortung mit Deckung
  - Störsender: Aufschaltung, Raketenverlust reproduzierbar, Verstärkungsruf, Ortung im Umkreis,
    Energie
  - Bereitschaftslicht
  - Funkbefehle 8 und 9
- **Browser:**
  - Hinterhalt mit passivem Radar
  - Schalter im Cockpit (Klicktest)
  - Radarbild aktiv/passiv
  - Störsender gegen eine SICHEL mit Raketen
- **Regression:** alle bisherigen Tests und die Browser-Suiten.

## Ergebnis (Nov 2026)

Umgesetzt wie geplant. Neu ist `src/sim/Radar.js` (reine Funktionen für Abstrahlung, Kontakte,
Datenlink, Gefahrenkreis und Raketenverlust durch den Störsender).

**Node-Tests:** 82/82, davon 11 neu in `tests/radar.test.mjs` und 2 neu in
`tests/wingmen.test.mjs` (Feuer einstellen mit Rückfeuer, Funkstille/Radar).

**Browser (Hinterhalt `test-ambush`):**
- Radar aktiv mit 2 000 m: keine Kontakte, die Canyonwände decken.
- Radar passiv: der strahlende SPLITTER erscheint, Gefahrenkreis 1 600 m, Datenlink-Kontakt eines
  Flügelmanns sichtbar.
- Störsender: gegnerische Aufschaltung 0,33/s statt 1/s (etwa 7,5 s statt 2,5 s), Verbrauch
  4 Energie/s (gemessen über das Nachladen), Verstärkungsruf des Spähers blockiert mit Funkspruch,
  ohne Störsender geht er durch.
- Bereitschaftslicht: ungelenkt alle grün; passiv mit AKTIV-Lenkung bleibt HABICHT aus
  („RADAR PASSIV“); Ziel auf 1 300 m: alle aus; Anti-Radar nur gegen strahlende Ziele.
- Klicktest: RADAR-Schalter in beiden Cockpits (Modell und klassisch) anklickbar.
- Regression: Steuerung, Raketen-Suite, Menüfluss, A3-Gefecht, P05 (Auto und heiß) unverändert.

**Offen und bewusst so gelassen:**
- Die Reaktorsignatur ortet weiter bis 1 100 m, auch mit passivem Radar. Wer schleichen will,
  muss zusätzlich den Reaktor herunterfahren.
- Den Störsender gibt es nur für KESTREL und BASTION (einziger Ausrüstungsplatz); für andere
  Walker erst mit der Bewaffnungsseite im Hangar (C).
- Im klassischen KESTREL-Cockpit verdeckt die Kanzel zwei Statuslampen (Reaktor, Kühlung). Das
  bestand schon vor A4; die Lampen sind nur Anzeigen.
