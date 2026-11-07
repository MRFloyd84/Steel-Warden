import * as THREE from 'three';
import { World } from './World.js';
import { WalkerModel } from './walker/WalkerModel.js';
import { WalkerMotion } from '../sim/WalkerMotion.js';
import { EventBus } from '../core/EventBus.js';
import { MISSIONS } from '../data/missions.js';
import { WALKERS, WALKER_ORDER } from '../data/walkers.js';
import { CONFIG } from '../data/config.js';
import { withStartSite } from '../states/missionStartup.js';
import { HangarDoor } from '../world/HangarDoor.js';

const IDLE = { throttleRate: 0, throttleAbs: null, turn: 0 };
const TIMES = ['day', 'day', 'dusk', 'dusk', 'night'];

/**
 * 3D background of the menus: a walker in its hangar box or out on one of
 * the theaters, random time of day, slow camera move. showcase(id) puts a
 * walker on a turntable framed on the right half (mission preparation).
 */
export class MenuScene {
  constructor(game) {
    this.game = game;
    const theaters = MISSIONS.filter((m) => m.category === 'theater');
    const pick = theaters[Math.floor(Math.random() * theaters.length)];
    this.kind = Math.random() < 0.5 ? 'hangar' : 'field';
    const mission = withStartSite({
      ...pick,
      timeOfDay: TIMES[Math.floor(Math.random() * TIMES.length)],
      startup: { ...(pick.startup ?? {}), location: this.kind === 'hangar' ? 'hangar' : 'dropZone' },
    });
    this.mission = mission;
    this.world = new World(mission, CONFIG.terrain, { light: true });
    const s = mission.playerStart;
    this.home = { x: s.x, z: s.z, heading: s.heading };
    this.world.preload(s.x, s.z);
    if (this.kind === 'hangar') {
      const st = this.world.objects.structures.find((x) => x.type === 'hangarBay');
      if (st) {
        this.door = new HangarDoor({ objects: this.world.objects, st });
        this.door.openNow();
      }
    }
    this.bus = new EventBus();
    this.baseWalker = WALKER_ORDER[Math.floor(Math.random() * WALKER_ORDER.length)];
    this.setWalker(this.baseWalker);
    this.t = Math.random() * 100;
    this.mode = 'scene';
    this.platform = makePlatform();
    this.platform.visible = false;
    this.world.scene.add(this.platform);
  }

  setWalker(id) {
    if (this.walkerId === id) return;
    this.model?.dispose();
    this.walkerId = id;
    const w = WALKERS[id];
    this.motion = new WalkerMotion(w, this.world.sampler, CONFIG.feel, this.bus);
    this.motion.place(this.home.x, this.home.z, this.home.heading);
    this.model = new WalkerModel(w, this.world.sampler, CONFIG.feel);
    this.model.addTo(this.world.scene);
    // Settle into the standing pose
    for (let i = 0; i < 30; i++) this.motion.update(1 / 30, IDLE);
  }

  /** Mission preparation: walker on a turntable (null = back to the scene). */
  showcase(id) {
    if (id) {
      this.mode = 'turntable';
      this.setWalker(id);
      this.platform.visible = true;
    } else {
      this.mode = 'scene';
      this.setWalker(this.baseWalker);
      this.motion.legYaw = this.home.heading;
      this.platform.visible = false;
      this.game.renderer.camera.clearViewOffset();
    }
  }

  update(dt) {
    this.t += dt;
    if (this.mode === 'turntable') this.motion.legYaw += dt * 0.35;
    this.motion.update(dt, IDLE);
    this.model.update(this.motion.pose, dt);
    this.door?.update(dt);
  }

  render() {
    const r = this.game.renderer;
    const cam = r.camera;
    const m = this.motion;
    const w = WALKERS[this.walkerId];
    const eye = w.cockpit.eyeHeight;
    const ground = this.world.sampler.heightAt(m.x, m.z);
    const target = new THREE.Vector3(m.x, ground + eye * 0.62, m.z);
    if (this.mode === 'turntable') {
      this.platform.position.set(m.x, ground + 0.05, m.z);
      this.platform.scale.setScalar(2.2 + w.tonnage * 0.045);
      const dist = 12 + eye * 1.9;
      const a = this.home.heading + 0.5;
      cam.position.set(m.x - Math.sin(a) * dist, ground + eye * 0.85, m.z - Math.cos(a) * dist);
      cam.lookAt(target);
      this.offset(cam, r, 0.2); // walker on the right half
    } else if (this.kind === 'hangar') {
      this.offset(cam, r, 0.17);
      // Outside the open gate, drifting sideways
      const h = this.home.heading;
      const side = Math.sin(this.t * 0.06) * 14;
      const back = 48 + Math.sin(this.t * 0.04) * 6;
      const fx = -Math.sin(h);
      const fz = -Math.cos(h);
      cam.position.set(m.x + fx * back + Math.cos(h) * side, ground + 7 + Math.sin(this.t * 0.05) * 2, m.z + fz * back - Math.sin(h) * side);
      cam.lookAt(target);
    } else {
      this.offset(cam, r, 0.17);
      const a = this.t * 0.05;
      const dist = 20 + eye * 2.2;
      const x = m.x + Math.sin(a) * dist;
      const z = m.z + Math.cos(a) * dist;
      cam.position.set(x, Math.max(this.world.sampler.heightAt(x, z) + 2.5, ground + eye * 0.55), z);
      cam.lookAt(target);
    }
    cam.updateMatrixWorld();
    this.world.update(cam.position);
    this.world.beforeRender(cam);
    r.render(this.world.scene);
  }

  /** Shifts the picture so the walker stands right of centre (the menus sit on the left). */
  offset(cam, r, share) {
    cam.setViewOffset(r.width, r.height, -r.width * share, 0, r.width, r.height);
  }

  dispose() {
    this.game.renderer.camera.clearViewOffset();
    this.model?.dispose();
    this.world.dispose();
  }
}

/** Turntable: dark disc with a glowing ring. */
function makePlatform() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.06, 0.12, 40), new THREE.MeshLambertMaterial({ color: '#2b2e2a' }));
  disc.position.y = 0.06;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.012, 4, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb43a', toneMapped: false }));
  ring.position.y = 0.13;
  g.add(disc, ring);
  return g;
}
