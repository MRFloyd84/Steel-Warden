# STEEL WARDEN – Cockpit-Modell aus Tripo

Vorlage: Renes Tripo-Export (`tripo_convert_58d92e6a….glb`) und ein Referenzbild, das zeigt, wie
es im Spiel aussehen soll: Fensterstreben, Monitorreihe, links REAKTOR/APU, rechts der
ENERGIE-Drehknopf, Steuerknüppel links und rechts.

Entscheidungen (Rene):

1. **Ein Cockpit für alle sechs Walker.** Je Klasse ist es leicht skaliert (compact ×0,94,
   standard ×1, heavy ×1,06). Typenschild und Monitorinhalte bleiben je Walker.
2. **Echte Schalter auf den Modellflächen.** Die im Modell geformten Schalter sind Attrappen.
   Die bedienbaren Schalter, Lampen und Monitore sitzen auf den Paneelen und in den Monitorrahmen
   des Modells, und die Attrappen darunter werden abgedeckt.

## Das Modell

| | Tripo-Export | im Spiel |
|---|---|---|
| Dreiecke | 1 869 133 | ≈ 152 000 |
| Datei | 57 MB | 1,8 MB (`assets/cockpit/cockpit.glb`) |
| Texturen | Farbe 2048 + Normalen 2048 (JPEG) | Farbe 2048 (q86) + Normalen 1024 (q90) |
| Knoten | 1 Mesh | Hülle + `gripL` (Schubhebel) + `gripR` (Steuerknüppel) |

Das Modell hat Modelleinheiten mit dem Boden bei y = 0, vorne bei −z und eine Breite von ≈ 0,98.
Es ist hinter dem Piloten und über den Dachstreben offen.

### Import (`tools/import_cockpit.py`)

```
python3 tools/import_cockpit.py <tripo.glb> [--ratio 0.08]
```

1. Das einzelne texturierte Mesh lesen (`tools/glb_read.py`).
2. Die Griffe ausschneiden: Dreiecke, die ganz in einer vermessenen Box liegen, werden zu eigenen
   Knoten mit dem Drehpunkt am Griffansatz.
3. Die Texturen neu kodieren.
4. Mit gltfpack (`-si 0.08 -kn -km -c`) quadratisch reduzieren; die UV-Nähte bleiben erhalten.
   Danach wird quantisiert und mit meshopt komprimiert, im Spiel dekodiert das der
   `MeshoptDecoder` von three.js.

Reduktion: 0,16, 0,08 und 0,05 wurden im Spiel nebeneinander verglichen und sind optisch nicht zu
unterscheiden. Gewählt ist 0,08, weil es halb so viele Dreiecke wie 0,16 braucht und 0,8 MB
kleiner ist.

## Einbau

| Datei | Rolle |
|---|---|
| `src/render/cockpit/CockpitModel.js` | Lädt das Modell einmal beim Start (eingebettet, `?inline`), Instanzen teilen Geometrie und Material; Option `COCKPIT_MODEL_USE` |
| `src/data/cockpits.js` → `COCKPITS.model` | Lage des Auges im Modell (`COCKPIT_MODEL = { eye: [0, 0.43, 0.22], scale: 2.7 }`, also 2,7 m je Modelleinheit), die Paneele auf den Modellflächen (`modelPanel`: Mitte, Normale, Größe, Anhebung), Glasscheiben in den Fensterrahmen, Klassen-Skalierung, Licht |
| `src/data/panelLayouts.js` → `model`, `modelAssault` | Dieselben Schalter wie in den Klassen-Cockpits, nur anders angeordnet; KOLOSS zusätzlich mit KREIS 2 |
| `src/render/cockpit/Cockpit.js` | Wählt Modell oder klassisch, hängt alles unter `root` (Skalierung je Klasse), die Griffe des Modells werden zu Schubhebel und Knüppel (`ModelGrip`) |
| `src/render/cockpit/CockpitShell.js` | Glasscheiben als Polygone (das Modell hat Rahmen, aber kein Glas) |
| `src/render/cockpit/PanelBuilder.js` | Paneele ohne Platte (`slab: false`) für die Monitorrahmen, Plattentiefe = Anhebung; neue Angabe `scale` für Bedienelemente (Teil und Beschriftung wachsen gemeinsam) |
| `src/render/cockpit/CrtScreen.js` | Monitore ohne eigenen Rahmen (`bezel: false`), weil das Modell die Rahmen hat |
| `src/data/options.js` | Grafik-Option **Cockpit: modelliert / klassisch** |

### Anordnung (wie im Referenzbild)

