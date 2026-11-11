import { EventBus } from '../core/EventBus.js';
import { WalkerMotion, lerpPose } from '../sim/WalkerMotion.js';
import { DummyDriver } from '../sim/DummyDriver.js';
import { WalkerModel } from '../render/walker/WalkerModel.js';
import { WALKERS } from '../data/walkers.js';
import { ENEMIES } from '../data/enemies.js';

/**
 * Walkers in the mission besides the cockpit: the player's own model (seen
 * in the outside view and the debug camera), spawned units from
 * mission.spawns (DummyDriver) and AI units (ai/AIDirector adds them at
 * mission start and at runtime: reinforcements, waves). Units get their own
 * event bus so their footsteps don't play in the player's cockpit.
 *
 * A unit with `controller` (AI) is steered by it: the controller sets the
 * throttle and returns the turn input like a player would.
 */
const IDLE = { throttleRate: 0, throttleAbs: null, turn: 0 };

/** Walker data by id: human walkers and Synthesis units. */
export function findWalker(id) {
  const w = WALKERS[id] ?? ENEMIES[id];
  if (!w) throw new Error(`Unknown walker "${id}"`);
  return w;
}

export class MissionEntities {
  constructor({ scene, sampler, feel, mission, player }) {
    this.scene = scene;
    this.sampler = sampler;
    this.feel = feel;
    this.player = { ...player, model: new WalkerModel(player.walker, sampler, feel) };
    this.player.model.addTo(scene);
    this.player.renderPose = { ...player.motion.pose };
    this.units = [];
    this.quietBus = new EventBus();
    this.onAdd = null; // (unit) — combat and world hook in at runtime spawns
    this.serial = 0;
    for (const spawn of mission.spawns ?? []) {
      this.addUnit({ id: spawn.id, type: spawn.unit, x: spawn.at[0], z: spawn.at[1], heading: spawn.heading ?? 0, behavior: spawn.behavior, emitting: spawn.emitting });
    }
  }

  /** Adds a walker to the mission (also while it runs); returns the unit. */
  addUnit({ id = null, type, x, z, heading = 0, behavior = null, emitting = false, side = 'enemy' }) {
    const walker = findWalker(type);
    const motion = new WalkerMotion(walker, this.sampler, this.feel, this.quietBus);
    motion.place(x, z, heading);
    const model = new WalkerModel(walker, this.sampler, this.feel);
    model.addTo(this.scene);
    const u = {
      id: id ?? `${type}-${++this.serial}`,
      walker, motion, model,
      driver: new DummyDriver(behavior ?? { type: 'idle' }),
      controller: null,
      renderPose: { ...motion.pose },
      spawnEmitting: !!emitting,
      spawnSide: side, // 'enemy' | 'player' (wingmen) — CombatUnits.prep
    };
    this.units.push(u);
    this.onAdd?.(u);
    return u;
  }

  get count() {
    return 1 + this.units.length;
  }

  update(dt) {
    for (const u of this.units) {
      if (u.immobile) {
        u.motion.throttle.value = 0;
        u.motion.update(dt, IDLE);
      } else if (u.controller) {
        u.motion.update(dt, u.controller.drive(dt));
      } else {
        u.motion.update(dt, u.driver.next(dt, u.motion));
      }
    }
  }

  render(alpha, dt, showPlayer) {
    // The player's model is posed even when hidden: muzzles and hit zones live on it.
    const p = this.player;
    p.model.setVisible(showPlayer);
    lerpPose(p.renderPose, p.motion.prevPose, p.motion.pose, alpha);
    p.model.update(p.renderPose, dt);
    for (const u of this.units) {
      lerpPose(u.renderPose, u.motion.prevPose, u.motion.pose, alpha);
      u.model.update(u.renderPose, dt);
    }
  }

  dispose() {
    this.player.model.dispose();
    for (const u of this.units) u.model.dispose();
  }
}
