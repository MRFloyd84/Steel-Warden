import * as THREE from 'three';

const OPEN_TIME = 9; // s, matches the door sound
const SLIDE = 16.6; // m each half moves sideways
const PASSABLE = 0.55; // share of the travel after which the walker can pass (collision off)
const beaconMaterial = new THREE.MeshBasicMaterial({ color: '#ffb020', toneMapped: false, fog: false });
const beaconOff = new THREE.MeshBasicMaterial({ color: '#4a3410' });

/**
 * Door of the start hangar (structure hangarBay at site homeBase). Closed
 * until deploy: the walker can't get out and nobody sees in. open() runs
 * the horn, the amber beacons and the door halves sliding apart; when the
 * gap is wide enough the door's collision goes.
 */
export class HangarDoor {
  constructor({ objects, st, sound = null, onPassable = null }) {
    this.objects = objects;
    this.st = st;
    this.sound = sound;
    this.onPassable = onPassable;
    this.state = 'closed';
    this.t = 0;
    this.k = 0;
    this.passable = false;
    objects.makeMovable(st, 'doorL');
    objects.makeMovable(st, 'doorR');
    objects.setDoorOpen(st, false);
    // Beacons on both front corners
    this.beacons = [-1, 1].map((side) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), beaconOff);
      m.position.set(side * 17.4, 21.8, -18.6);
      st.object.add(m);
      return m;
    });
    this.lights = [-1, 1].map((side) => {
      const l = new THREE.PointLight('#ffa020', 0, 40, 2);
      l.position.set(side * 17.4, 20.5, -20);
      st.object.add(l);
      return l;
    });
  }

  get worldPoint() {
    return new THREE.Vector3(0, 10, -18).applyMatrix4(this.st.matrix);
  }

  open() {
    if (this.state !== 'closed') return;
    this.state = 'opening';
    this.t = 0;
    this.sound?.at('base.horn', this.worldPoint);
    this.sound?.at('base.door', this.worldPoint);
  }

  /** Hot start: open without show. */
  openNow() {
    this.state = 'open';
    this.setK(1);
  }

  setK(k) {
    this.k = k;
    const x = SLIDE * k;
    this.objects.setMover(this.st, 'doorL', { x: -x });
    this.objects.setMover(this.st, 'doorR', { x });
    if (!this.passable && k >= PASSABLE) {
      this.passable = true;
      this.objects.setDoorOpen(this.st, true);
      this.onPassable?.(this.st);
    }
  }

  update(dt) {
    if (this.state === 'closed') return;
    this.t += dt;
    if (this.state === 'opening') {
      const u = Math.min(1, Math.max(0, (this.t - 1.2) / (OPEN_TIME - 1.2))); // horn first, then the drive
      this.setK(u * u * (3 - 2 * u));
      if (u >= 1) this.state = 'open';
    }
    // Beacons blink while opening and a few seconds after
    const on = this.t < OPEN_TIME + 4 && Math.floor(this.t * 3) % 2 === 0;
    for (const b of this.beacons) b.material = on ? beaconMaterial : beaconOff;
    for (const l of this.lights) l.intensity = on ? 60 : 0;
  }
}
