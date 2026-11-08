# STEEL WARDEN – Fahrplan

Stand: nach 0.5.0 Phase 2 (Bewegung und Systemintegration), davor Phase 1 (Architektur- und Zustandsaudit, MachineCondition), davor Walker-Modelle aus Tripo, davor Detailtexturen und externe Umgebungsmodelle, davor Teil 2 (Menüsystem), Startphase-Fix, A3 (Synthese-Gegner und KI), Teil 2 (Karten-Erweiterung) und A2b. Dieses Dokument führt das Grundkonzept,
die Cockpit-Erweiterung, das Missionsdokument und die Ergänzungen (Stützpunkt, Bergung,
Funk, Radar, Kampf, Übung) zusammen.

## Getroffene Entscheidungen

| Thema | Entscheidung |
|---|---|
| Reihenfolge | Erst die Kampfgrundlage (Walker, Waffen, Schaden, Gegner), dann Missionen |
| Wingmen-Befehle | 7 Einzelbefehle mit eigener Taste plus Funkmenü: Formation · Mein Ziel angreifen · Freies Feuer · Navpunkt anlaufen · Stellung halten · Zurückfallen/zu mir · Beine zielen. Keine Taktikkarte mit Einzelbefehlen. |
| Missionsende | Immer per angeforderter Extraktion. Nach den Hauptzielen läuft die Mission weiter (Bergen, Verstärkung rückt an), bis der Spieler die Extraktion anfordert und den Punkt erreicht. |
| Feuerkombinationen | Ein System: frei belegbare Feuerketten, ab Werk 3 vorbelegt, per Taste durchschaltbar, plus Notfall-Kette „alle Waffen“ auf eigener Taste. Waffengruppen 1–4 bleiben. |
| Sounds | Hybrid: eingebettete Samples plus prozedurale Klänge |

## Phasen

### A – Kampfgrundlage
1. ✅ **Walker-Builder und 6 Walker** (Erweiterung Schritt 4): prozedurale Low-Poly-Modelle,
   Laufanimation mit Fuß-IK, Cockpit-Varianten compact/standard/heavy, Außenkamera.
   Modellteile sind nach Schadenskomponenten markiert (Trefferzonen).
   Walker-Daten enthalten bereits Baukosten in Schrott und die Bauzeit in Missionen.
