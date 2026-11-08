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
- `?debug` – Debug-Modus an (Overlay und Debug-Tasten)
- `?weather=sandstorm` – Wetter erzwingen (`clear`, `snowstorm`, `sandstorm`, `ashfall`, `groundFog`, `rain`)
- `?difficulty=elite` – Schwierigkeit erzwingen (`beginner`, `green`, `normal`, `veteran`, `elite`);
  sonst gilt die Wahl im Hauptmenü
- `?start=hot` – ohne Startprozedur, `?walker=goliath` – Walker wählen

## Stand

- **Ausbaustufe 1 (Grundgerüst):** Game-Loop mit festem Simulationstakt, Zustandsmaschine
  Menü → Einsatz → Nachbesprechung, gestreamtes Low-Poly-Terrain mit LOD, vier Schauplätze,
  Tageszeiten, Eingabeschicht (Tastatur, Maus, Gamepad), Debug-Overlay.
- **Erweiterung Schritt 1 (Cockpit-Grundmodell):** begehbares 3D-Cockpit (Variante `standard`)
  als eigener Render-Pass, freies Umsehen, Schubhebel und Seitenknüppel als bewegte 3D-Objekte,
  5 CRT-Monitore mit Nachleuchten, alle Schalter der Startprozedur als 3D-Modelle aus Daten,
  Schubhebel mit Nullraste, Beine/Torso getrennt, Schrittwippen, Bremsnicken.
- **Erweiterung Schritt 2 (Interaktion + Audio):** Cockpit-Cursor im freien Blick (Rand dreht
  den Kopf), alle Schalter, Kappen, Drehregler, Taster und Lampen bedienbar, Schubhebel ziehbar.
  Schalterzustände als Simulationszustand (`sim/CockpitControls.js`). Hybride Audio-Engine:
  eingebettete Samples plus prozedurale Klicks; Schritte, Servo, Reaktor, Lüftung, Knarzen.

- **Erweiterung Schritt 3 (Startprozedur):** Der Walker startet kalt. `sim/WalkerSystems.js`
  simuliert Batterie, Hilfsaggregat, Hauptbus, Kühlpumpen, Reaktor (Vorheizen, Zündung,
  Leerlauf/Vollast, Wärmebilanz, Notabschaltung mit Sperre), Hydraulik, Monitore, Gyro,
  Sensoren, Schilde, Waffen und Beinsperre mit stetigen Werten. Falsche Reihenfolge hat
  physikalische Folgen statt Sperren. Checkliste auf einem 3D-Klemmbrett, Startmodi
  voll/einfach/auto, Neustart nach Notabschaltung, Funkmeldungen, Maschinengeräusche.

- **Erweiterung Schritt 4 (Walker-Builder):** 6 Walker (KESTREL, MARDER, BASTION, HALBERD,
  GOLIATH, KOLOSS) als prozedurale Low-Poly-Modelle aus Bauplänen (`data/walkerModels.js`),
  Laufanimation mit Fuß-IK auf dem Gelände, Trefferzonen je Komponente, Hardpoint-Sockel.
  Cockpit-Varianten compact/standard/heavy, Energiemonitor, zweiter Reaktorkreis (KOLOSS),
  Startdauer je Klasse, Außenkamera, Walker-Wahl im Menü, Testmission „Paradeplatz".

- **Phase A2a (Waffen und Schaden):** 10 Waffen mit Werks-Bewaffnung je Walker (geprüft beim
  Start), Waffenmodelle an den Hardpoints, Geschosse, Strahl, Raketen, Streuung, Munition,
  Nachladen, Energiepuffer aus dem Reaktor, Waffenhitze in der Reaktor-Wärmebilanz (Überhitzung
  → Notabschaltung → Neustart). Schadenspipeline Seite → Schild → Panzerung → Struktur mit
  5 Stufen und Folgen (Arm ab, Beine, Sensoren, Reaktorexplosion), Feuerketten, Zielaufschaltung,
  Zielmonitor mit Drahtgitter, Effekte und Kampfsounds. Testmission „Schießstand“.

- **Phase A2b (Lenkraketen, Raketenkamera, Zielkapsel, Treffer im Cockpit):** Raketen mit
  eigenem Flugmodell (Schub, Brenndauer, Wendigkeit in °/s, danach ballistisch, Rauchband) und
  fünf Lenkarten (ungelenkt, aktiv, halbaktiv, Anti-Radar, optisch), Wahl am Drehschalter
  LENKUNG. Raketenkamera als zweiter Render-Pass (160×120, grün, Rauschen) auf dem Zielmonitor;
  optische Raketen werden mit der Maus gelenkt. Zielkapsel als Ausrüstung: Komponente am Ziel
  wählen, Geschosse laufen dort zusammen, Lenkraketen suchen sie. Zielnachführung des Torsos.
  Treffer im Cockpit: Schildleuchten von der Trefferseite, Kamerastoß, Funken, Monitorflackern,
  Risse in der Scheibe, Rauch, Monitorausfall mit Selbsttest-Meldung, kritischer Schaden mit
  Notlicht und Hupe. Warnung bei feindlicher Aufschaltung und anfliegender Rakete.

- **Teil 2 (Karten-Erweiterung):** Gelände-Features je Schauplatz (Kämme, Senken, Schluchten,
  Gletscherspalten, Plateaus mit Aufgang, Tafelberge, Krater, Flüsse/Kanäle mit Deichen,
  Lavaflüsse, Eisseen, Straßenraster, leuchtende Adern), Bodenarten hart / weich / Wasser /
  Lava / dünnes Eis / heiß mit Wirkung auf Tempo, Reaktor, Beine und Schrittklang, Wasser- und
  Lavaflächen. 19 Bauwerke und 5 Sites (Stützpunkt, Raffinerie, Synthese-Nest, Landeplatz,
  Felsbogen) mit Kollision, Trefferzonen, Zerstörung (intakt → beschädigt → Trümmer) und
  Sichtlinien-Blockade; Streuobjekte per Instancing. Drei neue Schauplätze (Flussdelta Morrow,
  Canyonwüste Tessar, Synthese-Kernwelt), Wetter (klar, Schneesturm, Sandsturm, Ascheregen,
  Bodennebel, Regen) mit Partikeln und Belag auf der Scheibe, Einsatzgebiet mit Zaun und
  Radarlinie. Acht Testmissionen.

- **Steuerung aufgeräumt:** zentrales Aktionsregister mit Kontexten (Kampf, freier Blick,
  Raketenkamera, Außenkamera, Menü, Debug), Shift-Kombinationen mit Vorrang, Debug-Tasten nur im
  Debug-Modus, keine Browser-Kollisionen, Funkmenü, Tastenhilfe je Kontext mit echter
  Tastaturbeschriftung, Belegungsoberfläche mit Gamepad/HOTAS-Profilen, README-Tabellen
  werden aus dem Register erzeugt.

- **Phase A3 (Synthese-Gegner und KI):** vier Synthese-Walker (Späher SPLITTER, Jäger SICHEL,
  Brecher MONOLITH, Belagerer OBELISK) in kantig-kristalliner Formensprache mit schwebenden
  Panzersegmenten, Leuchtadern und ruckartigem Insektengang, eigene Waffen (Splitterwerfer,
  Impulsprisma, Kristalllanze, Kristallhammer, Schwarmraketen, Schwerkraftmörser), Drohne als
  Datenplatzhalter. Abwehrstachel und Geschützturm in Feindeshand mit Geschütz-KI. KI mit
  Wahrnehmung (Sichtkegel, Sichtlinie, Licht und Wetter, Ortung strahlender Ziele, Lärm,
  Gedächtnis, Gruppennetz), Zustandsmaschine (Ruhe/Patrouille, Untersuchen, Angriff,
  Flankieren, Deckung, Rückzug, Verstärkung rufen, Suchen), Navigationsraster mit A*,
  echter Aufschaltung und Lenkraketen, Verstärkung per Landefähre oder vom Rand, Wellen.
  5 Schwierigkeitsgrade, Wracks mit Bergungswert, Reaktorexplosion mit Flächenschaden,
  KI-Debugansicht. Fünf Testmissionen inklusive Meilenstein „Erster Einsatz“.

- **Fix Startphase:** Gegner ruhen bis zum Ausrücken (`deploy`: Beinsperre gelöst auf
  Reaktorstrom); Alarmstart als bewusste Ausnahme, Startort Hangar (Tor öffnet beim
  Ausrücken) oder Absetzpunkt, Schutzzone mit Validierung, Signatur je Systemzustand.

- **Startphase-Fix:** sicherer Start (Gegner ruhen bis zum Ausrücken), Alarmstart, Hangar
  mit Tor oder Absetzpunkt, Schutzzone mit Validierung, Signatur je Systemzustand.
- **Teil 2 (Menüsystem):** Titel über 3D-Szene, Hauptmenü, Einsatzwahl mit Reitern und
  Übersichtskarte, Einsatzvorbereitung mit Walker-Vorschau und Übungsoptionen, Ladebildschirm,
  Optionen (Spiel, Grafik, Audio, Steuerung), Pausenmenü, Nachbesprechung; vollständig mit
  Tastatur, Maus und Gamepad bedienbar.
