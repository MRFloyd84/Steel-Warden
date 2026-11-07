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
- `?debug=1` – Debug-Overlay sofort anzeigen
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

Fahrplan für die nächsten Phasen inklusive Stützpunkt, Bergung, Funk, Radar und Missionen:
`docs/ROADMAP.md`.

## Bedienung im Cockpit

- Rechte Maustaste halten oder `V`: freier Blick mit Cockpit-Cursor; Maus über den Bildrand
  hinaus dreht den Kopf
- Linksklick (oder `F`, Pad A): Schalter umlegen, Schutzkappe öffnen, offene Kappe schließen
- Drehregler: linke/rechte Hälfte anklicken oder Mausrad
- Taster und Lampen: gedrückt halten (Lampentest); Schubhebel: anklicken und ziehen
- `C` oder Klick aufs Klemmbrett (links an der Wand): Checkliste holen und weglegen
- `Shift+S`: automatische Startprozedur (Schalter bewegen sich sichtbar)
- `K`: Außenkamera an/aus (rechte Maustaste/`V` kreist dann um den Walker), `F7`: Debug-Freiflug
- Walker im Menü wählen oder per URL `?walker=kestrel|marder|bastion|halberd|goliath|koloss`

## Kampf

| Taste | Wirkung |
|---|---|
| Linke Maustaste | aktive Feuerkette feuern (Maus muss gefangen sein, nicht im freien Blick) |
| `1`–`4` | Waffengruppe feuern |
| `R` | nächste Feuerkette (3 ab Werk, Anzeige auf dem Waffenmonitor) |
| `G` | Notfallkette: alle Waffen |
| `T` / `Shift+T` | Ziel unter dem Fadenkreuz aufschalten, sonst das nächste im Torso-Kegel / durchschalten |
| `,` / `.` | Schildenergie Richtung Heck / Front verschieben (je ±2 Stufen) |
| `B` | Lenkart weiterschalten (Drehschalter LENKUNG: UNGEL · AKTIV · HALB · A-RAD · OPT) |
| `Tab` | Zielkapsel: Komponente am Ziel wählen (Torso, Arm L, Arm R, Beine, Sensoren) |
| `H` | Zielnachführung ein/aus (Schalter ZIELNACHF., Lampe NACHF.) |
| `M` | Raketenkamera ein/aus (Taster KAM) |
| Gamepad | RT feuern, LT nächste Kette |
| `F8` / `Shift+F8` | Debug: Treffer auf mich (zufällig / schwer, Seiten der Reihe nach) |
| `F9` / `Shift+F9` | Debug: nächster Gegner schaltet auf und feuert / Ziel strahlt (Anti-Radar) ein/aus |

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

1. *Schild gegen Panzer:* Marder (190 m) aufschalten (`T`), 2–3 s Gruppe 1 (Laser) — die
   Frontschilde brechen schnell zusammen, danach Panzerschaden. Den laufenden Marder (250 m)
   mit Gruppe 2 (Autokanone, Schrot) beschießen — die Schilde halten deutlich länger.
   Zielmonitor und `F3` zeigen Schilde und Komponenten.
2. *Beine abschießen:* auf den KESTREL (110 m) zufahren und auf die Beine zielen. Bei „schwer“
   wird er langsamer, bei „zerstört“ kniet er ab und raucht (Zielmonitor: BEWEGUNGSUNFÄHIG).
3. *Arm abschießen:* einen Walker von der Seite auf den Arm beschießen. Der Arm fällt ab, die
   Waffe bleibt mit blinkendem Marker liegen.
4. *Überhitzen und neu starten:* `G` gedrückt halten. HITZE leuchtet, der Hitzebalken auf dem
   Systemmonitor steigt, nach etwa 9 s (BASTION) folgt die Notabschaltung. Danach Neustart
   laut Klemmbrett (`C`): Pumpen prüfen, VORH, Zündkappe zu/auf, ZÜND, Hauptbus REAKT, BETR.

**Testanleitung A2b** (Schießstand, `?mission=range&start=hot`; der Hügel liegt links vorn,
dahinter steht verdeckt ein MARDER; GOLIATH (560 m, stehend) und der laufende BASTION strahlen):

1. *Ungelenkt:* `B` bis UNGEL, den laufenden MARDER (250 m) aufschalten, `3` — die Raketen
   fliegen geradeaus, gegen das bewegte Ziel geht das meiste daneben.
2. *Aktiv:* `B` auf AKTIV, MARDER mit `T` aufschalten und im Kegel halten: Pieptöne werden
   schneller, dann Dauerton und roter Ring. `M` (Kamera an), `3` feuern und sofort den Torso
   wegdrehen — die HABICHT treffen trotzdem, die Kamera zeigt AUFG. Vorher (ohne volle
   Aufschaltung) zeigt der Waffenmonitor AUFSCHALT. und es startet nichts.
3. *Halbaktiv:* `B` auf HALB, aufschalten, feuern und das Ziel im Kegel halten → Treffer mit
   mehr Schaden. Zweiter Versuch: nach dem Start wegdrehen → die Raketen verlieren das Ziel
   und schlagen im Gelände ein.
