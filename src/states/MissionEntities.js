import { EventBus } from '../core/EventBus.js';
import { WalkerMotion, lerpPose } from '../sim/WalkerMotion.js';
import { DummyDriver } from '../sim/DummyDriver.js';
import { WalkerModel } from '../render/walker/WalkerModel.js';
import { getWalker } from '../data/walkers.js';

/**
 * Walkers in the mission besides the cockpit: the player's own model (seen
 * in the outside view and the debug camera) and spawned units from
 * mission.spawns. Spawned units are driven by DummyDriver until the AI
 * step; they get their own event bus so their footsteps don't play in the
 * player's cockpit.
 */
const IDLE = { throttleRate: 0, throttleAbs: null, turn: 0 };

export class MissionEntities {
  constructor({ scene, sampler, feel, mission, player }) {
    this.scene = scene;
    this.sampler = sampler;
    this.feel = feel;
    this.player = { ...player, model: new WalkerModel(player.walker, sampler, feel) };
    this.player.model.addTo(scene);
    this.player.renderPose = { ...player.motion.pose };
    this.units = [];
    const quietBus = new EventBus();
    for (const spawn of mission.spawns ?? []) {
      const walker = getWalker(spawn.unit);
      const motion = new WalkerMotion(walker, sampler, feel, quietBus);
      motion.place(spawn.at[0], spawn.at[1], spawn.heading ?? 0);
      const model = new WalkerModel(walker, sampler, feel);
      model.addTo(scene);
      this.units.push({ id: spawn.id, walker, motion, model, driver: new DummyDriver(spawn.behavior), renderPose: { ...motion.pose }, spawnEmitting: !!spawn.emitting });
    }
  }

  get count() {
    return 1 + this.units.length;
  }

  update(dt) {
    for (const u of this.units) {
      if (u.immobile) {
        u.motion.throttle.value = 0;
        u.motion.update(dt, IDLE);
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
