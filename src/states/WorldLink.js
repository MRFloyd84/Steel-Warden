import { SURFACES } from '../data/surfaces.js';
import { CanopyWeather } from '../render/Weather.js';
import { AreaFence } from '../render/world/AreaFence.js';
import { insideArea, distanceToBorder } from '../world/area.js';

const RADIO = {
  areaNear: { from: 'LEITSTELLE', text: 'Achtung, Sie nähern sich der Grenze des Einsatzgebiets.' },
  areaLeft: { from: 'LEITSTELLE', text: 'Sie haben das Einsatzgebiet verlassen! Sofort umkehren.' },
  areaBack: { from: 'LEITSTELLE', text: 'Wieder im Einsatzgebiet.' },
  iceBreak: { from: 'TECHNIK', text: 'Eis gebrochen — wir stecken fest! Kurz warten, dann langsam raus.' },
  lava: { from: 'TECHNIK', text: 'Lava! Beinantrieb nimmt Schaden, Reaktor heizt auf — raus da!' },
};
const NEAR_WARN = 120;

/**
 * Glue between the mission and the world: walker collision with buildings
 * and rocks, ground effects (reactor heat and cooling, lava damage, thin
 * ice), weather on the canopy and wind noise, the mission area (fence,
 * radar border, radio warnings) and the world's debug line.
 */
export class WorldLink {
  constructor({ game, world, motion, entities, combat, systems, cockpit, radio }) {
    this.game = game;
    this.world = world;
    this.motion = motion;
    this.combat = combat;
    this.systems = systems;
    this.radio = radio;
    this.entities = entities;
    motion.obstacles = world.objects;
    for (const u of entities.units) u.motion.obstacles = world.objects;
    world.objects.fx = combat.fx;
    this.canopy = new CanopyWeather(cockpit, world.weatherDef);
    const w = world.weatherDef.wind ?? 0;
    this.wind = w > 0.05 ? game.audio.loop('wind') : null;
    this.windLevel = w;

    const area = world.mission.area;
    this.area = area && area.length >= 3 ? area : null;
    this.fence = this.area ? new AreaFence(world.scene, world.sampler, this.area, game.config.area ?? {}) : null;
    this.areaState = 'inside';
    this.borderDist = Infinity;
    this.lastLavaRadio = -Infinity;
    this.time = 0;
    this.off = game.bus.on('walker:iceBreak', () => radio(RADIO.iceBreak));
    this.gl = game.renderer.renderer;
    this.gl.info.autoReset = false;
    this.drawCalls = 0;
  }

  /** Fixed step: ground effects and the mission area. */
  update(dt) {
    this.time += dt;
    const m = this.motion;
    const surf = SURFACES[m.surface] ?? SURFACES.hard;
    // Reactor: water cools, lava and hot ground heat (°C/s)
    this.systems.setExternalHeat(surf.heat ?? 0);
    // Lava eats the legs (all walkers)
    for (const u of this.combat.units.all) {
      const s = SURFACES[u.motion.surface];
      if (!s?.legDamage || u.wreck?.kind === 'reactor') continue;
      const changes = u.damage.applyRaw('legs', s.legDamage * dt);
      if (changes.length) this.combat.units.apply(u, changes);
      if (u.isPlayer && this.time - this.lastLavaRadio > 20) {
        this.lastLavaRadio = this.time;
        this.radio(RADIO.lava);
      }
    }
    if (this.area) this.checkArea();
  }

  checkArea() {
    const p = this.motion.pose;
    const inside = insideArea(this.area, p.x, p.z);
    this.borderDist = distanceToBorder(this.area, p.x, p.z);
    let state = inside ? (this.borderDist < NEAR_WARN ? 'near' : 'inside') : 'outside';
    if (state === this.areaState) return;
    if (state === 'near' && this.areaState === 'inside') this.radio(RADIO.areaNear);
    if (state === 'outside') this.radio(RADIO.areaLeft);
    if (this.areaState === 'outside' && state !== 'outside') this.radio(RADIO.areaBack);
    // Hysteresis: 'near' only counts again after going well inside
    if (state === 'inside' && this.areaState === 'near' && this.borderDist < NEAR_WARN + 40) state = 'near';
    this.areaState = state;
  }

  /** Per frame, before the world is drawn. */
  frame(dt, camera, focus, inCockpit) {
    this.gl.info.reset();
    this.world.frame(dt, camera, focus);
    this.world.setViewportHeight(this.game.renderer.height);
    this.fence?.update(dt, focus, this.borderDist);
    if (inCockpit) this.canopy.update(dt, Math.abs(this.motion.speed));
    if (this.wind) {
      const gust = this.world.weather?.gust ?? 0;
      this.wind.setGain(this.windLevel * (0.7 + gust * 0.6) * (inCockpit ? 0.7 : 1), 0.3);
      this.wind.setRate(0.85 + gust * 0.3, 0.3);
    }
  }

  /** Draw calls of the last frame (read before the next frame resets them). */
  afterRender() {
    this.drawCalls = this.gl.info.render.calls;
  }

  /** Mission area border relative to the walker, for the radar. */
  areaRelative(x, z) {
    return this.area ? this.area.map(([ax, az]) => [ax - x, az - z]) : null;
  }

  debugLine() {
    const o = this.world.objects.stats;
    const sc = this.world.scatterView;
    const m = this.motion;
    const surf = SURFACES[m.surface]?.name ?? m.surface;
    const fluid = this.world.sampler.fluidAt(m.pose.x, m.pose.z);
    return [
      `Boden ${surf}${m.iceBroken ? ' (eingebrochen)' : ''}${m.stuck > 0 ? ` fest ${m.stuck.toFixed(1)} s` : ''}${fluid ? `  ${fluid.kind} ${fluid.level.toFixed(1)} m` : ''}  Wetter ${this.world.weatherDef.name}${this.area ? `  Gebiet ${this.areaState} (${Math.round(this.borderDist)} m)` : ''}${m.collided ? '  KOLLISION' : ''}`,
      `Objekte: Bauwerke ${o.visible}/${o.total} (Trümmer ${o.rubble})  Streu ${sc?.visible ?? 0}/${this.world.scatter.generated}  Draw Calls ${this.drawCalls}`,
    ];
  }

  dispose() {
    this.off();
    this.gl.info.autoReset = true;
    this.canopy.dispose();
    this.fence?.dispose();
    this.wind?.stop(0.2);
  }
}
