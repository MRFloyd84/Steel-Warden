/**
 * Simple mission objectives (A3): a list of steps worked off in order.
 *
 * mission.script = {
 *   steps: [
 *     { type: 'nav', id: 'ALPHA', radius: 60, text },        reach a nav point
 *     { type: 'destroy', groups: ['patrol'] | 'all', text },  all units of these groups out of action
 *     { type: 'waves', text },                                 all waves of mission.forces destroyed
 *     { type: 'extract', id: 'EXTRAKTION', radius: 50, text }, reach the extraction point
 *   ],
 *   failOnWalkerLost: true (default)  walker destroyed (legs or reactor) → failed
 * }
 * A unit is out of action as a wreck (legs shot off counts — it can't follow any more).
 * Last step done → 'completed' after a short pause. The active nav point is
 * marked on the nav display.
 */
const DONE_DELAY = 4;
const LOST_DELAY = 4;

export class MissionScript {
  constructor({ mission, director, combat, radio, onFinish, data }) {
    this.mission = mission;
    this.director = director;
    this.combat = combat;
    this.radio = radio;
    this.onFinish = onFinish;
    this.data = data;
    this.script = mission.script ?? null;
    this.steps = this.script?.steps ?? [];
    this.index = 0;
    this.finished = null;
    this.timer = 0;
    this.markNav();
  }

  get active() {
    return !!this.script;
  }

  get current() {
    return this.steps[this.index] ?? null;
  }

  /** Objective line for the HUD. */
  get text() {
    if (!this.script) return null;
    if (this.finished === 'completed') return 'Einsatz erfüllt — Rückkehr';
    if (this.finished === 'failed') return 'Walker verloren';
    const s = this.current;
    if (!s) return null;
    const n = `${this.index + 1}/${this.steps.length}`;
    if (s.text) return `${n}  ${s.text}`;
    if (s.type === 'nav') return `${n}  Navpunkt ${s.id} erreichen`;
    if (s.type === 'extract') return `${n}  Extraktion ${s.id} erreichen`;
    if (s.type === 'waves') return `${n}  Alle Wellen abwehren`;
    return `${n}  Gegner ausschalten`;
  }

  markNav() {
    const s = this.current;
    const id = s ? s.nav ?? (s.type === 'nav' || s.type === 'extract' ? s.id : null) : null;
    if (!id || !this.data?.navPoints) return;
    for (const n of this.data.navPoints) n.active = n.id === id;
  }

  update(dt) {
    if (!this.script) return;
    if (this.finished) {
      this.timer += dt;
      if (this.timer > (this.finished === 'completed' ? DONE_DELAY : LOST_DELAY)) {
        this.onFinish(this.finished);
        this.script = null;
      }
      return;
    }
    if (this.script.failOnWalkerLost !== false && this.combat.player.wreck) {
      this.finish('failed');
      this.radio({ from: 'LEITSTELLE', text: 'Walker ausgefallen. Bergungsteam ist unterwegs — Einsatz gescheitert.' });
      return;
    }
    const s = this.current;
    if (!s) return;
    if (this.check(s)) {
      if (s.done) this.radio({ from: 'LEITSTELLE', text: s.done });
      this.index++;
      if (this.index >= this.steps.length) {
        this.finish('completed');
        if (!s.done) this.radio({ from: 'LEITSTELLE', text: 'Einsatz erfüllt. Gute Arbeit.' });
      } else {
        this.markNav();
        const next = this.current;
        if (next.radio) this.radio({ from: 'LEITSTELLE', text: next.radio });
      }
    }
  }

  check(s) {
    const p = this.combat.player.motion;
    if (s.type === 'nav' || s.type === 'extract') {
      const n = this.mission.navPoints.find((x) => x.id === s.id);
      return !!n && Math.hypot(n.x - p.x, n.z - p.z) < (s.radius ?? 60);
    }
    if (s.type === 'destroy') {
      const ctrls = this.director.controllers.filter((c) => s.groups === 'all' || !s.groups || s.groups.includes(c.group?.id));
      return ctrls.length > 0 && ctrls.every((c) => c.unit.wreck);
    }
    if (s.type === 'waves') return this.director.wavesDone;
    return false;
  }

  finish(result) {
    this.finished = result;
    this.timer = 0;
  }

  debugLine() {
    if (!this.script) return null;
    return `Auftrag: Schritt ${Math.min(this.index + 1, this.steps.length)}/${this.steps.length} ${this.current?.type ?? '-'}${this.finished ? `  → ${this.finished}` : ''}`;
  }
}