| Ort im Modell | Inhalt |
|---|---|
| Linkes hohes Paneel | STROM · HILFSAGGREGAT: Batterie, Hilfsaggregat-Start, Hauptbus, Kühlpumpen und Lampen; darunter REAKTOR: Betriebsart, Zündung, Hydraulik und Lampen; beim KOLOSS KREIS 2 |
| Rechtes hohes Paneel | Großer ENERGIE-Drehknopf an der Stelle der Modell-Attrappe; Scheinwerfer, Zielnachführung, LENKUNG; unten FREIGABE: Waffen, Beinsperre |
| Paneel links neben den Monitoren | Innenlicht, Radarbereich, Funk, Raketenkamera |
| Sechs Monitorrahmen | Radar, Schaden (Mitte), Waffen, Ziel, System, Energie |
| Leiste unter der Fensterkante | Warn- und Hinweislampen |
| Griffe | links der Schubhebel (schwenkt mit dem Schub), rechts der Steuerknüppel (kippt und dreht) |

Hinter dem modellierten Vorderteil bleiben Seitenwände, Rückwand, Dach, Boden, Sitz und Gurte
prozedural, weil das Modell dort offen ist.

### Anhebung der hohen Paneele

Gemessen über die Modelloberfläche: Der geformte Drehknopf und die Kippschalter ragen bis
0,034 Modelleinheiten heraus. Mit der ursprünglichen Anhebung von 0,013 verdeckte der Knopf den
Schalter LENKUNG, der sich dadurch nicht anklicken ließ. Jetzt liegt die Anhebung bei 0,037, die
Platte deckt die Attrappen ab, und alle Schalter sind erreichbar.

## Prüfung

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 53/53 bestanden; neu `tests/cockpitLayout.test.mjs` mit drei Tests (gleiche Schalter wie die Klassen-Cockpits, alle Teile auf Modellpaneelen, automatischer Start mit Modell-Layout für KESTREL und KOLOSS) |
| Klicktest im Browser: Strahl vom Auge auf jedes Bedienteil, erster Treffer muss das Teil sein | KESTREL 47/47, BASTION 47/47, KOLOSS 49/49 (mit KREIS 2); das Typenschild ist nicht bedienbar |
| Screenshots | Vorwärtsblick KESTREL, BASTION, KOLOSS; freier Blick links, rechts, unten, hinten; Kaltstart mit rotem Notlicht |
| Credits | `CREDITS.md` mit Abschnitt Cockpit-Modell; `tools/check_credits.mjs` prüft jetzt auch `assets/cockpit/` |
| Automatischer Start im Browser (`p05 --auto-only`) | bereit nach 83 s, gelaufen, geschossen, keine Fehler |
| Handstart und Zustand (`p05`), Menüs, Raketenlenkung, Kampf | keine Fehler; Lenkungs-Trefferbilder wie zuvor |
| Steuerung (`ctl`) | mit Option „Cockpit: klassisch“ 22/22; mit Modell-Cockpit headless 20/22, siehe unten |

### Headless-Bildrate und die Steuerungs-Suite

Der Testbrowser rendert ohne Grafikkarte (SwiftShader, 2 Kerne). Mit dem Modell-Cockpit erreicht
das Spiel dort 1,7 bis 2 Bilder pro Sekunde, mit dem alten prozeduralen Cockpit 4,3.

- Die Dreiecke sind dabei nicht die Bremse: Mit 96 000 statt 302 000 Dreiecken steigt die Rate
  nur auf 2,1 Bilder pro Sekunde.
- Teuer ist die texturierte, beleuchtete Fläche, die in Software Pixel für Pixel gerechnet wird.
  Auf einer echten Grafikkarte sind 150 000 Dreiecke und zwei Texturen unkritisch.

Zwei Prüfungen der Steuerungs-Suite hängen an echter Zeit:

- Esc innerhalb von 300 ms nach dem Verlust der Maus wird ignoriert.
- Gamepad-Eingaben werden nach 150 ms ausgelesen.

Bei ≈ 500 ms pro Bild kommen die Eingaben zu spät an, daher die 20/22. Das Testskript wartet
jetzt zusätzlich auf gerenderte Bilder bzw. auf Spielzeit (Shift+C). Die Prüfungen selbst sind
unverändert. Mit „Cockpit: klassisch“ läuft die Suite 22/22, gegen den vorigen Commit ebenfalls
22/22.

## Offen

- **Blick nach hinten:** Sitz, Rückwand und Gurte sind prozedurale Blöcke in Flächenfarben. Neben
  dem texturierten Modell wirken sie schlicht. Abhilfe wäre ein eigenes Tripo-Modell für Sitz und
  Rückwand oder eine Textur aus dem Modell.
- **Bildausschnitt:** Das Referenzbild zeigt mehr vom Armaturenbrett und beide Seitenpaneele im
  Vorwärtsblick, entspricht also einem weiteren Sichtfeld. Im Spiel bleibt das Sichtfeld bei 72°.
  Die Seitenpaneele sind im freien Blick erreichbar.
- **Leistung auf schwacher Hardware:** Wer ohne 3D-Beschleunigung spielt, kann in den Optionen
  „Cockpit: klassisch“ wählen.