- **Detailtexturen und Umgebungsmodelle:** Low-Res-Graustufentexturen je Bodenart und
  Materialgruppe (Helligkeit, Farbe bleibt Palette), Filter „Pixelig“/„Gefiltert“, 32 externe
  CC0-Modelle (Kenney, Quaternius) als Bauwerke und Streuobjekte, Credits-Prüfung.
- **Walker-Modelle aus Tripo:** alle sechs Walker sowie SPLITTER, SICHEL und MONOLITH als
  detaillierte Modelle (starre Segmente auf dem eigenen Rig), Abwehrstachel als Modell;
  Umschalter detailliert/klassisch.

- **0.5.0 Phase 1 (Architektur- und Zustandsaudit):** `sim/MachineCondition.js` übersetzt Schaden
  und Maschinenzustand in einheitliche Funktionswerte (Reaktor, Antrieb, Hydraulik, Stabilität,
  Waffenstabilisierung, Sensoren). Behoben: ein zerstörter Reaktor feuert und lädt nicht mehr;
  aufschalten geht nur noch mit Sensoren; der Störeffekt der PZ-9 wirkt; die Trefferzonen der großen
  Modelle werden vollständig geprüft. Bericht: `docs/AUDIT-0.5.0.md`, Tests: `npm test`.

Fahrplan für die nächsten Phasen inklusive Stützpunkt, Bergung, Funk, Radar und Missionen:
`docs/ROADMAP.md`.

## Steuerung

Alle Tasten laufen über ein zentrales Aktionsregister (`src/input/actions.js`) mit Kontexten:
dieselbe Taste darf im freien Blick etwas anderes tun als im Kampf, aber nie doppelt im selben
Kontext. Belegt wird nach physischer Taste; angezeigt wird die Beschriftung der eigenen
Tastatur (QWERTZ). Eigene Belegung: Hauptmenü oder Pause → **Steuerung** (zwei Plätze je
Aktion plus Gamepad, Konfliktprüfung mit Tauschen, Gamepad/HOTAS-Achsen mit Live-Anzeige,
Totzone, Profile, Maus-Empfindlichkeit, Export/Import, Standard wiederherstellen). Im Einsatz
blendet `H` die Tasten des aktuellen Kontexts ein; beim ersten Einsatz erscheinen die acht
wichtigsten Tasten von selbst.

- **Kampf = Taste, Cockpit = Schalter.** Startprozedur, Licht, Systemschalter, Lenkart-Drehschalter,
  Monitor-Taster, Energie-Presets bedient man im freien Blick (`V` oder mittlere Maustaste halten)
  per Klick; Mausrad dreht Regler; Schubhebel anklicken und ziehen.
- **Feuerketten:** `1`–`4` wählen die aktive Kette (linke Maustaste), die rechte Maustaste feuert
  die zweite Kette (ab Werk die Raketenkette, `secondaryChain` in `walkers.js`),
  `Shift` + linke Maustaste alle Waffen. Waffengruppen sind nur noch Bausteine der Ketten.
- **Optische Rakete:** Beim Start schaltet der Monitor selbst auf die Raketenkamera (Kontext
  Raketenkamera); bei gehaltenem Feuer lenkt die Maus die Rakete. Nach Einschlag oder Absturz
  zurück. `M` dient zum Zuschauen bei aktiven/halbaktiven Raketen.
- **Funkmenü** `F`: Ziffern 1–7 wählen den Befehl, `Esc` schließt (bis Phase B: keine Flügelleute).
- **Pause:** `Esc` gibt die Maus frei und pausiert in einem Schritt; `Esc` oder „Fortsetzen“ geht
  weiter, ein Klick ins Bild fängt die Maus wieder. Fokuswechsel lässt alle gehaltenen Tasten los,
  der Schub bleibt stehen.
- **Debug-Modus:** `^` (links neben der 1) oder `?debug` — erst dann wirken die Debug-Tasten
  (Overlay `F2`, Drahtgitter `F4`, Freiflug `Shift+F4`, Treffer `F8`, Aufschaltung `F9` …).
  Doppelbelegungen meldet die Konsole und das Overlay.
- Walker im Menü wählen oder per URL `?walker=kestrel|marder|bastion|halberd|goliath|koloss`.

**Testanleitung Steuerung** (`?mission=range&start=hot`):

1. *Jede Kategorie einmal:* Bewegung (`W`/`S`, `A`/`D`, `X`, `C`, `Shift+C` nach seitlichem
   Zielen: die Beine drehen nach, der Torso bleibt auf dem Ziel), Waffen (`1`–`3` wählen die
   Kette — Waffenmonitor oben links; linke Maustaste, rechte Maustaste = RAKETEN, `Shift` + links
   = alle), Ziel (`T`, `Shift+T`, `Tab`, `G`, `L`, `M`), Systeme (`Q`/`E` Schildenergie),
   Sicht (`V`, mittlere Maustaste halten, `Shift+V`, `K`), Kommunikation (`F` → `3` → Funkspruch;
   `H` zeigt die Tasten des jeweiligen Kontexts — im freien Blick andere als im Kampf).
2. *Neu belegen und Konflikt:* Hauptmenü → Steuerung → bei „Zielnachführung an/aus“ auf `G`
   klicken, `T` drücken → Hinweis „T ist im selben Kontext schon belegt …“ → Tauschen.
   Danach liegt die Zielnachführung auf `T`, das Aufschalten auf `G`. Seite neu laden: bleibt.
   „Maus & Datei“ → Standard wiederherstellen (zweimal klicken).
3. *Fokusverlust:* `W` halten, mit Alt+Tab wegwechseln, `W` loslassen, zurück: der Schub steht
   auf dem letzten Wert und läuft nicht weiter hoch.
4. *Pointer-Lock-Verlust:* im Kampf `Esc`: Maus frei und Pause in einem Schritt. `Esc` oder
   „Fortsetzen“ geht weiter, ein Klick ins Bild fängt die Maus.
5. *Gamepad:* anschließen, einen Knopf drücken. Linker Stick fährt, rechter zielt, RT/LT feuern,
   RB schaltet auf, LB halten = freier Blick (rechter Stick bewegt den Cursor, A bedient),
   Kreuz ↑/↓ Kette, ←/→ Schildenergie, Y Funkmenü (B schließt), Start Pause, Select Hilfe.
   Unter Steuerung → „Gamepad / HOTAS“ bewegen sich die Achsenbalken live; Achse zuordnen mit
   „bewegen…“, Totzone, Profil speichern (z. B. „HOTAS“).
6. *Debug:* `F8` tut nichts. `^` schaltet den Debug-Modus ein (Overlay erscheint), jetzt wirkt `F8`.

<!-- controls:start -->
_Erzeugt aus `src/input/actions.js` mit `node tools/gen-controls.mjs` — nicht von Hand ändern. Tasten nach deutscher QWERTZ-Beschriftung._

**Bewegung**

| Aktion | Tastatur / Maus | Gamepad | Kontext |
|---|---|---|---|
| Schub erhöhen | `W` / `↑` | – | Kampf, freier Blick, Raketenkamera, Außenkamera |
| Schub verringern | `S` / `↓` | – | Kampf, freier Blick, Raketenkamera, Außenkamera |
| Schub auf Null | `X` | B | Kampf, freier Blick, Raketenkamera, Außenkamera |
| Beine links drehen | `A` / `←` | – | Kampf, freier Blick, Raketenkamera, Außenkamera |
| Beine rechts drehen | `D` / `→` | – | Kampf, freier Blick, Raketenkamera, Außenkamera |
| Torso zentrieren | `C` | A | Kampf, Außenkamera |
| Beine auf Torsorichtung ausrichten | `Shift+C` | – | Kampf, Außenkamera |
| Sprungdüsen (nur wenn vorhanden) | `Leertaste` | – | Kampf, Außenkamera |

**Waffen**

| Aktion | Tastatur / Maus | Gamepad | Kontext |
|---|---|---|---|
| Aktive Feuerkette feuern | `LMT` | RT | Kampf, Raketenkamera, Außenkamera |
| Zweite Kette feuern (Raketen) | `RMT` | LT | Kampf, Raketenkamera, Außenkamera |
| Notfallkette: alle Waffen | `Shift+LMT` | – | Kampf, Raketenkamera, Außenkamera |
| Feuerkette 1 wählen | `1` | – | Kampf, Außenkamera |
| Feuerkette 2 wählen | `2` | – | Kampf, Außenkamera |
| Feuerkette 3 wählen | `3` | – | Kampf, Außenkamera |
| Feuerkette 4 wählen | `4` | – | Kampf, Außenkamera |
| Vorige Feuerkette | – | Kreuz ↑ | Kampf, Außenkamera |
| Nächste Feuerkette | – | Kreuz ↓ | Kampf, Außenkamera |

**Ziel**

