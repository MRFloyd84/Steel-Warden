import { CHECKLISTS } from '../data/systems.js';

/**
 * Tracks which checklist steps are done. A step is ticked the first time
 * its flag becomes true and stays ticked (it's a paper checklist). After
 * an emergency shutdown the restart list is shown until the restart is
 * complete. Pure evaluation — it never blocks anything.
 */
export class StartupChecklist {
  constructor(mode, features = {}) {
    this.mode = mode === 'simple' ? 'simple' : 'full';
    const has = (step) => !step.requires || features[step.requires];
    this.lists = { main: CHECKLISTS[this.mode].filter(has), restart: CHECKLISTS.restart.filter(has) };
    this.done = { main: new Set(), restart: new Set() };
    this.active = 'main';
    this.version = 0; // bumps on every visible change (for redraws)
  }

  update(flags) {
    if (flags.restartNeeded && this.active !== 'restart') {
      this.active = 'restart';
      this.done.restart.clear();
      this.version++;
    } else if (!flags.restartNeeded && this.active === 'restart') {
      this.active = 'main';
      this.version++;
    }
    this.tick('main', flags);
    if (this.active === 'restart') this.tick('restart', flags);
  }

  tick(name, flags) {
    this.lists[name].forEach((step, i) => {
      if (!this.done[name].has(i) && flags[step.flag]) {
        this.done[name].add(i);
        this.version++;
      }
    });
  }

  /** Hot start: the whole procedure counts as done. */
  markAllDone() {
    this.lists.main.forEach((_, i) => this.done.main.add(i));
    this.version++;
  }

  /** Visible list: { title, steps: [{ text, done }], current } */
  get view() {
    const name = this.active;
    const steps = this.lists[name].map((st, i) => ({ text: st.text, done: this.done[name].has(i) }));
    const current = steps.findIndex((st) => !st.done);
    const title = name === 'restart' ? 'NEUSTART NACH NOTABSCHALTUNG' : this.mode === 'simple' ? 'STARTVERFAHREN (VEREINFACHT)' : 'STARTVERFAHREN';
    return { title, steps, current, restart: name === 'restart' };
  }

  get complete() {
    return this.done.main.size === this.lists.main.length;
  }

  /** "7/14 HYDRAULIK — EIN" for the debug overlay. */
  debugLine() {
    const v = this.view;
    const label = v.current >= 0 ? v.steps[v.current].text : 'fertig';
    return `Checkliste ${this.active} ${this.done[this.active].size}/${v.steps.length}  → ${label}`;
  }
}