2. **Waffen und Schaden** (Erweiterung Schritt 5, Grundkonzept Phase 4):
   - **A2a ✅** (erledigt):
     - ✅ 10 Waffen, Werks-Bewaffnung je Walker mit Prüfung, Waffenmodelle an den Hardpoints,
       Armwaffen schwenken im Rahmen von `arc`.
     - ✅ Geschosse, Strahl (LUX-40), Streuung, Munition und Nachladen, Aufladen (SR-3, IMP-2),
       Energiepuffer aus dem Reaktor, Hitze in der Wärmebilanz des Reaktors.
     - ✅ Schaden je Typ: Energie stark gegen Schilde, ballistisch stark gegen Panzerung und
       schwach gegen Schilde, Raketen schwach gegen geladene Schilde.
     - ✅ Schilde pro Seite, Energie per Taste zwischen Front und Heck verschiebbar.
     - ✅ Komponentenschaden in 5 Stufen mit Folgen: Arm ab, Beine schwer/zerstört, Sensoren,
       Reaktorexplosion; Zerstörungsart `legs` / `weaponMount` / `reactor` festgehalten,
       abgeschossene Waffen als Marker im Gelände.
     - ✅ Feuerketten (3 ab Werk, Salve oder Folge), Gruppen 1–4, Notfallkette „alle Waffen“.
     - ✅ Zielaufschaltung im Torso-Kegel, Zielmonitor mit Drahtgitter, Zielrahmen.
     - ✅ Neustart nach Überhitzung im Kampf (Notabschaltung aus Schritt 3).
     - ✅ Testmission „Schießstand“ (`?mission=range&start=hot`).
   - **A2b ✅** (erledigt, Plan in `docs/A2b-PLAN.md`):
     - ✅ Raketen-Flugmodell (Schub, Brenndauer, Wendigkeit, ballistisch, Absturz, Rauchband)
       und Lenkarten ungelenkt / aktiv / halbaktiv / Anti-Radar / optisch, Wahl per Drehschalter.
     - ✅ Raketenkamera (eigener Render-Pass 160×120) auf dem Zielmonitor, optische Lenkung mit
       der Maus, Weißrauschen beim Einschlag.
     - ✅ Zielkapsel als Ausrüstung: Komponentenwahl am Ziel (Tab), Konvergenz der Geschosse,
       Lenkraketen suchen die Komponente.
     - ✅ Zielnachführung des Torsos (ZIELNACHF.).
     - ✅ Cockpit-Reaktionen auf Treffer (Schild, Panzer, bleibende Schäden, Monitorausfall,
       kritischer Schaden, Rauch), Warnungen bei feindlicher Aufschaltung und Rakete im Anflug.
     - ✅ Schießstand mit Hügel, verdecktem Ziel und zwei strahlenden Zielen, Debugtasten.
     - Offen für A3/A4: Gegner nutzen Lenkraketen selbst (KI), Unit-Flag `emitting` kommt dann
       aus dem Radar-Modus aktiv/passiv.
   - **Teil 2 Karten-Erweiterung ✅** (Plan in `docs/MAP-PLAN.md`):
     - ✅ Feature-Generatoren je Theater (deterministisch, Seed), Bodenmaske `surfaceAt` mit
       Wirkung auf Tempo, Reaktor, Beine, Eis-Einbruch und Schrittklang; Wasser-/Lavaflächen.
     - ✅ Bauwerke mit Trefferzonen, Kollision, Zerstörungsstufen, Sichtlinie, Bus-Ereignis
       `world:structure`; Sites mit eingeebnetem Gelände; Streuobjekte per Instancing.
     - ✅ Kalvik, Ashmar, Brenn-Süd, Selene-7 ausgebaut; neu Morrow, Tessar, Synthese-Kernwelt.
     - ✅ Wetter (6 Arten) mit Scheibenbelag, Sicht, Raketenkamera, Aufschaltung.
     - ✅ Einsatzgebiet: Radarlinie, Zaun, Funkwarnung (Konsequenzen in Phase B).
     - ✅ 7 Schauplatz-Testmissionen und „Bodenproben“.
     - Offen: Karte (Kartenansicht gibt es noch nicht; die Grenzlinie kommt dort hinein),
       Sprungdüsen (Schwerkraftfaktor ist vorbereitet), Bauwerke auf dem Radar (A4).
   - **Steuerung aufgeräumt ✅:** Aktionsregister `src/input/actions.js` mit Kontexten,
     Belegungsoberfläche (Tastatur, Maus, Gamepad/HOTAS, Profile, Export/Import), Funkmenü
     (vorbereitet für die 7 Wingmen-Befehle), Tastenhilfe, README-Generator `tools/gen-controls.mjs`.
     Feld `secondaryChain` je Walker (rechte Maustaste); im Hangar einstellbar, sobald es ihn gibt.
     Offen: Sprungdüsen (Leertaste ist belegt, KESTREL hat Daten, Physik fehlt), Radar R/Shift+R ab A4.