| Aktion | Tastatur / Maus | Gamepad | Kontext |
|---|---|---|---|
| Ziel unter Fadenkreuz bzw. nächstes | `T` | RB | Kampf, Außenkamera |
| Ziele durchschalten | `Shift+T` | – | Kampf, Außenkamera |
| Komponente am Ziel (Zielkapsel) | `Tab` | – | Kampf |
| Zielnachführung an/aus | `G` | X | Kampf |
| Lenkart durchschalten | `L` | – | Kampf |
| Raketenkamera (zuschauen) | `M` | – | Kampf, Außenkamera |

**Systeme**

| Aktion | Tastatur / Maus | Gamepad | Kontext |
|---|---|---|---|
| Schildenergie nach vorn | `Q` | Kreuz ← | Kampf, Raketenkamera |
| Schildenergie nach hinten | `E` | Kreuz → | Kampf, Raketenkamera |
| Radar aktiv/passiv (ab A4) | `R` | – | Kampf |
| Radarreichweite (ab A4) | `Shift+R` | – | Kampf |
| Automatischer Start | `Shift+S` | – | Kampf, freier Blick |

**Sicht und Bedienung**

| Aktion | Tastatur / Maus | Gamepad | Kontext |
|---|---|---|---|
| Freier Blick umschalten | `V` | – | Kampf, freier Blick, Außenkamera |
| Freier Blick (halten) | `MMT` | LB | Kampf, freier Blick, Außenkamera |
| Schalter bedienen | `LMT` | A | freier Blick |
| Außenkamera | `Shift+V` | – | Kampf, Außenkamera |
| Klemmbrett / Checkliste | `K` | – | Kampf, freier Blick |

**Kommunikation**

| Aktion | Tastatur / Maus | Gamepad | Kontext |
|---|---|---|---|
| Funkmenü | `F` | Y | Kampf, freier Blick, Außenkamera |
| Tastenhilfe ein/aus | `H` | Select | überall |
| Pause | `Esc` | Start | Kampf, freier Blick, Raketenkamera, Außenkamera, Freiflug |

**Menü**

| Aktion | Tastatur / Maus | Gamepad | Kontext |
|---|---|---|---|
| Menü: hoch | `↑` / `W` | Kreuz ↑ | Menü |
| Menü: runter | `↓` / `S` | Kreuz ↓ | Menü |
| Menü: links / Wert kleiner | `←` / `A` | Kreuz ← | Menü |
| Menü: rechts / Wert größer | `→` / `D` | Kreuz → | Menü |
| Menü: Reiter zurück | `Q` / `Bild ↑` | LB | Menü |
| Menü: Reiter vor | `E` / `Bild ↓` | RB | Menü |
| Menü: bestätigen | `Enter` / `Num Enter` / `Leertaste` | A | Menü |
| Menü: zurück / schließen | `Esc` | B | Menü |
| Menü: Eintrag 1–7 | `1`–`7` | – | Menü |

**Debug**

| Aktion | Tastatur / Maus | Gamepad | Kontext |
|---|---|---|---|
| Debug-Modus an/aus | `^` | – | überall |
| Debug: Overlay | `F2` | – | Debug |
| Debug: Drahtgitter | `F4` | – | Debug |
| Debug: Freiflug | `Shift+F4` | – | Debug |
| Debug: Treffer auf mich | `F8` | – | Debug |
| Debug: schwerer Treffer (Seiten der Reihe nach) | `Shift+F8` | – | Debug |
| Debug: feindliche Aufschaltung | `F9` | – | Debug |
| Debug: Ziel strahlt an/aus | `Shift+F9` | – | Debug |
| Debug: Gegner einfrieren | `Shift+F2` / `Num ×` | – | Debug |
| Debug: KI-Gruppe vor mir absetzen | `Einfg` / `Num +` | – | Debug |
| Debug: Detailtexturen an/aus | `Pos1` | – | Debug |
| Debug: Bodenart-Maske als Farbe | `Ende` | – | Debug |
| Freiflug: vorwärts | `W` / `↑` | – | Freiflug |
| Freiflug: zurück | `S` / `↓` | – | Freiflug |
| Freiflug: links | `A` / `←` | – | Freiflug |
| Freiflug: rechts | `D` / `→` | – | Freiflug |
| Freiflug: hoch | `Leertaste` | RB | Freiflug |
| Freiflug: runter | `Q` | LB | Freiflug |
| Freiflug: schnell | `Shift` | L3 | Freiflug |

Kontexte: **Kampf** = Kampf (Cockpit, normaler Blick) · **freier Blick** = Freier Blick (Schalter bedienen) · **Raketenkamera** = Raketenkamera (optische Rakete) · **Außenkamera** = Außenkamera · **Menü** = Menü (Funkmenü, Pause, Hauptmenü) · **Freiflug** = Debug-Freiflug · **Debug** = Debug-Modus (Zusatzschicht).
<!-- controls:end -->

## Kampf

**Lenkraketen.** Welche Lenkarten ein Werfer kann, steht in `src/data/weapons.js`
(`guidance`); kann er die gewählte nicht, schießt er ungelenkt (Waffenmonitor zeigt die Lenkart
je Werfer).

- *Aktiv:* braucht die volle Aufschaltung (steigende Pieptöne, dann Dauerton und roter Ring im
  HUD); danach sucht die Rakete selbst, solange das Ziel in ihrem Suchkopfkegel bleibt.
- *Halbaktiv:* mehr Schaden, aber das Ziel muss aufgeschaltet und im Torso-Kegel bleiben,
  sonst fliegt sie geradeaus weiter.
- *Anti-Radar:* ohne Aufschaltung; nimmt den nächsten strahlenden Walker im Torso-Kegel.
- *Optisch (SPEER):* Feuer gedrückt halten, die Maus lenkt die Rakete (Torso steht still,
  Schub geht weiter). Die Raketenkamera schaltet sich dazu selbst ein.

**Zielkapsel.** BASTION und KESTREL tragen ab Werk eine ZK-1 (CT, unter der Kanzel). Mit `Tab` wird die
Komponente gewählt: Zielmonitor rahmt sie ein und lässt sie blinken, im HUD sitzt ein kleiner
Rahmen darauf. Liegt das Fadenkreuz in ihrer Nähe (8°), laufen alle Geschosse dort zusammen
(◆ auf dem Zielmonitor, durchgezogener Rahmen). Ohne Kapsel meldet sich die Technik.

**Zielnachführung.** Der Torso folgt dem aufgeschalteten Ziel (bzw. der gewählten Komponente)
im Rahmen von Schwenkbereich und Drehrate, ohne Vorhalt. Mausbewegung hat Vorrang und pausiert
die Nachführung kurz. Verlässt das Ziel den Schwenkbereich, fällt der Schalter auf AUS.

**Treffer im Cockpit** (Stärken und Dauern in `config.js` → `hitFeedback`): Schildtreffer
leuchten blau mit Wabenmuster von der Trefferseite und brummen tief. Panzertreffer stoßen den
Kopf weg (Feder), Funken sprühen aus einem Paneel auf der Trefferseite, die Monitore flackern.
Schwere Treffer können einen Monitor beschädigen (Schnee oder schwarz); der Monitortest meldet
BILDRÖHRE bzw. ANZEIGEN FEHLER, der Systemmonitor listet die defekten Anzeigen. Bleibender
schwerer Schaden: Sensoren → Radar verrauscht, Torso → Risse in der Scheibe und Rauch im
Cockpit, Arm → dessen Waffen rot auf dem Waffenmonitor. Fällt die Reaktorabschirmung unter die
Hälfte: rotes Notlicht, Hupe, WARNUNG blinkt, Funkspruch. Feindliche Aufschaltung: schnelles
Piepen, RAKETE blinkt, roter Keil auf dem Radar; Rakete im Anflug: Dauerton, RAKETE leuchtet.
Seit A3 lösen das echte Gegner aus (MONOLITH mit Schwarmraketen), `F9` bleibt als Debug-Probe.

Feuern geht nur mit WAFFEN SCHARF und laufendem Reaktor; sonst klickt es, VORSICHT blinkt und
die Technik meldet sich. Waffen, Schaden, Hitze und Energie: `src/data/weapons.js`,
`src/data/combat.js`, Werks-Bewaffnung und Ketten in `src/data/walkers.js`.

**Testanleitung Schießstand** (`?mission=range&start=hot`, 6 stehende und 3 laufende Ziele):

1. *Schild gegen Panzer:* Marder (190 m) aufschalten (`T`), Kette 1 (`1`, ARME: Laser,
   Autokanone, Schrot) 2–3 s mit der linken Maustaste — erst brechen die Frontschilde zusammen,
   danach Panzerschaden. Kette 3 (`3`, DAUERFEUER) auf den laufenden Marder (250 m).
   Zielmonitor und Debug-Overlay (`^`) zeigen Schilde und Komponenten.
2. *Beine abschießen:* auf den KESTREL (110 m) zufahren und auf die Beine zielen. Bei „schwer“
   wird er langsamer, bei „zerstört“ kniet er ab und raucht (Zielmonitor: BEWEGUNGSUNFÄHIG).
