# STEEL WARDEN – Fahrplan

Stand: nach Phase A2a (Waffen, Schaden, Schilde, Hitze). Dieses Dokument führt das Grundkonzept,
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
   - **A2b** (offen):
     - Raketen-Lenkarten: aktiv, halbaktiv (Aufschaltung halten), Anti-Radar, optisch mit
       Raketenkamera auf einem Cockpitmonitor.
     - Zielkapsel als Ausrüstung: Komponentenwahl am Ziel (Tab).
     - Cockpit-Reaktionen auf Treffer.
3. **Synthese-Gegner** (Grundkonzept Phase 5):
   - Trefferzonen Beine / Waffenträger / Torso (Reaktor).
   - Zerstörungsart: Beine → bewegungsunfähig, volles Material, Waffen bergbar. Waffenträger
     → Waffe fällt als Bergungsobjekt. Reaktor → Explosion, ca. 10 % Material.
   - KI: Patrouille, Angriff, Rückzug, Verstärkung rufen (Verzögerung je Mission),
     Reaktion auf aktives Radar.
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