4. *Anti-Radar:* `B` auf A-RAD, ohne Aufschaltung grob Richtung GOLIATH (links, 560 m) zielen,
   `3` — die Raketen schwenken auf ihn ein. `Shift+F9` macht das aufgeschaltete Ziel zum
   Strahler oder schaltet es ab (`F3` zeigt die Strahler).
5. *Optisch hinter den Hügel:* Walker HALBERD (`?walker=halberd`), `B` auf OPT. Knapp über
   den Hügel zielen, `3` gedrückt halten: der Zielmonitor schaltet auf die Raketenkamera
   (H = Höhe über Grund, BRENN = Restbrenndauer). Mit der Maus über den Hügelkamm lenken, dann
   auf den verdeckten MARDER stürzen. Einschlag → Weißrauschen, danach wieder Zielmonitor.
   Loslassen der Feuertaste: die Rakete fliegt geradeaus weiter.
6. *Beine mit der Zielkapsel:* BASTION, MARDER (190 m) aufschalten, `Tab` bis BEINE
   (Zielmonitor rahmt BEINE ein, im HUD sitzt der kleine Rahmen auf den Beinen). Fadenkreuz
   grob auf den Walker, `2` halten — die Autokanonen- und Schrot-Treffer laufen auf die Beine
   zusammen, bis er abkniet (im Test nach etwa 25 s). Mit einem Walker ohne Kapsel (MARDER)
   meldet `Tab` „Keine Zielkapsel an Bord“.
7. *Treffer auf allen vier Seiten:* `Shift+F8` viermal (vorn, rechts, hinten, links): zuerst
   blaues Leuchten mit Brummen auf der jeweiligen Seite (Schild), sobald der Schild leer ist
   Kopfstoß, Funken aus dem Paneel der Seite und Monitorflackern. Weiter `Shift+F8` bis der
   Torso schwer ist: Risse in der Scheibe, Rauch zieht auf, bei kritischem Reaktor rotes
   Notlicht, Hupe, WARNUNG blinkt. Noch mehr Treffer zerstören den Reaktor (der Walker ist dann
   ein Wrack; ein Missionsende dafür kommt mit Phase B).
8. *Monitorausfall:* `F8` mehrmals (ab 20 Schaden fällt mit 18 % ein Monitor aus) — oder
   schneller über die Konsole `steelWarden.states.current.hits.breakMonitor('mfdRadar','noise')`.
   Ein Monitor zeigt Schnee oder bleibt schwarz, der Systemmonitor meldet ANZEIGE DEFEKT,
   MONITORE TEST zeigt BILDRÖHRE / ANZEIGEN … FEHLER.
9. *Feindliche Aufschaltung:* `F9`: der nächste Gegner schaltet auf (schnelles Piepen, RAKETE
   blinkt, roter Keil auf dem Radar), nach 3,5 s startet er eine Rakete (Dauerton, RAKETE
   leuchtet), die einschlägt.
10. *Zielnachführung:* MARDER aufschalten, `H` (Lampe NACHF.): der Torso folgt. Mit der Maus
   gegensteuern — kurz Vorrang, dann zieht die Nachführung zurück. Mit den Beinen wegdrehen,
   bis das Ziel hinter dem Schwenkbereich liegt: Schalter fällt auf AUS, Lampe aus, Funkspruch.

## Welt (Teil 2)

**Bodenarten** (Werte in `src/data/surfaces.js`, `F3` zeigt die Bodenart unter dem Walker):

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
   Streifen entlanglaufen und Tempo (Schubanzeige/`F3`) und Kerntemperatur (Systemmonitor)
   vergleichen. Im Wasser fällt die Temperatur, in Lava steigt sie, und der Schadensmonitor
   zeigt die Beine sinken. Auf dem Eis-Streifen (Navpunkt EIS) läuft der KESTREL drüber, der
   KOLOSS bricht mit Krachen ein, steckt 4 s fest und watet dann weiter.
2. *Bauwerk zerstören:* „Testgelände Brenn-Süd“, auf den Stützpunkt 400 m voraus zugehen, `G`
   auf ein Gebäude halten. Erst Rauch und dunklere, verbogene Teile, dann Trümmer mit Feuer
   bzw. Explosion (Generator). Danach kann man über die Trümmer laufen; vorher hält das Gebäude
   den Walker auf. `F3` zählt Bauwerke und Trümmer.
3. *Optische Rakete um den Felsbogen:* „Testgelände Canyonwüste Tessar“ (HALBERD), für klare
   Sicht `?mission=test-canyon&weather=clear`. Der MARDER hinter dem rechten Pfeiler lässt sich
   nicht aufschalten. `B` auf OPT, leicht links vom rechten Pfeiler durch den Bogen zielen, `3`
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

1. *Korrekter Start:* Checkliste (`C`) Punkt für Punkt abarbeiten. Am Ende sind alle
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
