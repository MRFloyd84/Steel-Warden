# Detailtexturen und externe Umgebungsmodelle – Plan

## 1. Detailtexturen

**Quelle → Bundle.** `tools/import_textures.py` liest die Quellbilder (Screaming Brain Studios
„Base Materials 256x256“, CC0) und erzeugt fehlende Arten selbst (Metallplatten, Tankblech,
Kristallfacetten, Sandriffel, Lavakruste — prozedural, nahtlos kachelnd). Jede Textur wird in
Graustufen umgewandelt, auf höchstens 128 px verkleinert und auf mittlere Helligkeit 50 %
und gleiche Kontraststärke normiert, damit eine Stärke von z. B. 0,3 bei allen gleich wirkt.
Ergebnis: `assets/textures/<id>.png`, eingebettet per `import.meta.glob(… ?inline)`.

**Daten.** `src/data/textures.js`: Textur-ID → Datei, Kachelgröße in Metern, Quelle, Lizenz;
dazu je Theater die Zuordnung der sieben Geländelagen und die Stärke (`theater.detail`).

**Laufzeit.** `src/render/DetailTextures.js` dekodiert die PNGs einmal beim Start (asynchron,
wenige ms) in zwei `DataArrayTexture`: Gelände (7 Lagen, je Theater zusammengestellt) und
Objekte (Materialgruppen). Mipmaps an; Filter nach Option „Pixelig“ (Nearest) oder
„Gefiltert“ (bilinear + trilinear zwischen Mipmaps).

**Gelände.** `ChunkBuilder` bestimmt je Gitterpunkt die Bodenart (gleiche Klassifizierung wie
Simulation und Farbe) und schreibt Gewichte als Vertex-Attribute: weich, Ufer (bis 1,5 m über
dem Wasserspiegel und Gewässergrund), Lava (Lavagrund und heißer Boden), Eis (dünnes Eis),
Straße. Hart = Rest. Fels kommt im Shader aus der Hangneigung (weiche Kante um `rockSlope`)
und wird triplanar projiziert, damit Steilwände nicht verschmieren. Zwischen den Gitterpunkten
interpoliert die Grafikkarte → weiche Übergänge. Die Farbe bleibt die Theater-Palette; die
Textur ändert nur die Helligkeit: `farbe × (1 + (textur − 0,5) × 2 × stärke)`.
Gegen Kachelmuster: zweite Lage im 2,7-fachen Maßstab und 37° gedreht, die erste Lage je
Chunk leicht gedreht (±10°, aus der Chunk-Nummer gewürfelt).

**Objekte.** Jedes Teil eines Bauplans (prozedural oder extern) bekommt eine Materialgruppe:
Metall, Beton, Holz, Tank, Kristall, dazu Fels und Eis für Streuobjekte. Explizit per `mat`
oder abgeleitet aus der Teilfarbe. Projektion triplanar im Objektraum (Boxen haben keine
brauchbaren UVs, externe Modelle nur Farbtabellen-UVs) — dreht sich ein Turmkopf, dreht die
Textur mit. Eingefärbt wird weiter mit der Teilfarbe bzw. bei externen Modellen mit der
Theater-Palette je Gruppe.

**Debug.** Taste Texturen an/aus, Taste Bodenart-Maske als Farben (hart grau, weich braun,
Fels dunkel, Ufer blau, Lava rot, Eis türkis, Straße gelb).

## 2. Externe Umgebungsmodelle

**Import.** `tools/import_props.py` kopiert eine kuratierte Auswahl aus den CC0-Paketen nach
`assets/props/<paket>/`: Kenney City Kit Industrial (+ `colormap.png`), Kenney Space Kit,
Quaternius Ultimate Modular Sci-Fi (liegt nur als OBJ/MTL vor → das Skript schreibt GLB mit
den MTL-Materialnamen). Eingebettet per `import.meta.glob(… ?inline)`, offline lauffähig.

**Daten.** `src/data/props.js`: Pakete (Name, Autor, Lizenz, Link) und Props: Datei, Maßstab,
Drehung, Bodenversatz, Kollisionsbox, Trefferboxen, Panzerung/Struktur für eigenständige
Nutzung, Trümmer, Materialgruppen-Zuordnung (Materialname → Gruppe; Farbtabellen-Modelle:
Farbe der Tabelle → Gruppe).

**Laden.** `src/world/PropLibrary.js` lädt beim Start alle GLBs (GLTFLoader aus dem Speicher),
verwirft Materialien und Texturen, schreibt je Ecke Helligkeit (aus der Originalfarbe) und
Gruppe, bringt das Modell auf Maßstab und Boden und legt eine flach schattierte, nicht
indizierte Geometrie ab. Fehlt eine Datei oder schlägt das Laden fehl: Platzhalter-Box in der
deklarierten Größe, Meldung in Konsole und Debug-Overlay.

**Bauen.** `PartBuilder` kennt neben box/cyl/cone/ring jetzt `prop`: ein Bauplan mischt externe
und prozedurale Teile. Bauwerke teilen sich ihre Bauplan-Geometrie; Streuobjekte laufen
wie bisher über `InstancedMesh` → Instancing für mehrfach verwendete Teile. Neue Bauwerke und
Streuobjekte aus den Paketen in den Theater-Regeln.

**Prüfung.** `tools/check_credits.mjs`: jede Datei in `assets/props/` und `assets/textures/`
muss in `props.js`/`textures.js` stehen, und jedes dort genannte Paket in `CREDITS.md`.
Debug-Overlay: Dreiecke je Prop-Typ, fehlende Dateien.

## Nicht enthalten
Die Tripo-Modelle (Walker, Synthese-Einheiten, Drohne, Stachel) sind keine Umgebungsmodelle
und laufen mit 16 000 – 1,3 Mio. Dreiecken, Skelett und Texturen. Sie bleiben vorerst außen vor
(Rückfrage).
