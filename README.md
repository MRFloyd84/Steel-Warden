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

## Startprozedur

Reihenfolge (Checkliste im Spiel): Batterie → Hilfsaggregat START halten → Kühlpumpen 1+2 →
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
2. *Zündung ohne Kühlung:* Batterie, Hilfsaggregat, VORH — Pumpen auslassen — zünden.
   Die Kerntemperatur steigt über 700 °C (HITZE, WARNUNG, Alarm), bei 900 °C Notabschaltung:
   BETRIEBSART springt auf AUS, Hauptbus auf HILFS, Hilfsaggregat startet von selbst.
3. *Neustart:* nach der Notabschaltung Pumpen ein, abkühlen lassen, VORH bis VORHEIZ OK.
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
- `src/data/sounds.js` – Sound-Ereignisse, Loops, Mischpult, Bewegungs- und Systemsounds
- `src/data/systems.js` – Startprozedur: Werte, Checklisten, Automatik-Skript, Funksprüche
- `src/data/theaters.js` – Schauplätze: Geländeform, Farbpalette, Himmel, Nebel
- `src/data/lighting.js` – Tageszeiten
- `src/data/missions.js` – Einsätze
- `src/data/inputBindings.js` – Tastenbelegung; Overrides per localStorage-Key `steelwarden:bindings`
