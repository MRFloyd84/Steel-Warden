# Credits

## Sounds

Rohaufnahmen liegen unverändert in `assets/sounds-raw/`, die aufbereiteten Spiel-Samples
erzeugt `tools/prepare_sounds.py` nach `src/audio/samples/`.

- Von Rene bereitgestellte Aufnahmen (alle Dateien ohne Präfix `freesound_community-`).
- `freesound_community-big-garage-door-opening-43959.mp3` und
  `freesound_community-mech_step_001-87175.mp3`: Uploads des Accounts „freesound_community“,
  vermutlich von Pixabay. Vor einer Veröffentlichung die Lizenz auf der Quellseite prüfen.

Alle übrigen Klänge (Schalterklicks, Drehregler-Rasten, Taster) werden zur Laufzeit
prozedural erzeugt (`src/audio/ClickSynth.js`).

Ergänzt: `Mechanical_machine_m_2` (von Rene) als Antriebsmotor-Schleife `motor_loop`.

## Umgebungsmodelle (`assets/props/`)

Alle Modelle sind CC0 1.0 (Public Domain, https://creativecommons.org/publicdomain/zero/1.0/).
Eingelesen mit `tools/import_props.py`; beim Laden werden Materialien und Texturen verworfen
(Flat-Shading, Farbe aus der Theater-Palette je Materialgruppe). Welche Datei welcher Prop-ID
gehört, steht in `src/data/props.js`; `node tools/check_credits.mjs` prüft, dass jede Datei
dort eingetragen ist und jedes Paket hier steht.

| Paket (`assets/props/…`) | Name | Autor | Lizenz | Link |
|---|---|---|---|---|
| `kenney-industrial` | City Kit Industrial 2.0 | Kenney (www.kenney.nl) | CC0 1.0 | https://kenney.nl/assets/city-kit-industrial |
| `kenney-space` | Space Kit 2.0 | Kenney (www.kenney.nl) | CC0 1.0 | https://kenney.nl/assets/space-kit |
| `quaternius-scifi` | Ultimate Modular Sci-Fi (Feb 2021) | Quaternius | CC0 1.0 | https://quaternius.com/packs/ultimatemodularscifi.html |

Quaternius-Modelle lagen als OBJ/MTL vor und wurden ohne geometrische Änderung nach GLB
umgeschrieben; `kenney-industrial/colormap.png` ist auf 128 px verkleinert und dient nur zum
Ablesen der Materialgruppen.

## Detailtexturen (`assets/textures/`)

Graustufen, auf 128 px verkleinert und auf gleichen Mittelwert/Kontrast normiert
(`tools/import_textures.py`). Quelle je Datei: `src/data/textures.js`.

| Quelle | Name | Autor | Lizenz | Link |
|---|---|---|---|---|
| `sbs` | Base Materials 256x256 | Screaming Brain Studios | CC0 1.0 | https://screamingbrainstudios.itch.io/ |
| `generated` | STEEL WARDEN (prozedural, tools/import_textures.py) | Rene / STEEL WARDEN | CC0 1.0 | — |

Aus SBS: ground-gravel, ground-dirt, ground-mud, ground-rock, ground-snow, ground-ice,
ground-dust, mat-concrete, mat-plaster, mat-wood, mat-stone. Prozedural erzeugt:
ground-sand, ground-lava, ground-crystal, mat-metal, mat-tank, mat-crystal.

## Cockpit-Modell (`assets/cockpit/`)

| Datei | Name | Autor | Lizenz | Link |
|---|---|---|---|---|
| `assets/cockpit/cockpit.glb` | STEEL WARDEN Tripo-Cockpit | Rene, erzeugt mit Tripo AI | Eigene Rechte (bezahlter Tripo-Tarif) | https://www.tripo3d.ai |

Mit Tripo AI erzeugtes, texturiertes Cockpit (1,87 Mio. Dreiecke, 57 MB). Mit
`tools/import_cockpit.py` die beiden Griffe als eigene Knoten ausgeschnitten, Texturen neu kodiert
(Farbe 2048, Normalen 1024) und mit gltfpack auf ≈ 150 000 Dreiecke reduziert und komprimiert (1,8 MB).
Gilt für alle sechs Walker; echte Schalter und Monitore sitzen auf seinen Paneelen.

## Walker- und Synthese-Modelle (`assets/walkers/`, `assets/props/tripo-synth/`)

| Paket | Name | Autor | Lizenz | Link |
|---|---|---|---|---|
| `assets/walkers` | STEEL WARDEN Tripo-Modelle (Walker und Synthese) | Rene, erzeugt mit Tripo AI | Eigene Rechte (bezahlter Tripo-Tarif) | https://www.tripo3d.ai |
| `tripo-synth` | STEEL WARDEN Tripo-Modelle (Synthese) | Rene, erzeugt mit Tripo AI | Eigene Rechte (bezahlter Tripo-Tarif) | https://www.tripo3d.ai |

Mit Tripo AI erzeugte, automatisch geriggte Modelle; mit `tools/import_walkers.py` in starre
Segmente zerlegt, reduziert (≈ 3 500–7 500 Dreiecke) und mit Vertexfarben aus der Textur
versehen. Zuordnung: KESTREL, MARDER, BASTION, HALBERD, GOLIATH, KOLOSS (Walker), SPLITTER,
SICHEL, MONOLITH (Synthese), Abwehrstachel (`spike-tower`). Erzeugt mit Tripo-Credits (bezahlter Tarif): die Rechte an den Modellen liegen bei Rene.

Nicht eingebunden: die Drohne (die Lufteinheit hat noch kein Flugmodell) und der vierbeinige
Kriecher (das Rig kennt nur zwei Beine).