3. *Arm abschießen:* einen Walker von der Seite auf den Arm beschießen. Der Arm fällt ab, die
   Waffe bleibt mit blinkendem Marker liegen.
4. *Überhitzen und neu starten:* `Shift` + linke Maustaste gedrückt halten (alle Waffen). HITZE leuchtet, der Hitzebalken auf dem
   Systemmonitor steigt, nach etwa 9 s (BASTION) folgt die Notabschaltung. Danach Neustart
   laut Klemmbrett (`K`): Pumpen prüfen, VORH, Zündkappe zu/auf, ZÜND, Hauptbus REAKT, BETR.

**Testanleitung A2b** (Schießstand, `?mission=range&start=hot`; der Hügel liegt links vorn,
dahinter steht verdeckt ein MARDER; GOLIATH (560 m, stehend) und der laufende BASTION strahlen):

1. *Ungelenkt:* `L` bis UNGEL, den laufenden MARDER (250 m) aufschalten, rechte Maustaste — die Raketen
   fliegen geradeaus, gegen das bewegte Ziel geht das meiste daneben.
2. *Aktiv:* `L` auf AKTIV, MARDER mit `T` aufschalten und im Kegel halten: Pieptöne werden
   schneller, dann Dauerton und roter Ring. `M` (Kamera an), rechte Maustaste und sofort den Torso
   wegdrehen — die HABICHT treffen trotzdem, die Kamera zeigt AUFG. Vorher (ohne volle
   Aufschaltung) zeigt der Waffenmonitor AUFSCHALT. und es startet nichts.
3. *Halbaktiv:* `L` auf HALB, aufschalten, feuern und das Ziel im Kegel halten → Treffer mit
   mehr Schaden. Zweiter Versuch: nach dem Start wegdrehen → die Raketen verlieren das Ziel
   und schlagen im Gelände ein.
4. *Anti-Radar:* `L` auf A-RAD, ohne Aufschaltung grob Richtung GOLIATH (links, 560 m) zielen,
   rechte Maustaste — die Raketen schwenken auf ihn ein. Im Debug-Modus (`^`) macht `Shift+F9`
   das aufgeschaltete Ziel zum Strahler oder schaltet es ab (das Overlay zeigt die Strahler).
5. *Optisch hinter den Hügel:* Walker HALBERD (`?walker=halberd`), `L` auf OPT. Knapp über
   den Hügel zielen, rechte Maustaste gedrückt halten: der Zielmonitor schaltet auf die Raketenkamera
   (H = Höhe über Grund, BRENN = Restbrenndauer). Mit der Maus über den Hügelkamm lenken, dann
   auf den verdeckten MARDER stürzen. Einschlag → Weißrauschen, danach wieder Zielmonitor.
   Loslassen der Feuertaste: die Rakete fliegt geradeaus weiter.
6. *Beine mit der Zielkapsel:* BASTION, MARDER (190 m) aufschalten, `Tab` bis BEINE
   (Zielmonitor rahmt BEINE ein, im HUD sitzt der kleine Rahmen auf den Beinen). Fadenkreuz
   grob auf den Walker, Kette 1 (`1`, ARME) mit der linken Maustaste halten — die Treffer laufen auf die Beine
   zusammen, bis er abkniet (im Test nach etwa 25 s). Mit einem Walker ohne Kapsel (MARDER)
   meldet `Tab` „Keine Zielkapsel an Bord“.
7. *Treffer auf allen vier Seiten:* Debug-Modus an (`^`), `Shift+F8` viermal (vorn, rechts, hinten, links): zuerst
   blaues Leuchten mit Brummen auf der jeweiligen Seite (Schild), sobald der Schild leer ist
   Kopfstoß, Funken aus dem Paneel der Seite und Monitorflackern. Weiter `Shift+F8` bis der
   Torso schwer ist: Risse in der Scheibe, Rauch zieht auf, bei kritischem Reaktor rotes
   Notlicht, Hupe, WARNUNG blinkt. Noch mehr Treffer zerstören den Reaktor (der Walker ist dann
   ein Wrack; ein Missionsende dafür kommt mit Phase B).
8. *Monitorausfall:* im Debug-Modus `F8` mehrmals (ab 20 Schaden fällt mit 18 % ein Monitor aus) — oder
   schneller über die Konsole `steelWarden.states.current.hits.breakMonitor('mfdRadar','noise')`.
   Ein Monitor zeigt Schnee oder bleibt schwarz, der Systemmonitor meldet ANZEIGE DEFEKT,
   MONITORE TEST zeigt BILDRÖHRE / ANZEIGEN … FEHLER.
9. *Feindliche Aufschaltung:* im Debug-Modus `F9`: der nächste Gegner schaltet auf (schnelles Piepen, RAKETE
   blinkt, roter Keil auf dem Radar), nach 3,5 s startet er eine Rakete (Dauerton, RAKETE
   leuchtet), die einschlägt.
10. *Zielnachführung:* MARDER aufschalten, `G` (Lampe NACHF.): der Torso folgt. Mit der Maus
   gegensteuern — kurz Vorrang, dann zieht die Nachführung zurück. Mit den Beinen wegdrehen,
   bis das Ziel hinter dem Schwenkbereich liegt: Schalter fällt auf AUS, Lampe aus, Funkspruch.

## Welt (Teil 2)

**Bodenarten** (Werte in `src/data/surfaces.js`, das Debug-Overlay `^` zeigt die Bodenart unter dem Walker):

| Boden | Wirkung |
|---|---|
| hart | – |
| weich (Schnee, Schlamm, Sand) | bremst, je schwerer desto mehr (KESTREL kaum, KOLOSS auf gut die Hälfte) |
| Wasser | bremst leicht, kühlt den Reaktor (−9 °C/s) |
| Lava | bremst, heizt den Reaktor (+22 °C/s), frisst die Beine (≈ 7 Punkte/s) |
| dünnes Eis | trägt leichte Walker; ab 50 t bricht es: Walker sinkt 2,2 m ein, 4 s fest, danach Waten |
| heiß | heizt den Reaktor leicht (+4 °C/s) |

**Bauwerke** stehen in Sites (Missionen) oder werden je Schauplatz automatisch gesetzt (Hallen,
Kühltürme und Kräne in Brenn-Süd, Funkrelais im Delta, Pylone und Stachel in der Kernwelt). Sie
halten Walker auf, fangen Geschosse ab, verdecken die Sicht (keine Aufschaltung, aufgeschaltete
Ziele gehen nach 1,5 s verloren) und lassen sich zerstören: erst beschädigt (dunkler, schief,
Rauch), dann Trümmer mit Feuer oder Explosion. Radarturm, Funkrelais, Kristall-Pylon und Sensorknoten strahlen
(Anti-Radar-Ziel). Felsen, Basaltsäulen, Eisblöcke und Tafelfelsen kollidieren ebenfalls.

**Wetter** dünnt die Sicht aus (Nebel), legt Schnee, Sand, Asche oder Tropfen auf die
Kanzelscheibe, rauscht im Wind; im Sandsturm baut sich die Aufschaltung langsamer auf und reißt
gelegentlich ab, die Raketenkamera verschneit mit der Entfernung.

**Einsatzgebiet:** gestrichelte Linie auf dem Radar, ab 200 m vor der Grenze ein grüner
holografischer Zaun. Funkwarnung bei Annäherung und beim Verlassen, sonst noch keine Folgen.

**Testanleitung Teil 2:**

1. *Bodenproben* (Menü „Bodenproben“, sechs Streifen von links: hart, weich, Wasser, Lava,
   dünnes Eis, heiß). Mit KESTREL (`?walker=kestrel`) und KOLOSS (`?walker=koloss`) je einen
   Streifen entlanglaufen und Tempo (Schubanzeige/Debug-Overlay `^`) und Kerntemperatur (Systemmonitor)
   vergleichen. Im Wasser fällt die Temperatur, in Lava steigt sie, und der Schadensmonitor
   zeigt die Beine sinken. Auf dem Eis-Streifen (Navpunkt EIS) läuft der KESTREL drüber, der
   KOLOSS bricht mit Krachen ein, steckt 4 s fest und watet dann weiter.
2. *Bauwerk zerstören:* „Testgelände Brenn-Süd“, auf den Stützpunkt 400 m voraus zugehen, `Shift` + linke
   Maustaste auf ein Gebäude halten. Erst Rauch und dunklere, verbogene Teile, dann Trümmer mit Feuer
   bzw. Explosion (Generator). Danach kann man über die Trümmer laufen; vorher hält das Gebäude
   den Walker auf. Das Debug-Overlay (`^`) zählt Bauwerke und Trümmer.
3. *Optische Rakete um den Felsbogen:* „Testgelände Canyonwüste Tessar“ (HALBERD), für klare
   Sicht `?mission=test-canyon&weather=clear`. Der MARDER hinter dem rechten Pfeiler lässt sich
   nicht aufschalten. `L` auf OPT, leicht links vom rechten Pfeiler durch den Bogen zielen, rechte Maustaste
   halten und die SPEER nach dem Bogen nach rechts auf den MARDER lenken.
