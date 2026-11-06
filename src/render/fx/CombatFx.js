import * as THREE from 'three';
import { ParticlePool } from './ParticlePool.js';

const MAX_BOLTS = 256;
const MAX_BEAMS = 12;
const MAX_SHIELD = 16;
const MAX_SCORCH = 96;
const c = (hex) => new THREE.Color(hex);
const COLORS = {
  spark: c('#ffd27a'), sparkHot: c('#fff2c0'), smoke: c('#3a3834'), smokeLight: c('#8a867c'),
  debris: c('#1c1c1a'), fire: c('#ff7a24'), shield: c('#6fc4ff'), plasma: c('#9ad0ff'), flash: c('#fff0c8'),
};
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const q = new THREE.Quaternion();
const m4 = new THREE.Matrix4();
const zAxis = new THREE.Vector3(0, 0, 1);
const scl = new THREE.Vector3();

/**
 * Visual combat effects: projectiles (instanced), beams, muzzle flashes,
 * shield flashes, sparks/debris/smoke, scorch marks on armour, explosions,
 * falling parts and dropped-weapon markers. Everything is pooled.
 */
export class CombatFx {
  constructor(scene) {
    this.scene = scene;
    this.sparks = new ParticlePool(scene, 1400, { additive: true });
    this.smoke = new ParticlePool(scene, 900);

    // Projectiles: one instanced unit box, scaled and coloured per instance
    this.boltMat = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false });
    this.bolts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.boltMat, MAX_BOLTS);
    this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bolts.setColorAt(0, COLORS.spark);
    this.bolts.frustumCulled = false;
    this.bolts.count = 0;
    scene.add(this.bolts);

    const beamGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5);
    this.beams = Array.from({ length: MAX_BEAMS }, () => {
      const mat = new THREE.MeshBasicMaterial({ color: '#ff3a24', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
      const core = new THREE.Mesh(beamGeo, mat);
      core.visible = false;
      scene.add(core);
      return { mesh: core, owner: null, life: 0 };
    });

    const shieldGeo = new THREE.IcosahedronGeometry(1, 1);
    this.shieldFlashes = Array.from({ length: MAX_SHIELD }, () => {
      const mat = new THREE.MeshBasicMaterial({ color: COLORS.shield, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const mesh = new THREE.Mesh(shieldGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, t: 0, life: 0 };
    });
    this.nextShield = 0;

    const scorchGeo = new THREE.CircleGeometry(0.5, 7);
    this.scorchMat = new THREE.MeshBasicMaterial({ color: '#0b0a08', transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.scorch = Array.from({ length: MAX_SCORCH }, () => {
      const m = new THREE.Mesh(scorchGeo, this.scorchMat);
      m.userData.fx = true;
      return m;
    });
    this.colorCache = new Map();
    this.nextScorch = 0;

    this.light = new THREE.PointLight('#ffb070', 0, 120, 1.5); // always present → no shader recompiles
    scene.add(this.light);
    this.lightT = 0;

    this.falling = [];
    this.markers = [];
    this.emitters = []; // { obj, local, kind: 'smoke'|'sparks'|'fire', rate, acc }
    this.markerMat = new THREE.MeshBasicMaterial({ color: '#ffae2e', toneMapped: false });
    this.time = 0;
  }

  setViewportHeight(px) {
    this.sparks.setViewportHeight(px);
    this.smoke.setViewportHeight(px);
  }

  // ---- projectiles and beams ----

  /** Writes the active projectiles into the instanced mesh (min. apparent size from the camera). */
  drawProjectiles(projectiles, camPos) {
    let n = 0;
    for (const p of projectiles.pool) {
      if (!p.active || n >= MAX_BOLTS) continue;
      const v = p.def.visual;
      const kind = p.def.kind;
      const dist = camPos ? p.pos.distanceTo(camPos) : 50;
      let len = kind === 'missile' ? v.length : Math.min(v.length ?? 3, p.speed * 0.02 + 0.5);
      let w = kind === 'missile' ? (p.def.size === 'L' ? 0.45 : 0.22) : v.projectileFx === 'orbBlue' ? 0.6 : v.projectileFx === 'pellet' ? 0.1 : 0.18;
      w = Math.max(w, dist * 0.0028);
      if (kind !== 'missile') len = Math.max(len, dist * 0.04);
      tmp.copy(p.vel).normalize();
      q.setFromUnitVectors(zAxis, tmp);
      m4.compose(p.pos, q, scl.set(w, w, len));
      this.bolts.setMatrixAt(n, m4);
      this.bolts.setColorAt(n, kind === 'missile' ? COLORS.smokeLight : this.color(v.color));
      n++;
      if (kind === 'missile') {
        // Exhaust: flame and a smoke trail
        tmp2.copy(p.pos).addScaledVector(tmp, -len * 0.6);
        this.sparks.spawn({ pos: tmp2, color: COLORS.fire, size: w * 6, life: 0.08 });
        if (Math.random() < 0.7) this.smoke.spawn({ pos: tmp2, color: COLORS.smokeLight, size: w * 5, grow: 4, life: 1.2, alpha: 0.45, drag: 1 });
      }
    }
    this.bolts.count = n;
    this.bolts.instanceMatrix.needsUpdate = true;
    if (this.bolts.instanceColor) this.bolts.instanceColor.needsUpdate = true;
  }

  /** Shows a beam from a to b this frame (owner key keeps one beam per weapon). */
  beam(owner, a, b, color, camPos = null) {
    let slot = this.beams.find((x) => x.owner === owner) ?? this.beams.find((x) => x.life <= 0);
    if (!slot) return;
    slot.owner = owner;
    slot.life = 0.06;
    const len = a.distanceTo(b);
    const mesh = slot.mesh;
    mesh.position.copy(a);
    mesh.lookAt(b);
    mesh.rotateY(Math.PI); // geometry runs along -Z
    const far = camPos ? Math.min(camPos.distanceTo(a), camPos.distanceTo(b)) + len * 0.25 : 30;
    const w = Math.max(0.16, far * 0.003) * (0.8 + Math.random() * 0.4);
    mesh.scale.set(w, w, len);
    mesh.material.color.set(color);
    mesh.visible = true;
    if (Math.random() < 0.5) this.sparks.spawn({ pos: b, vel: tmp.set(rand(4), rand(4) + 3, rand(4)), color: COLORS.sparkHot, size: 0.8, life: 0.2, gravity: 9 });
  }

  // ---- impacts ----

  color(hex) {
    let col = this.colorCache.get(hex);
    if (!col) {
      col = new THREE.Color(hex);
      this.colorCache.set(hex, col);
    }
    return col;
  }

  muzzleFlash(pos, dir, color, big = false) {
    this.sparks.spawn({ pos, color: this.color(color), size: big ? 4 : 2, life: 0.06 });
    this.sparks.spawn({ pos: tmp.copy(pos).addScaledVector(dir, big ? 1.2 : 0.6), color: COLORS.flash, size: big ? 2.5 : 1.2, life: 0.05 });
    if (big) this.smoke.spawn({ pos, vel: tmp2.copy(dir).multiplyScalar(4), color: COLORS.smokeLight, size: 2, grow: 3, life: 0.9, alpha: 0.4, drag: 2 });
  }

  shieldHit(point, normal, radius) {
    const f = this.shieldFlashes[this.nextShield];
    this.nextShield = (this.nextShield + 1) % MAX_SHIELD;
    f.mesh.position.copy(point).addScaledVector(normal, radius * 0.15);
    f.mesh.lookAt(tmp.copy(f.mesh.position).add(normal));
    f.mesh.scale.set(radius, radius, radius * 0.25);
    f.t = 0;
    f.life = 0.35;
    f.mesh.visible = true;
    for (let i = 0; i < 6; i++) this.sparks.spawn({ pos: point, vel: tmp.copy(normal).multiplyScalar(4).add(tmp2.set(rand(5), rand(5), rand(5))), color: COLORS.shield, size: 0.7, life: 0.3, drag: 3 });
  }

  /** Armour hit: sparks, splinters, smoke puff and a scorch mark on the hit mesh. */
  armorHit(point, normal, mesh, localPoint, localNormal, strength = 1) {
    const n = Math.round(6 + 10 * strength);
    for (let i = 0; i < n; i++) {
      this.sparks.spawn({ pos: point, vel: tmp.copy(normal).multiplyScalar(6 + Math.random() * 10).add(tmp2.set(rand(6), rand(6) + 2, rand(6))), color: Math.random() < 0.5 ? COLORS.spark : COLORS.sparkHot, size: 0.5, life: 0.4 + Math.random() * 0.3, gravity: 14, drag: 1 });
    }
    for (let i = 0; i < 3 + strength * 3; i++) {
      this.smoke.spawn({ pos: point, vel: tmp.copy(normal).multiplyScalar(4).add(tmp2.set(rand(4), rand(4) + 4, rand(4))), color: COLORS.debris, size: 0.35, life: 1.1, gravity: 16, alpha: 1 });
    }
    this.smoke.spawn({ pos: point, vel: tmp.copy(normal).multiplyScalar(1.5), color: COLORS.smoke, size: 1.5 * strength + 0.8, grow: 2.5, life: 1.2, alpha: 0.5, drag: 1 });
    if (mesh && localPoint) this.addScorch(mesh, localPoint, localNormal, 0.5 + strength * 0.6);
  }

  addScorch(mesh, localPoint, localNormal, size) {
    const s = this.scorch[this.nextScorch];
    this.nextScorch = (this.nextScorch + 1) % MAX_SCORCH;
    s.removeFromParent();
    s.position.copy(localPoint).addScaledVector(localNormal, 0.02);
    s.lookAt(tmp.copy(s.position).add(localNormal)); // local space of the parent
    s.scale.setScalar(size * (0.8 + Math.random() * 0.5));
    mesh.add(s);
  }

  groundHit(point, strength = 1) {
    for (let i = 0; i < 4 + strength * 6; i++) {
      this.smoke.spawn({ pos: point, vel: tmp.set(rand(4), 6 + Math.random() * 8, rand(4)), color: COLORS.debris, size: 0.4, life: 1, gravity: 18, alpha: 1 });
    }
    this.smoke.spawn({ pos: point, vel: tmp.set(0, 2, 0), color: COLORS.smokeLight, size: 2 + strength * 2, grow: 3, life: 1.4, alpha: 0.45, drag: 1 });
    this.sparks.spawn({ pos: point, color: COLORS.spark, size: 1.5 + strength, life: 0.1 });
  }

  /** Missile / SPEER blast, PZ-9 plasma, EMP ring. */
  blast(point, radius, kind = 'blast') {
    const col = kind === 'emp' || kind === 'plasma' ? COLORS.plasma : COLORS.fire;
    for (let i = 0; i < 10 + radius * 2; i++) {
      this.sparks.spawn({ pos: point, vel: tmp.set(rand(radius * 3), rand(radius * 3) + radius, rand(radius * 3)), color: col, size: radius * 0.5 + 0.5, life: 0.35, drag: 3 });
    }
    if (kind !== 'emp') {
      for (let i = 0; i < 4; i++) this.smoke.spawn({ pos: point, vel: tmp.set(rand(3), 3 + Math.random() * 3, rand(3)), color: COLORS.smoke, size: radius * 1.2, grow: radius, life: 2.5, alpha: 0.55, drag: 1.2 });
    }
    this.flashLight(point, kind === 'emp' ? 0 : radius * 4, 0.15);
  }

  /** Reactor explosion: fireball, debris rain, smoke column, light. */
  explosion(point, radius) {
    for (let i = 0; i < 70; i++) {
      this.sparks.spawn({ pos: point, vel: tmp.set(rand(radius * 4), Math.random() * radius * 4, rand(radius * 4)), color: Math.random() < 0.5 ? COLORS.fire : COLORS.sparkHot, size: 2 + Math.random() * radius * 0.5, life: 0.5 + Math.random() * 0.7, drag: 2.5 });
    }
    for (let i = 0; i < 40; i++) {
      this.smoke.spawn({ pos: point, vel: tmp.set(rand(radius * 3), radius * (1 + Math.random() * 2.5), rand(radius * 3)), color: COLORS.debris, size: 0.5 + Math.random() * 0.6, life: 2.2, gravity: 16, alpha: 1 });
    }
    for (let i = 0; i < 12; i++) {
      this.smoke.spawn({ pos: tmp2.copy(point).add(tmp.set(rand(radius), rand(radius * 0.5), rand(radius))), vel: tmp.set(rand(2), 2 + Math.random() * 4, rand(2)), color: COLORS.smoke, size: radius * 1.5, grow: radius * 0.8, life: 4, alpha: 0.7, drag: 0.8 });
    }
    this.flashLight(point, 400, 0.6);
  }

  flashLight(point, intensity, time) {
    if (intensity <= this.light.intensity && this.lightT > 0) return;
    this.light.position.copy(point);
    this.light.position.y += 3;
    this.light.intensity = intensity;
    this.lightT = time;
    this.lightMax = intensity;
    this.lightTime = time;
  }

  // ---- parts and wrecks ----

  /** Detaches a part (e.g. an arm) and lets it fall to the ground with its weapons. */
  dropPart(obj, sampler, onRest) {
    obj.updateWorldMatrix(true, false);
    const wm = obj.matrixWorld.clone();
    this.scene.attach(obj);
    obj.matrix.copy(wm);
    obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    this.falling.push({
      obj, sampler, onRest,
      vel: new THREE.Vector3(rand(3), 2, rand(3)),
      spin: new THREE.Vector3(rand(2), rand(1), rand(2)),
    });
  }

  /** Small blinking beacon where a weapon lies (salvage comes later). */
  addMarker(point) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08).translate(0, 1.1, 0), new THREE.MeshLambertMaterial({ color: '#555' }));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35).translate(0, 2.35, 0), this.markerMat);
    g.add(pole, lamp);
    g.position.copy(point);
    this.scene.add(g);
    this.markers.push({ group: g, lamp });
    return g;
  }

  /** Continuous emitter (wreck smoke, sparks from a damaged component). */
  addEmitter(obj, local, kind, rate) {
    const e = this.emitters.find((x) => x.obj === obj && x.kind === kind && x.local.distanceToSquared(local) < 0.01);
    if (e) {
      e.rate = Math.max(e.rate, rate);
      return e;
    }
    const em = { obj, local: local.clone(), kind, rate, acc: 0 };
    this.emitters.push(em);
    return em;
  }

  update(dt) {
    this.time += dt;
    this.sparks.update(dt);
    this.smoke.update(dt);
    for (const b of this.beams) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.mesh.visible = false;
        b.owner = null;
      }
    }
    for (const f of this.shieldFlashes) {
      if (!f.mesh.visible) continue;
      f.t += dt;
      const k = 1 - f.t / f.life;
      f.mesh.material.opacity = Math.max(0, k) * 0.55;
      if (k <= 0) f.mesh.visible = false;
    }
    if (this.lightT > 0) {
      this.lightT -= dt;
      this.light.intensity = Math.max(0, this.lightMax * (this.lightT / this.lightTime));
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.vel.y -= 14 * dt;
      f.obj.position.addScaledVector(f.vel, dt);
      f.obj.rotation.x += f.spin.x * dt;
      f.obj.rotation.z += f.spin.z * dt;
      const ground = f.sampler.heightAt(f.obj.position.x, f.obj.position.z) + 0.6;
      if (f.obj.position.y <= ground) {
        f.obj.position.y = ground;
        this.groundHit(f.obj.position, 2);
        this.falling.splice(i, 1);
        f.onRest?.(f.obj.position.clone());
      }
    }
    const blink = Math.floor(this.time * 2) % 2 === 0;
    this.markerMat.color.set(blink ? '#ffae2e' : '#3a2a10');
    for (const e of this.emitters) {
      e.acc += e.rate * dt;
      while (e.acc >= 1) {
        e.acc -= 1;
        e.obj.updateWorldMatrix(true, false);
        const p = tmp2.copy(e.local).applyMatrix4(e.obj.matrixWorld);
        if (e.kind === 'smoke') this.smoke.spawn({ pos: p, vel: tmp.set(rand(0.6), 2.5 + Math.random() * 2, rand(0.6)), color: COLORS.smoke, size: 1.4, grow: 2.2, life: 3, alpha: 0.5, drag: 0.6 });
        else if (e.kind === 'fire') this.sparks.spawn({ pos: p, vel: tmp.set(rand(1), 2 + Math.random() * 2, rand(1)), color: COLORS.fire, size: 1.6, life: 0.4, drag: 1 });
        else this.sparks.spawn({ pos: p, vel: tmp.set(rand(5), 3 + Math.random() * 5, rand(5)), color: COLORS.sparkHot, size: 0.45, life: 0.5, gravity: 14 });
      }
    }
  }

  get stats() {
    return { sparks: this.sparks.active, smoke: this.smoke.active, emitters: this.emitters.length };
  }

  dispose() {
    this.sparks.dispose();
    this.smoke.dispose();
    this.scene.remove(this.bolts, this.light);
    this.bolts.geometry.dispose();
    this.boltMat.dispose();
    for (const b of this.beams) { this.scene.remove(b.mesh); b.mesh.material.dispose(); }
    this.beams[0].mesh.geometry.dispose();
    for (const f of this.shieldFlashes) { this.scene.remove(f.mesh); f.mesh.material.dispose(); }
    this.shieldFlashes[0].mesh.geometry.dispose();
    for (const s of this.scorch) s.removeFromParent();
    this.scorch[0].geometry.dispose();
    this.scorchMat.dispose();
    for (const m of this.markers) { this.scene.remove(m.group); m.group.traverse((o) => o.geometry?.dispose()); }
    this.markerMat.dispose();
    for (const f of this.falling) this.scene.remove(f.obj);
  }
}

function rand(s) {
  return (Math.random() * 2 - 1) * s;
}