3. **Synthese-Gegner und KI ✅** (Grundkonzept Phase 5, Plan in `docs/A3-PLAN.md`):
   - ✅ Späher, Jäger, Brecher, Belagerer als Synthese-Walker (kristallin, asymmetrisch,
     schwebende Panzersegmente, Leuchtadern, Insektengang), 6 Synthese-Waffen inkl.
     ballistischem Mörser; Drohne als Datenplatzhalter. Abwehrstachel und Geschützturm mit KI.
   - ✅ Felder `ai { profile, preferredRange, aggression, morale, flankChance, sight, … }` und
     `salvage { scrap, weaponDropChance }`.
   - ✅ Wahrnehmung: Kegel, Sichtlinie, Licht/Wetter, Ortung strahlender Ziele (vorerst
     Schalter SENSOREN), Lärm, Gruppennetz mit Verzögerung, verblassendes Gedächtnis.
   - ✅ Zustandsmaschine Ruhe/Patrouille → Untersuchen → Angriff ⇄ Flankieren/Deckung →
     Rückzug, Verstärkung rufen, Suchen; Vorhalt/Streuung/Reaktion je Schwierigkeit,
     Fokusfeuer, echte Aufschaltung, kniend weiterkämpfen.
   - ✅ Navigationsraster mit A*, Glättung, Budget; Steuerung über Schub und Drehen.
   - ✅ Verstärkung (Rand oder Landefähre, Verzögerung je Mission), Wellen, Formation, Rollen.
   - ✅ 5 Schwierigkeitsgrade im Menü. Wracks mit Zerstörungsart und Bergungswert,
     Reaktorexplosion mit Flächenschaden und Trümmern, verblassende Adern.
   - ✅ KI-Debugansicht, Einfrieren, Gruppe absetzen. Testmissionen Duell, Hinterhalt,
     Stellung, Welle und Meilenstein „Erster Einsatz“ mit einfacher Erfolgsprüfung.
   - Offen: Flugmodell für Drohnen; Reaktion auf aktives/passives Radar statt SENSOREN-Schalter
     (A4); Bergung der Wracks und Waffen (C); Wingmen als Verbündete (B); Bauwerke als
     Deckung nur über Gebäude, nicht über Geländekanten.
   - ✅ Fix Startphase: Ereignis `deploy`, Gegner ruhen bis zum Ausrücken (`safe`), Alarmstart
     (`scramble`) als Ausnahme, Startort Hangar mit Tor oder Absetzpunkt, Schutzzone mit
     Validierung und Patrouillen-Sperre im Navigationsraster, Signatur je Systemzustand
     (Grundlage für A4), Gruppen-Aktivierung über `onDeploy`/`immediate`/Trigger
     (Bereich, Zeit), Testmission „Alarmstart“.
   - ✅ **Menüsystem (Teil 2):** Bildschirm-Stapel (`ui/menu/`), Titel über 3D-Szene,
     Einsatzwahl mit Reitern und Übersichtskarte, Einsatzvorbereitung mit Walker-Vorschau und
     Übungsoptionen, Ladebildschirm, Optionen mit sofortiger Wirkung, Pausenmenü,
     Nachbesprechung (wird in Phase B ausgebaut). Offen: Kampagne (C), Hangar-Bewaffnung (C),
     Musik (Regler vorhanden, noch keine Stücke).
   - ✅ **Detailtexturen und externe Umgebungsmodelle:** Graustufen-Detailtexturen (128 px,
     CC0) je Bodenart im Geländeshader (Mischung nach Bodenmaske und Hangneigung, zweite Lage
     gegen Kachelmuster, Drehung je Chunk) und je Materialgruppe auf Objekten; Farbe bleibt aus der
     Palette. 32 CC0-Modelle (Kenney, Quaternius) als Bauwerke und Streuobjekte mit verworfenen
     Materialien, Platzhalter bei fehlenden Dateien, Credits-Prüfung. Normal-/Rauheitskarten
     bewusst nicht.
   - ✅ **0.5.0 Phase 2 – Bewegung:** Antriebsanteil der ENERGIE-Verteilung (neue Stellung
     ANTRIEB), Gyro auf Torso, Gang, Streuung und Rückstoß, Masse auf Federn, Drehträgheit und
     Bremsen, Hinken bei Beinschaden, Rückstoß schwerer Waffen (`docs/MOTION-0.5.0.md`).
   - ✅ **0.5.0 Phase 1 – Zustandsaudit:** `MachineCondition` als einzige Übersetzung von
     Schaden und Maschinenzustand in Funktionswerte; Widersprüche behoben (zerstörter Reaktor,
     Aufschalten ohne Sensoren, Störeffekt), Trefferzonen-Breitphase, Node-Tests (`npm test`).
     Offen für Phase 2: Wirkung von Gyro/Stabilität auf Streuung und Gang, Antriebsanteil der
     ENERGIE-Verteilung, Zustand der KI-Einheiten als Grundlage für KI-Entscheidungen.
   - ✅ **Walker-Modelle aus Tripo:** sechs Walker, SPLITTER, SICHEL, MONOLITH und Abwehrstachel
     als detaillierte Modelle (starre Segmente auf dem eigenen Rig, Maße aus dem Modell),
     Umschalter detailliert/klassisch; Waffen an den modellierten Rohren, Werksbewaffnung
     passend zum Aussehen (RK-30, große Schwarmsalve). Offen: Drohne (Flugmodell),
     Vierbein-Kriecher, OBELISK-Modell; Hangar (C) mit Waffen ohne Gegenstück am Modell.