4. *Sandstorm-Sicht:* dieselbe Mission ohne `weather`-Parameter: Sicht unter 300 m, Sand auf
   der Scheibe, Wind. Einen Walker aufschalten — die Aufschaltung dauert länger (Faktor 0,6),
   die Raketenkamera verschneit mit der Entfernung.
5. *Schauplätze:* je eine Testmission für Kalvik (Schneesturm, Eissee mit dünnem Eis, Spalte),
   Ashmar (Ascheregen, Lavafluss, heiße Zone, Raffinerie), Brenn-Süd (Regen, Straßenraster,
   Stützpunkt), Selene-7 (Krater, Landeplatz, niedrige Schwerkraft), Morrow (Bodennebel, Kanal
   mit Deichen, Schilf), Tessar (Sandsturm, Schluchten, Felsbogen) und die Kernwelt (Adern,
   Synthese-Nest). Einsatzgebiet mit Zaun in Kalvik, Brenn-Süd und Morrow.

## Startphase und Ausrücken

Jede Mission hat eine Startphase (`startup` in `src/data/missions.js`, Details in
`src/states/missionStartup.js` und `docs/STARTUP-PLAN.md`):

- **Sicherer Start (Standard):** Die Gegner ruhen, bis du **ausrückst** — Beinsperre gelöst,
  Bus auf Reaktorstrom. Erst dann laufen KI, Geschütze, Verstärkung, Wellen und die
  Missionsuhr (oben rechts „STARTPHASE“, danach „T+mm:ss“). Funk: Freigabe mit Kurs und
  Entfernung zum ersten Navpunkt.
- **Alarmstart:** Gegner sind von Anfang an wach und rücken nach `scrambleDelay` auf den
  Stützpunkt vor. Alarmfunkspruch, die Hauptwarnlampe blinkt bis zum Ausrücken,
  Startprozedur „einfach“.
- **Heiß:** Walker startet einsatzbereit (`?start=hot`).
- **Startort:** Hangar am eigenen Stützpunkt (Tor zu, bis du ausrückst; dann Hupe,
  Rundumleuchten, Schiebetor) oder Absetzpunkt mit Bodenmarkierung.
- **Schutzzone:** In `safeRadius` um den Start dürfen keine KI-Einheiten, Patrouillenpunkte
  oder Absetzpunkte liegen; Verstöße meldet das Menü beim Start im Klartext. Patrouillen
  laufen um die Zone herum, Gefechte dürfen hinein.
- **Signatur:** Kalt sieht dich die Synthese nur aus der Nähe (Sicht ×0,35), mit
  Hilfsaggregat wirst du auf 350 m geortet, mit laufendem Reaktor auf 1100 m (Wärme), mit
  SENSOREN an wie bisher auf 1400–1600 m. Werte in `src/data/systems.js` (`signature`).
- **Gruppen wecken:** `activate: 'onDeploy' | 'immediate' | 'onTrigger:<id>'` mit
  `triggers` vom Typ `area` (Bereich betreten) oder `time` (s seit dem Ausrücken). Im
  *Hinterhalt* setzt sich die Patrouille erst in Bewegung, wenn du die Schlucht betrittst.
- Debug-Overlay: Startmodus, Schutzzone, Zeitpunkt des Ausrückens, nächste Gegnergruppe zum
  Startort, aktuelle Signatur, je Gruppe ruhend/aktiv, Trigger.

**Testanleitung Startphase:**
1. *Erster Einsatz* mit voller Startprozedur und bewusst langsam (ein paar Minuten
   warten, im Debug-Modus `^` zeigt das Overlay „patrouille ruhend“ und die Entfernung): die
   Gegner rühren sich nicht. Beim Lösen der Beinsperre öffnet das Hangartor, Funk gibt den
   Kurs zu ALPHA, die Uhr beginnt.
2. *Alarmstart* (`test-scramble`) zweimal: einmal sofort `Shift+S` (Automatik) — der
   Reaktor läuft früh, die Späher orten dich schon auf rund 1100–1500 m und kommen gezielt;
   einmal 60–70 s warten und dann hochfahren — die Späher rücken nach 45 s auf den Stützpunkt
   vor, finden dich aber erst, wenn der Reaktor läuft, und suchen bis dahin um den Hangar.
3. *Validierungsprobe* (`test-invalid`, absichtlich fehlerhaft) starten: das Menü meldet,
   welche Einheit und welche Patrouillenpunkte wie weit innerhalb der Schutzzone liegen.
   Eigene Probe: in einer Mission eine Einheit mit `at` nah an den Start setzen.

## Menüs (Teil 2)

Aufbau (Skizze und Module in `docs/MENU-PLAN.md`):

```
Titelbildschirm (3D-Szene, „Taste drücken“, Version und Build-Datum unten rechts)
└─ Hauptmenü: Kampagne (in Vorbereitung) · Übungseinsatz · Optionen · Erprobung (nur Debug) · Mitwirkende
   └─ Übungseinsatz → Einsatzwahl → Einsatzvorbereitung → Laden → Einsatz
Im Einsatz: Pausenmenü · Nachbesprechung
```

- **Titel und Hauptmenü** liegen über einer echten 3D-Szene (`src/render/MenuScene.js`):
  ein Walker auf dem Landeplatz eines zufälligen Schauplatzes zu zufälliger Tageszeit,
  langsame Kamerafahrt, Scanlines und Vignette (Stärke unter Optionen → Grafik), CRT-Einschalten.
- **Einsatzwahl:** Reiter Schauplätze · Gefechte · Systemtests (`category` und `description`
  je Mission); rechts Beschreibung, Schauplatz, Tageszeit, Wetter, Gegner, Startmodus und
  eine Übersichtskarte aus dem Höhenfeld (Start, Navpunkte, Gegner, Gebiet, Schutzzone).
- **Einsatzvorbereitung:** Walker wählen (◀ ▶) mit 3D-Vorschau auf der Drehplattform und
  Kennwerten als Balken, Werks-Bewaffnung, Übungsoptionen (verwundbar, Munition,
  Schwierigkeit, Tageszeit, Wetter, Startprozedur voll/einfach/auto/heiß). Die Auswahl bleibt
  gespeichert.
- **Laden:** Missionsname, Schauplatz, Balken für Gelände, Modelle und Audio, wechselnde Hinweise.
- **Optionen:** Spiel (Startprozedur, Zufallsereignisse, Tastenhilfe, Funktexte, Einheiten),
  Grafik (Sichtweite, Objektdichte, Schatten, Effekte, Scanlines, Auflösungsskala, FPS,
  Detailtexturen, Texturfilter, Walker-Modelle),
  Audio (Gesamt, Effekte, Cockpit/Maschine, Funk, Musik), Steuerung (Belegungsbildschirm).
  Wirkt sofort, gespeichert in `localStorage`, „Standard wiederherstellen“ je Seite.
  Sichtweite und Objektdichte gelten ab dem nächsten Einsatz.
- **Pause:** Fortsetzen · Einsatzziele · Steuerung (nur Ansicht) · Optionen · Einsatz neu
  starten · Einsatz abbrechen (mit Bestätigung). Simulation steht, Ton gedämpft, Szene dunkel.
- **Nachbesprechung:** Ergebnis, Einsatzzeit ab dem Ausrücken, Strecke, Abschüsse mit
  Zerstörungsart und Schrottwert, eigener Schaden je Komponente, Treffergenauigkeit;
  „Erneut“ startet denselben Einsatz mit denselben Einstellungen.

**Bedienung:** Pfeile oder WASD bzw. Steuerkreuz und linker Stick bewegen den Fokus (gelber
Rahmen), links/rechts ändert Werte, `Q`/`E` bzw. LB/RB wechseln Reiter, `Enter`/Leertaste bzw. A
bestätigt, `Esc` bzw. B geht zurück. Maus: Fokus beim Überfahren, Klick bestätigt, Klick auf
◀ ▶ ändert. Jeder Bildschirm merkt sich den letzten Fokus. Lange Listen scrollen in ihrem
Bereich mit ausgeblendetem Rand als Hinweis. Alles skaliert über eine Einheit von 1280×720
bis 2560×1440.

**Testanleitung Menüs:**
1. Nur Tastatur, 1280×720: Titel → Taste → Übungseinsatz → Reiter mit `Q`/`E` durchblättern
   (Karte und Angaben wechseln) → Duell → Einsatzvorbereitung: Walker mit ←/→ wechseln (die
   Vorschau dreht sich auf der Plattform), Schwierigkeit ändern → „Einsatz beginnen“ →
   Ladebildschirm → im Einsatz `Esc` → Einsatzziele, Steuerung, Optionen ansehen → „Einsatz
   abbrechen“ → bestätigen → Nachbesprechung → „Zum Hauptmenü“.
2. Dasselbe nur mit Gamepad (Steuerkreuz/Stick, A, B, LB/RB, im Einsatz Start für die Pause).
3. Dasselbe in 2560×1440 (Browserfenster oder Zoom): nichts überlappt, nichts wird
   abgeschnitten, Schrift wächst mit.
