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
