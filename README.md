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
| Menü: bestätigen | `Enter` / `Num Enter` | A | Menü |
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

**Zielkapsel.** BASTION (LA2) und KESTREL (RA) tragen ab Werk eine ZK-1. Mit `Tab` wird die
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

## Startprozedur

Reihenfolge (Checkliste im Spiel): Batterie → Hilfsaggregat START halten → KÜHLPUMPEN (ein Schalter, Pumpe 2 läuft automatisch nach) →
BETRIEBSART VORH bis VORHEIZ OK → Zündkappe auf, ZÜND → Hauptbus REAKT → Hydraulik →
Monitore TEST → Gyro ausrichten → Sensoren → Schilde → Waffen scharf → Beinsperre LÖSEN →
BETRIEBSART BETR für volle Leistung.

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

## Sounds

Rohdateien in `assets/sounds-raw/`, Aufbereitung mit `python3 tools/prepare_sounds.py`
(braucht numpy und ffmpeg) nach `src/audio/samples/`. Die Samples werden ins Bundle
eingebettet, damit der Offline-Build per `file://` funktioniert. Klang und Mischung:
`src/data/sounds.js`. Herkunft: `CREDITS.md`.

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
- `src/data/missions.js` – Einsätze
- `src/data/inputBindings.js` – Tastenbelegung; Overrides per localStorage-Key `steelwarden:bindings`