4. Optionen → Grafik → Scanlines/CRT ändern: wirkt sofort; Seite neu laden: Wert bleibt;
   „Standard wiederherstellen“ (zweimal bestätigen) setzt die Seite zurück.
5. Debug-Modus (`^`) im Hauptmenü: der Eintrag „Erprobung“ erscheint mit allen Testmissionen.

## Gegner und KI (A3)

**Synthese-Einheiten** (`src/data/enemies.js`, Modelle in `src/data/enemyModels.js`). Gleiche
Gelenkstruktur wie die Walker der Menschen, gleiche Schadenspipeline und Trefferzonen:

| Einheit | Rolle | t | km/h | Bewaffnung | Verhalten |
|---|---|---|---|---|---|
| SPLITTER | Späher | 22 | 94 | 2× Splitterwerfer | flankiert gern, ruft beim ersten Kontakt Verstärkung, zieht sich früh zurück |
| SICHEL | Jäger | 45 | 61 | Kristalllanze (Strahl), 2× Impulsprisma | Standard-Angreifer, hält ~300 m |
| MONOLITH | Brecher | 78 | 36 | 2× Kristallhammer, 2× Schwarmraketen (aktiv, mit Aufschaltung) | langsam, hält ~420 m, flankiert nie |
| OBELISK | Belagerer | 70 | 32 | Schwerkraftmörser (ballistisch), Impulsprisma | bleibt hinten, schießt nur auf Ziele, die ein anderer sieht |
| SCHWARM | Drohne | 3 | – | – | nur Daten, Flugmodell folgt |

Gebäude-Geschütze: **Abwehrstachel** (Synthese, Impulsprisma, rundum) und **Geschützturm**
(Menschen, AK-20, drehender Turmkopf) — sie schießen in Salven, sobald eine Mission sie unter
`forces.guns` der Synthese zuordnet.

**Wahrnehmung:** Sichtkegel um den Torso (bis 70 m rundum), Reichweite × Tageslicht (Nacht
0,45, Dämmerung 0,75; eingeschalteter Suchscheinwerfer zählt nachts wie Tag) × Wetter (Nebel)
× Schwierigkeit, Sichtlinie gegen Gelände, Bauwerke und große Felsen, je Einheit alle 0,4 s
gestaffelt. Bis das Radar kommt (A4), **strahlt der eigene Walker, solange der Schalter
SENSOREN an ist** — die Synthese ortet ihn dann auf 1400–1600 m (Position bekannt, aber ohne
Sicht kein Direktfeuer). Schüsse (600–900 m) und Explosionen (900–1200 m) melden Einheiten in
Hörweite eine Position. Kontakte gehen mit 0,8 s Verzögerung ins Synthese-Netz der Gruppe,
nach 25 s ohne neue Information verblasst die letzte bekannte Position.

**Verhalten:** Ruhe/Patrouille (Keil hinter dem Anführer) → Untersuchen → Angriff
(bevorzugte Distanz halten, in Bewegung bleiben, Torso zielt unabhängig von den Beinen) ⇄
Flankieren (seitlich, nur auf Punkte mit Sicht auf das Ziel) / Deckung (bei leeren Schilden
hinter ein Gebäude) → Rückzug (Schaden oder Moral nach einem Abschuss in der Gruppe) →
Suchen. Zielen mit Vorhalt, Streuung und Reaktionszeit nach Schwierigkeit; ab Veteran
Fokusfeuer auf das am stärksten beschädigte Ziel. Schwarmraketen schalten den Spieler
wirklich auf — es gelten die Warnungen aus A2b (Piepen, RAKETE, roter Keil auf dem Radar).
Ohne Beine kämpft eine Einheit kniend weiter. Bewegung über dieselben Eingaben wie beim
Spieler (Schub, Drehen) auf einem 12-m-Navigationsraster (Steigung, Wasser, Lava, dünnes
Eis für schwere Walker, Bauwerke) mit A*, Pfadglättung, gedrosselter Neuplanung, Abstand
zueinander und Befreiung, wenn eine Einheit festhängt.

**Schwierigkeitsgrade** (Hauptmenü, gespeichert; `src/data/difficulty.js`):

| | Reaktion | Streuung | Vorhalt | Flanke / Deckung / Fokus | Verstärkung | Anzahl | Sicht | Aufschaltung |
|---|---|---|---|---|---|---|---|---|
| Anfänger | 1,4 s | 4,5° | 20 % | – / – / – | ×1,8 | ×0,6 | ×0,7 | ×1,6 |
| Grün | 1,0 s | 3,2° | 45 % | ✓ / – / – | ×1,4 | ×0,8 | ×0,85 | ×1,3 |
| Normal | 0,7 s | 2,2° | 70 % | ✓ / ✓ / – | ×1,0 | ×1,0 | ×1,0 | ×1,0 |
| Veteran | 0,45 s | 1,4° | 85 % | ✓ / ✓ / ✓ | ×0,8 | ×1,2 | ×1,1 | ×0,85 |
| Elite | 0,3 s | 0,8° | 100 % | ✓ / ✓ / ✓ | ×0,6 | ×1,4 | ×1,2 | ×0,7 |

**Wracks:** Beine zerstört → die Einheit sackt auf die Knie, bleibt ein intaktes Wrack (100 %
Bergung) und schießt kniend weiter; Waffen eines abgeschossenen Arms bleiben je nach
`weaponDropChance` als Marker liegen. Reaktor → große Explosion (Radius und Schaden wachsen mit
der Tonnage, trifft auch den eigenen Walker mit Kopfstoß), die Arme fliegen als Trümmer weg,
ausgebranntes Wrack mit 10 %. Bei Synthese-Wracks verblassen die Adern über 25 s, Kristallsplitter
rieseln. Das Debug-Overlay listet alle Wracks mit Zerstörungsart und Bergungswert in Schrott.

**Debug** (Debug-Modus `^`): über jeder Einheit Zustand und Ziel, gelbe Sichtkegel (rot, wenn
sie aufschaltet), grüne Pfade und Ziele, rotes Kreuz an der letzten bekannten Spielerposition,
orange Kreise der Geschütze. `Shift+F2` (oder `Num ×`) friert alle Gegner ein, `Einfg` (oder
`Num +`) setzt eine jagende KI-Gruppe (Späher + Jäger) 300 m vor dem Walker ab. Das Overlay
zeigt je Einheit Zustand, Ziel, Entfernung und Torso, dazu KI-Takt, Pfade, Verstärkung und Wellen.

**Testanleitung A3** (Missionen im Menü unten; `?mission=…` springt direkt hinein):

1. *Duell* (`test-duel`): ein Jäger 800 m voraus kennt deine Position, sobald du ausrückst. Je Schwierigkeitsgrad
   einmal spielen (Einsatzvorbereitung → Schwierigkeit oder `&difficulty=…`): Anfänger schießt spät und weit
   daneben und kommt frontal, Normal flankiert manchmal und trifft gut, Elite hält kaum still
   und trifft fast jede Salve. Im Debug-Modus sieht man Kegel, Zustand und Pfad.
2. *Hinterhalt* (`test-ambush`): SENSOREN aus (Schalter), die Schlucht bis zum Knick (KNICK)
   entlang und dort warten. Die Patrouille kommt aus dem Ostarm um die Ecke; der Späher meldet
   sich (Funk: „Späher ruft Verstärkung“), 40 s später kommt ein weiterer Jäger. Mit SENSOREN
   an wird man schon auf rund 1500 m geortet und die Patrouille kommt suchen.
3. *Stellung* (`test-stellung`): Raffinerie 700 m voraus, zwei Abwehrstachel,
   zwei Geschütztürme (drehen den Kopf) und ein MONOLITH. Seine Schwarmraketen schalten auf —
   Piepen und Keil, dann RAKETE. Hinter Gebäuden Deckung suchen, die Türme einzeln ausschalten.
4. *Welle* (`test-waves`, GOLIATH): drei Landefähren-Wellen, jeweils 10 s nach der vorigen;
   Welle 3 bringt einen OBELISK, dessen Mörsergranaten in hohem Bogen kommen, solange ein
   anderer Synthese-Walker dich sieht.
5. *Beine abschießen vs. Reaktor treffen:* im Duell mit der Zielkapsel (`T`, `Tab` bis BEINE,
   Kette 1) die Beine zerstören → der Jäger kniet, schießt aber weiter, Overlay: „Beine ·
   Bergung 100 % = 180 Schrott“, die Adern verblassen. Zweiter Versuch auf den Torso: große
   Explosion, Arme fliegen weg, in unter ~25 m Abstand gibt es einen Kopfstoß und
   Torsoschaden, Overlay: „Reaktor · Bergung 10 % = 18 Schrott“.
6. *Verstärkung auslösen:* im Hinterhalt oder im Ersten Einsatz vom Späher sehen lassen
   (Overlay: „Verstärkung coming … s“), oder im Debug-Modus `Einfg` für eine Gruppe sofort.
