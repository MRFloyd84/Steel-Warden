# Fix: Gegner greifen während der Startprozedur an — Plan und Umsetzung

## Ereignis `deploy`
- Bedingung: Beinsperre gelöst **und** Bus auf Reaktorstrom (`flags.legsReleased`,
  `power.source === 'main'`). Geprüft in `MissionState.checkDeploy()` je Simulationsschritt.
- Folgen: Bus-Ereignis `mission:deploy`, `AIDirector.deploy()`, Hangartor öffnet,
  Missionsuhr läuft (`missionTime`, HUD „T+mm:ss“, Nachbesprechung), Funkspruch
  „Freigabe zum Ausrücken, erster Navpunkt, Kurs, Entfernung“, Alarmlampe aus.
- `hot` (`?start=hot` oder `startup.mode: 'hot'`): Walker startet bereit, `deploy` im ersten Schritt.

## Startphase je Mission (`src/states/missionStartup.js`)
`startup: { mode, location, safeRadius, scrambleDelay }`, Standard `safe` / `dropZone` / 1500 m.
- **safe:** alle Gruppen `activate: 'onDeploy'` — ruhend: kein `step()` (keine Wahrnehmung,
  keine Entscheidung, kein Feuer), `drive()` liefert Stillstand, Lärm wird nicht gehört,
  Geschütze stumm, Verstärkung und Wellen laufen nicht.
- **scramble:** Gruppen `immediate`, Geschütze aktiv. Nach `scrambleDelay` s bekommen alle
  wachen Einheiten den Startort als dauerhaften Alarm (sie kennen den Ort, nicht den Walker)
  und rücken an. Alarmfunkspruch beim Start, Hauptwarnlampe blinkt bis `deploy`,
  Startprozedur `simple` (`?startmode=` überschreibt).
- **Aktivierung:** `activate: 'onDeploy' | 'immediate' | 'onTrigger:<id>'`, Trigger
  `mission.triggers: [{ id, type: 'area', at, radius } | { id, type: 'time', after }]`
  (ab `deploy`). Jäger-Gruppen (`role: 'hunt'`) erfahren die Spielerposition beim Wecken.

## Startort
- **hangar:** Site `homeBase` (Hangar `hangarBay` mit zwei Schiebetorhälften, Lager,
  Generator, Radarmast, Relais, Landeplatz), gedreht auf die Startrichtung. Das Tor
  (`world/HangarDoor.js`) ist bis `deploy` zu: Kollision und Sichtsperre; danach Hupe,
  Torgeräusch, gelbe Rundumleuchten, die Hälften gleiten 9 s zur Seite, ab 55 % ist der
  Durchgang frei (Kollision weg, Navigationsraster neu bewertet).
- **dropZone:** Site `dropZone` mit Bodenmarkierung (Ring, Kreuz, Leuchtpfosten).

## Schutzzone und Validierung
- `validateMission()` prüft Einheiten-Positionen, Patrouillenpunkte, Verstärkungs- und
  Wellen-Absetzpunkte gegen `safeRadius`, dazu unbekannte Modi/Orte/Trigger.
  Zielattrappen (`mission.spawns`, ohne KI) sind ausgenommen.
- Aufruf vor dem Laden (Menü und `?mission=`): Fehler → Klartext-Meldung im Menü, kein Start.
- Navigationsraster: `safeZone` ist für Patrouillen-Pfade (Ruhe/Patrouille) gesperrt,
  für Gefechte offen.

## Signatur (`data/systems.js → signature`)
| Zustand | Sicht-Faktor | Ortung ohne Sicht |
|---|---|---|
| kalt / Batterie | ×0,35 | – |
| Hilfsaggregat | ×0,5 | 350 m |
| Reaktor läuft | ×1,0 | 1100 m |
| + SENSOREN an | | `ai.detectEmitting` (1400–1600 m) |

`MissionCombat` setzt `player.signature` je Schritt, `Perception.look()` rechnet damit.
`emitting` gilt nur, wenn der Bus Strom hat.

## Ergebnisse (headless)
| Test | Ergebnis |
|---|---|
| Erster Einsatz, 150 s nichts tun | Patrouille steht unverändert bei BRAVO (ruhend), Uhr „STARTPHASE“ |
| danach hochfahren | `deploy` → Tor öffnet (9 s), Funkspruch „Kurs 000, 600 m“, Patrouille läuft los, T+ zählt |
| Alarmstart, Automatik sofort | Reaktor ab ~35 s, Späher geortet ab 63 s auf 1477 m, greifen den Hangar an |
| Alarmstart, Automatik erst bei 70 s | Späher rücken ab 45 s an, erste Ortung erst bei 106 s auf 570 m (Reaktorzündung), suchen am Hangar |
| `?mission=test-invalid` | Menü mit Klartext: drei Verstöße gegen die Schutzzone, Enter schließt |