4. **Radar und Tarnung**:
   - Schalter aktiv/passiv im Cockpit.
   - Aktiv: große, einstellbare Reichweite, macht sichtbar.
   - Passiv: nur strahlende Gegner, dazu deren Erfassungskreis.
   - Datenlink zwischen eigenen Walkern.
   - Aufschalten nur im Sichtkegel des Torsos, der Kegel ist auf dem Radar sichtbar.

### B – Missionen (Missionsdokument)
1. Datenformat und Missions-Engine: Trigger, Aktionen, Ziele, abgestufter Erfolg
   (triumph/success/partial/failure). Eine Testmission je Typ: Patrouille, Angriff, Basisverteidigung,
   Konvoi abfangen/eskortieren, Sabotage, Aufklärung, Bergung, Bossgefecht.
2. Einsatzregeln:
   - Einsatzgebiet als Polygon; Verlassen löst 15 s Warnung aus, danach gilt die Mission als gescheitert.
   - Vorzeitiger Abbruch = failure plus Nachschubkosten.
   - Die Mission legt die Wingmen-Plätze fest (0–3).
3. Bergung: Wracks mit Bergungswert, nur aus dem gesicherten Gebiet, Technologie-Objekte
   für die Forschung.
4. Briefing (Befehlshaber, Karte, Ziele, Feindaufklärung, erwartete Bergung) und Debriefing
   (Ergebnisstufe, Abschüsse je Pilot, Schäden, Bergung, Erfahrung, Funk-Kommentare).
5. Wingmen mit den 7 Befehlen, Erfahrung, Moral, Verwundung, Tod. Begrenzte Funkreichweite,
   zerstörtes Funkgerät → Bildrauschen.

### C – Stützpunkt und Kampagne
- Bildschirme: Reparatur · Werkstatt · Waffenfertigung · Besatzung · Bewaffnung (Hangar) · Einsatz.
- Reparatur pro Komponente stufenweise gegen Schrott; Modi automatisch / eigener Walker manuell /
  alle manuell.
- Werkstatt: Walker nur aus Schrott. Start mit 4, maximal 8 im Bestand, ein Bau gleichzeitig,
  Bauzeit 1 (leicht) bis 3 (Sturm) Missionen. Verschrotten bringt ca. 60 % zurück.
- Waffenfertigung: höchstens 5 Aufträge pro Missionsintervall, fertig nach der nächsten Mission.
- Gemeinsames Waffenlager mit Stückzahlen für die ganze Einheit.
- Forschung, an erbeutete Synthese-Technik gekoppelt.
- Kampagne:
  - 4 Akte zu je 4–6 Missionen, Finale auf der Kernwelt.
  - Verzweigung über `nextMissions` je Ergebnisstufe.
  - Pflichtmissionen; das zweite Scheitern in einem Akt bedeutet Niederlage.
  - Frontlage zwischen den Missionen.
  - Belohnungen mit `rewardOnFail`.
- Tod des Spielerpiloten beendet die Karriere. Optionaler Ironman-Modus, sonst manuelle
  Speicherstände zwischen den Missionen.

### D – Übungsmodus und Feinschliff
- Übung: Mission frei wählen; verwundbar ja/nein, Munition begrenzt/unbegrenzt,
  5 Schwierigkeitsstufen, Tag/Nacht, freie Walker-Wahl.
- Cockpit-Schadenseffekte, Tutorial mit Techniker-Funk, Optionen, Tastenbelegung, Performance.