7. *Erster Einsatz* (`first-sortie`, Meilenstein): Kaltstart im offenen Hangar, Startprozedur,
   durchs Tor raus, ALPHA anlaufen, die Patrouille bei BRAVO stellen (der Späher ruft eine
   Landefähre mit einem MONOLITH), dann zur EXTRAKTION. Die Auftragszeile oben zeigt den
   Schritt, der Navmonitor den aktiven Navpunkt. Extraktion erreicht → „Einsatz erfüllt“,
   Walker zerstört → „Einsatz gescheitert“.

## Startprozedur

Reihenfolge (Checkliste im Spiel): Batterie → Hilfsaggregat START halten → KÜHLPUMPEN (ein Schalter, Pumpe 2 läuft automatisch nach) →
BETRIEBSART VORH bis VORHEIZ OK → Zündkappe auf, ZÜND → Hauptbus REAKT → Hydraulik →
Monitore TEST → Gyro ausrichten → Sensoren → Schilde → Waffen scharf → Beinsperre LÖSEN →
BETRIEBSART BETR für volle Leistung.

Hilfsaggregat-Klang: Beim START läuft das Anlaufgeräusch (`apu_start`, ≈ 8,5 s); gegen sein
Ende blendet der Laufton (`apu_run_loop`) über. Fährt das Aggregat vorher wieder herunter
(START zu früh losgelassen, Batterie aus), bricht der Anlaufklang ab und der Laufton sinkt mit
der Drehzahl. Der Laufton trägt 1 s umgewickelten Ton an beiden Enden, die Schleife läuft über
feste Schleifenpunkte (`loopPoints` in `src/data/sounds.js`) ohne Knacken.

- Startmodus in `src/data/config.js` (`startup.mode`: `full`, `simple`, `auto`) oder per
  URL `?startmode=simple`; Zufallsereignisse mit `startup.randomEvents`
- `?start=hot` überspringt den Start (alle Systeme bereit)
- Alle Zeiten, Schwellen und Raten: `src/data/systems.js`

**Testszenarien**

1. *Korrekter Start:* Checkliste (`K`) Punkt für Punkt abarbeiten. Am Ende sind alle
   Statuslampen links aus, Funkspruch „Bereit zum Ausrücken", der Walker fährt.
2. *Zündung ohne Kühlung:* Batterie, Hilfsaggregat, VORH — KÜHLPUMPEN auslassen — zünden.
   Die Kerntemperatur steigt über 700 °C (HITZE, WARNUNG, Alarm), bei 900 °C Notabschaltung:
   BETRIEBSART springt auf AUS, Hauptbus auf HILFS, Hilfsaggregat startet von selbst.
3. *Neustart:* nach der Notabschaltung KÜHLPUMPEN ein, abkühlen lassen, VORH bis VORHEIZ OK.
   Zünden geht erst, nachdem die Zündkappe einmal geschlossen und wieder geöffnet wurde.
   Dann ZÜND, Hauptbus REAKT, BETR — das Klemmbrett zeigt solange die Neustart-Liste.

## Detailtexturen und Umgebungsmodelle

**Detailtexturen** (`assets/textures/`, Graustufen-PNG 128 px, im Bundle eingebettet; Liste mit
Kachelgröße und Quelle in `src/data/textures.js`). Sie verändern nur die Helligkeit — die Farbe
kommt weiter aus der Palette des Schauplatzes.

- *Gelände:* sieben Lagen — hart, weich, Fels, Ufer, Lava, Eis, Straße. Weich/Ufer/Lava/Eis/Straße
  kommen aus der Bodenmaske (je Ecke ins Gitter geschrieben), Fels aus der Hangneigung (dreiplanar,
  damit Steilhänge nicht verzerren). Welche Textur je Lage und wie stark: `theaters.js` → `detail`.
  Gegen sichtbare Kacheln: zweite Lage im 2,7-fachen Maßstab und leicht gedreht, die erste Lage je
  Chunk um bis zu ±10° gedreht; ab 450 m blendet das Detail aus.
- *Objekte:* Materialgruppen Metall, Beton, Holz, Tank, Kristall, Fels, Eis, Akzent, Dunkel
  (`MATERIAL_GROUPS`), dreiplanar im Objektraum. Prozedurale Teile bekommen ihre Gruppe aus `mat`
  am Teil bzw. Bauplan, sonst aus dem Farbton. Walker: Metall, Synthese: Kristall.
- *Optionen → Grafik:* „Detailtexturen“ aus/schwach/normal/stark, „Texturfilter“ Pixelig
  (Nearest) oder Gefiltert (bilinear); Mipmaps sind immer an.
- *Neu einlesen:* `python3 tools/import_textures.py --sbs "<…>/Base Materials 256x256"`
  (Graustufen, ≤ 128 px, Mittelwert/Kontrast normiert; Metall, Tank, Kristall, Sand, Lava werden
  erzeugt).

**Externe Umgebungsmodelle** (`assets/props/<paket>/`, GLB, eingebettet; `src/data/props.js`:
Datei, Maßstab, Drehung, Bodenversatz, Kollision, Trefferzonen, Panzerung, Trümmer). Beim Laden
werden Materialien und Texturen verworfen: Flat-Shading, je Vertex nur Helligkeit plus
Materialgruppe, Farbe aus `theaters.js` → `materials`. Bauwerke in `structures.js` mischen externe
(`prop: 'factory-a'`) und prozedurale Teile; gleiche Teile werden instanziert, Kollision
`collide: 'auto'` aus den Teilen. Fehlt eine Datei oder lädt sie nicht, steht an ihrer Stelle ein
magenta gestreifter Kasten in der angegebenen Größe, und die Konsole sowie das Debug-Overlay
nennen sie. Neu einlesen: `python3 tools/import_props.py --kenney-industrial <dir> --kenney-space <dir> --quaternius <dir>`.

**Credits:** `CREDITS.md` nennt je Paket Name, Autor, Lizenz und Link. `npm run check-credits`
(`tools/check_credits.mjs`) prüft, dass jede Datei in `assets/props` und `assets/textures` in
`props.js`/`textures.js` eingetragen ist, jede eingetragene Datei existiert und jedes Paket in
`CREDITS.md` steht.

**Debug** (nur im Debug-Modus `^`): `Pos1` Detailtexturen an/aus, `Ende` Bodenart-Maske als Farben
(grau hart, braun weich, dunkel Fels, blau Ufer, rot Lava, türkis Eis, gelb Straße). Das Overlay
zeigt Texturen (an/aus, Filter, geladen) und Props (geladen, Dreiecke je Typ, fehlende Dateien).

**Testanleitung:**

1. *Requisiten* (Menü Einsatzwahl → System, `?mission=test-props&debug`): drei Reihen mit allen
   20 Modell-Bauwerken. Overlay: „Props 32/32 geladen“, keine fehlenden Dateien. Gegen ein Gebäude
   laufen (hält auf), eins zerschießen (beschädigt → Trümmer).
2. *Bodenproben* (`?mission=test-ground&debug`): `Pos1` mehrmals — die Streifen bekommen Körnung
   bzw. werden glatt. `Ende` zeigt die Maske: Wasserrand blau, Lava rot, Eis türkis, weich braun.
3. *Fels an Steilhängen:* Selene-7 oder Tessar, `Ende` — Kraterwände und Schluchtränder dunkel.
4. *Filter:* Optionen → Grafik → Texturfilter zwischen Pixelig und Gefiltert wechseln, nah am Boden
   stehen: pixelige Körner vs. weich gefiltert; wirkt sofort.
5. *Schauplätze mit Modellen:* Brenn-Süd (Fabriken, Containerhof, Fässer, Kisten), Selene-7
   (Kuppelhangar, Schüssel, Generator, Fähre, Felsbrocken), Kernwelt (Kristallfelsen),
   Kalvik (Windrad, Schüssel, Langhangar), Morrow (Windrad, Wasserturm) — Lage je Seed, eher selten.

## Walker-Modelle (Tripo)

Die sechs Walker und drei Synthese-Maschinen (SPLITTER, SICHEL, MONOLITH) nutzen detaillierte
Modelle aus `assets/walkers/<geometrie>.glb`, der Abwehrstachel `assets/props/tripo-synth/`.
Sie sind in starre Segmente zerlegt (Becken, Torso, Sensoren, Arme, Ober-/Unterschenkel, Füße)
und hängen am Rig des Spiels: Beine per IK auf dem Boden, Torso dreht über dem Becken, Arme
zielen, Trefferzonen und abgeschossene Arme wie bisher. Beinlängen, Hüfthöhe, Kniestellung,
Torso-Drehpunkt und Schultern kommen aus dem Modell; die Waffen-Hardpoints werden aus dem
prozeduralen Plan in die Modellteile übertragen. OBELISK und die Drohne behalten den
prozeduralen Bauplan.

- *Waffen:* Die Waffen sitzen dort, wo das Modell sie hat — Mündungen an den modellierten
  Rohren, Werferrohren und Kristallen (`WALKER_MESH_MOUNTS` in `src/data/walkerMeshes.js`,
  Suche in `render/walker/muzzleFinder.js`). Mehrrohrige Waffen feuern reihum, zusätzliche
  Waffenmodelle entfallen. Die Werksbewaffnung passt zum Aussehen (Tabelle:
  `docs/WALKER-WEAPONS-PLAN.md`), neu sind die RK-30 Rotorkanone (KOLOSS) und die große
  Schwarmsalve (MONOLITH); der GOLIATH trägt weniger Waffen und dafür mehr Panzerung.
