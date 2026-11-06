# Phase A2b – Plan

## Module

| Datei | Aufgabe |
|---|---|
| `data/weapons.js` | Lenkarten je Werfer (`guidance: [...]`), Flugmodell (`missile: {...}`), Ausrüstung `targetPod` |
| `data/config.js` | `hitFeedback` (Stärken/Dauern der Cockpit-Reaktionen), `missileCam` |
| `data/panelLayouts.js` | Drehschalter LENKUNG, Schalter ZIELNACHF. + Lampe NACHF., Taster KAMERA |
| `sim/Guidance.js` | Lenklogik je Rakete: Zielrichtung je Lenkart, Suchkopfkegel, Verlust des Ziels |
| `sim/Projectiles.js` | Raketen-Flugmodell: Startgeschwindigkeit, Schub bis Höchstgeschwindigkeit, Brenndauer, danach ballistisch; Wendigkeit in °/s |
| `sim/WeaponSystem.js` | Ausrüstung feuert nicht; Lenkraketen nur mit gültiger Aufschaltung |
| `sim/Targeting.js` | gewählte Komponente (Zielkapsel) |
| `render/MissileCamera.js` | zweiter Render-Pass 160×120 aus der Raketennase, Auslesen in ein Canvas |
| `render/cockpit/displays/MissileCamDisplay.js` | Kamerabild grün, Rauschen, Fadenkreuz, Höhe, Brenndauer, AUFG. |
| `render/cockpit/CrtScreen.js` | Monitor-Override (Kamera statt Ziel) und Modus Bildrauschen |
| `states/combat/MissileControl.js` | Lenkart-Wahl, Startbedingungen, Startparameter, halbaktive Beleuchtung, optische Steuerung, Aufschalttöne |
| `states/combat/MissileCamView.js` | welche Rakete die Kamera zeigt, auf welchem Monitor; KAM-Taster, Rauschen |
| `states/combat/TargetTracking.js` | Zielnachführung des Torsos |
| `render/cockpit/CockpitDamageFx.js` | Schildleuchten, Funken, Risse, Rauch, Notlicht im Cockpit |
| `render/terrain/TerrainSampler.js` | zusätzliche Hügel aus den Missionsdaten (`hills`) |
| `states/combat/CockpitHits.js` | Treffer auf den Spieler: Schildleuchten, Kamerastoß, Funken, Monitorflackern, Risse, Rauch, Monitorausfall, kritischer Schaden, feindliche Aufschaltung, Debugtasten |
| `render/PilotView.js` | Kamerastoß (Versatz und Drehung, Feder) |
| `render/cockpit/Cockpit.js` | Trefferlicht, Funken- und Rauchpartikel, Dunst, Risse in der Scheibe |
| `sim/WalkerSystems.js` | Monitorzustand (ok/Rauschen/aus) im Systemtest, Flags `missileWarning`, `criticalDamage` |

## Lenklogik (`sim/Guidance.js`)

Jede Rakete hat `mode` und ein `seekerCone` (Halbwinkel um die Flugrichtung).

| Lenkart | Start | Flug |
|---|---|---|
| `dumb` | immer | geradeaus, nach Brennschluss ballistisch |
| `active` | nur mit voller Aufschaltung (`lockTime` der Waffe) | steuert Ziel (bzw. gewählte Komponente) an, solange es im eigenen Suchkopfkegel bleibt; der Spieler darf wegsehen |
| `semiActive` | nur mit voller Aufschaltung, Schaden × `semiActiveBonus` | gelenkt nur, solange das Ziel aufgeschaltet und im Torso-Kegel des Spielers ist; einmal verloren → geradeaus |
| `antiRadar` | ohne Aufschaltung | sucht die nächste Einheit mit `emitting` im Torso-Kegel, später im Suchkopfkegel (alle 0,25 s) |
| `optical` | ohne Aufschaltung | der Spieler lenkt mit Maus/Stick, solange der Feuerknopf gehalten wird; sonst geradeaus |

Wendigkeit: Die Flugrichtung dreht höchstens `turnRate` °/s zur Wunschrichtung. Kann ein Werfer
die gewählte Lenkart nicht, schießt er ungelenkt (Anzeige auf dem Waffenmonitor).

## Raketenkamera

`MissileCamera` rendert die Weltszene 15× pro Sekunde in ein 160×120-Renderziel
(Kamera an der Raketennase, Blick in Flugrichtung), liest die Pixel aus und zeichnet sie in
ein Canvas. Der Zielmonitor (bei Cockpits ohne Zielmonitor der Radarmonitor) zeigt dieses Bild
statt seiner Seite, wenn die Taste KAMERA aktiv ist oder eine optische Rakete fliegt.
Einschlag/Absturz → 0,6 s Weißrauschen → zurück.

## Datenformat

```js
'habicht-8': { …, guidance: ['dumb', 'active', 'semiActive', 'antiRadar'], lockTime: 2,
  missile: { launchSpeed: 55, thrust: 120, maxSpeed: 200, burnTime: 4.5, turnRate: 75,
             seekerCone: 50, semiActiveBonus: 1.3 } }
speer: { …, guidance: ['dumb', 'active', 'semiActive', 'optical'], lockTime: 2.5,
  missile: { launchSpeed: 40, thrust: 70, maxSpeed: 150, burnTime: 11, turnRate: 40,
             seekerCone: 40, semiActiveBonus: 1.25, loft: true } }
'target-pod': { id: 'target-pod', kind: 'equipment', type: 'universal', size: 'S', weight: 1 }
```

Werks-Bewaffnung: BASTION trägt die Zielkapsel auf LA2 (statt LUX-12), KESTREL auf RA
(statt SK-6).

## Ergebnis der Tests (headless, festes Zeitraster)

| Fall | Ergebnis |
|---|---|
| UNGEL., HABICHT auf laufenden MARDER (250 m) | 0/8 Treffer |
| AKTIV, Torso nach dem Start weggedreht | 8/8 Treffer |
| HALBAKTIV, Aufschaltung gehalten | 8/8 Treffer |
| HALBAKTIV, nach dem Start weggedreht | 0/8 (Ziel verloren, Boden) |
| ANTIRAD, ohne Aufschaltung, 11° neben GOLIATH | 8/8 Treffer |
| AKTIV ohne Aufschaltung | hält: AUFSCHALT. |
| OPTISCH (SPEER) hinter den Hügel | Treffer am verdeckten MARDER nach 3,5 s, Torso unbewegt |
| Zielkapsel BEINE, MARDER 190 m, Gruppe 2 | 68 von 73 Treffern auf den Beinen, kniet nach 24,5 s |
| Zielnachführung | Torso auf 0,1° am laufenden Ziel; hinter dem Schwenkbereich Schalter AUS |
| Feindliche Aufschaltung F9 | 3,5 s ERFASST (Lampe blinkt), dann Rakete (Lampe an), Einschlag nach ~4,5 s |