- *Optionen → Grafik → Walker-Modelle:* detailliert (Standard) oder klassisch (die alten
  Baupläne), wirkt ab dem nächsten Einsatz.
- *Neu einlesen:* `pip install numpy scipy pillow fast-simplification`, dann
  `python3 tools/import_walkers.py --src <Ordner mit den tripo_convert_*.glb>` (Zuordnung,
  Höhe und Dreiecksbudget in `MODELS`, Korrekturen der Segmentierung in `FIXES`).
- *Debug-Overlay:* „Walker-Modelle detailliert · 9 geladen“ mit Dreiecken je Modell; ein
  fehlerhaftes Modell wird genannt und fällt auf den Bauplan zurück.

**Testanleitung:**

1. *Paradeplatz Brenn-Süd* (Einsatzwahl → System): alle sechs Walker laufen; im Debug-Modus
   (`^`) mit `Shift+F4` frei fliegen. Füße bleiben beim Gehen stehen, KESTREL knickt die Knie
   nach hinten, die Arme hängen an den Schultern.
2. *Synthese-Parade:* SPLITTER, SICHEL, MONOLITH (Modelle, violette Kristalle leuchten),
   OBELISK (Bauplan) und der Abwehrstachel.
3. *Eigener Walker:* Einsatzvorbereitung → Walker durchschalten (Vorschau rechts), im Einsatz
   `Shift+V` Außenkamera.
4. *Treffer:* Duell — die SICHEL beschießen, einen Arm abschießen (fällt ab), Beine zerstören
   (sackt zusammen), Reaktor (Explosion, Wrack dunkel).
5. Optionen → Grafik → Walker-Modelle → klassisch, Einsatz neu starten: alte Modelle.
6. *Waffen:* „Requisiten“ mit `?walker=koloss` (bzw. kestrel, bastion …), Außenkamera `Shift+V`,
   jede Kette abfeuern: Leuchtspur aus beiden Rotorkanonen abwechselnd über die drei Rohre,
   Raketen aus den vier Brustwerfern; KESTREL feuert aus den Kinngeschützen, die FALKE aus den
   Gitterkästen. In der Synthese-Parade (Debug-Modus) feuert nichts — dafür „Duell“ oder
   „Hinterhalt“: SICHEL schießt aus den Klauen, SPLITTER aus Ausleger und Auge; MONOLITH (Wellen-
   Einsatz) feuert Salven aus dem Armwerfer.

## Sounds

Rohdateien in `assets/sounds-raw/`, Aufbereitung mit `python3 tools/prepare_sounds.py`
(braucht numpy und ffmpeg) nach `src/audio/samples/`. Die Samples werden ins Bundle
eingebettet, damit der Offline-Build per `file://` funktioniert. Klang und Mischung:
`src/data/sounds.js`. Herkunft: `CREDITS.md`.

## Zustandsrechnung und Tests

`src/sim/MachineCondition.js` liest DamageModel, WalkerSystems (nur Spieler), Wrack, stationär und
verlorene Arme und liefert Werte von 0 bis 1:

- Reaktor: Struktur, verfügbar, Ausgangsleistung
- Antriebsleistung, Hydraulikleistung
- Bewegungsstabilität, Waffenstabilisierung
- Sensorleistung
- Waffen und Schilde an/aus, Anteil verbliebener Waffen
- kritisch

Der Zustand schreibt nie zurück; Schaden rechnet weiterhin nur das DamageModel. Verbraucher:
Bewegungsgrenzen, Waffen, Schilde, Aufschaltreichweite und Radar, Reaktorstufe im Cockpit,
kritischer Alarm. Bewegungsstabilität und Waffenstabilisierung werden nur angezeigt (Debug-Zeile
„Zustand“); welche Wirkung sie haben, legt Phase 2 fest.

`npm test` startet die Node-Tests in `tests/`, ohne Browser: Zustandswerte, Determinismus,
Schadensrechnung, Trefferzonen, Automatik- und Handstart. Die Browser-Prüfungen (Kampf, Menü,
Steuerung) laufen mit Puppeteer außerhalb des Projekts.

**Testanleitung (Phase 1):**

1. Kalt starten, `Shift+S`: Die Schalter bewegen sich wie bisher, nach gut einer Minute
   Spielzeit ist der Walker bereit (Debug `^`: Zeile „Zustand“ zeigt Antrieb, Sensoren, Waffen an).
2. Im „Duell“ SENSOREN ausschalten: Aufschalten (`T`/`E`) findet kein Ziel mehr. Einschalten:
   nach etwa 3 s geht es wieder.
3. „Duell“, Debug `Shift+F8` mehrfach (schwere Treffer auf den Torso): kritischer Alarm wie bisher.
   Explodiert der Reaktor, feuern die Waffen nicht mehr und die Schilde fallen.
4. Störeffekt: Den hat nur der PZ-9 Partikelwerfer, und den führt seit der Waffenumstellung kein
   Walker ab Werk (wieder möglich mit dem Hangar, Phase C). Geprüft wird er deshalb im Node-Test
   (`tests/machineCondition.test.mjs`).

## Datenpflege

- `src/input/actions.js` – alle Eingabe-Aktionen: Kontexte, Typ, Standardtasten, Gamepad, Achsen;
  danach `node tools/gen-controls.mjs` für die Tabellen in dieser README
- `src/data/config.js` – Engine-Einstellungen und Fahrgefühl (`feel`, `view`, `cockpit`)
- `src/data/walkers.js` – Walker-Werte, Hardpoints, Baukosten, Startdauer-Abweichungen
- `src/data/walkerModels.js` – Baupläne der Walker-Modelle (Profil, Beine, Arme, Aufbauten, Farben)
- `src/data/cockpits.js` – Cockpit-Varianten standard/compact/heavy: Kanzel, Paneele, Sitz, Kabel, Licht
- `src/data/panelLayouts.js` – Schalter, Lampen, Monitore und Hebel auf den Paneelen
- `src/data/weapons.js` – die 10 Waffen (Schaden, Faktoren gegen Schild/Panzer, Feuerrate, Munition, Hitze),
  Lenkarten und Flugmodell der Raketen (`guidance`, `missile`), Ausrüstung (Zielkapsel)
- `src/data/combat.js` – Schadensstufen, Schildverschiebung, Energiepuffer, Hitze, Folgen, Aufschaltkegel,
  Zielkapsel-Konvergenz, Pause der Zielnachführung
- `src/data/config.js` → `hitFeedback` (Treffer im Cockpit), `missileCam` (Raketenkamera)
- `src/data/missions.js` – Missionen; `hills` legt zusätzliche Hügel an, `emitting` lässt eine Einheit strahlen
- `src/data/sounds.js` – Sound-Ereignisse, Loops, Mischpult, Bewegungs- und Systemsounds
- `src/data/systems.js` – Startprozedur: Werte, Checklisten, Automatik-Skript, Funksprüche
- `src/data/theaters.js` – Schauplätze: Geländeform, Farbpalette, Himmel, Nebel, Features, Bodenmaske,
  Streuobjekte, automatische Bauwerke, typisches Wetter, Schwerkraft
- `src/data/surfaces.js` – Bodenarten und ihre Wirkung, Flüssigkeitsflächen
- `src/data/structures.js` – Bauwerke (Teile, Panzerung, Kollision, Zerstörung), Streuobjekt-Modelle, Sites
- `src/data/weather.js` – Wetter: Nebel, Partikel, Scheibe, Wind, Wirkung auf Kamera und Aufschaltung
- `config.js` → `scatter` (Sichtweiten, Instanzen), `area` (Zaun)
- `src/data/lighting.js` – Tageszeiten
- `src/data/missions.js` – Einsätze; `forces` (Gruppen, Patrouillen, Geschütze, Verstärkung,
  Wellen, siehe `src/ai/AIDirector.js`) und `script` (Aufträge, siehe `src/states/MissionScript.js`)
- `src/data/enemies.js` – Synthese-Einheiten (Walker-Format plus `ai`, `salvage`, `faction`),
  Gebäude-Geschütze `GUNS`; `src/data/enemyModels.js` – ihre Baupläne
- `src/data/difficulty.js` – die fünf Schwierigkeitsgrade
- `src/data/combat.js` → `consequences.disruptSensor`, `condition` – Kennwerte der Zustandsrechnung
- `src/data/textures.js` – Detailtexturen (Datei, Kachelgröße, Quelle), Lagen, Materialgruppen
- `src/data/walkerMeshes.js` – detaillierte Walker-Modelle (Geometrie-ID → Tripo-Datei), Quelle
- `src/data/props.js` – externe Modelle (Paket, Datei, Maßstab, Kollision, Panzerung), Farbregeln
  der Materialgruppen; Prüfung mit `npm run check-credits`
