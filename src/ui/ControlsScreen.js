import { Overlay, esc } from './Overlay.js';
import { ACTIONS, ACTION_BY_ID, CATEGORIES, AXIS_ACTIONS } from '../input/actions.js';
import { tokenLabel, padLabel } from '../input/keyLabels.js';

/**
 * Options → Steuerung. Per action two keyboard/mouse slots and a gamepad
 * button; click a slot, press the key (Esc cancels, Backspace clears).
 * A conflict in the same context offers to swap. Gamepad/HOTAS: axes with
 * live display, invert, dead zone, profiles. Mouse: sensitivity, invert Y.
 * Export/import as JSON, restore defaults.
 */
export class ControlsScreen extends Overlay {
  constructor(container, input, bus, { onClose }) {
    super(container, 'controls-screen');
    this.input = input;
    this.bus = bus;
    this.onClose = onClose;
    this.tab = 'keys';
    this.pending = null; // conflict waiting for an answer
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
    this.root.addEventListener('input', (e) => this.onChange(e));
    this.render();
  }

  open() {
    this.render();
    this.show();
    this.tick();
  }

  close() {
    this.input.cancelCapture();
    this.hide();
    cancelAnimationFrame(this.raf);
    this.onClose?.();
  }

  /** Menu context Esc: cancel a capture/dialog first, else close. */
  back() {
    if (this.capturing || this.pending) {
      this.input.cancelCapture();
      this.capturing = null;
      this.pending = null;
      this.render();
      return;
    }
    this.close();
  }

  changed() {
    this.bus.emit('input:bindings');
    this.render();
  }

  // ---- rendering ----

  render() {
    const tabs = [['keys', 'Tastatur & Maus'], ['pad', 'Gamepad / HOTAS'], ['misc', 'Maus & Datei']]
      .map(([id, l]) => `<button class="tab ${this.tab === id ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('');
    const body = this.tab === 'keys' ? this.keysHtml() : this.tab === 'pad' ? this.padHtml() : this.miscHtml();
    const conflicts = this.input.conflicts.length
      ? `<div class="ctl-warn">${this.input.conflicts.map((c) => esc(c.text)).join('<br>')}</div>` : '';
    this.root.innerHTML = `
      <div class="controls-panel crt">
        <header><h2>Steuerung</h2><div class="tabs">${tabs}</div><button class="btn" data-act="close">Zurück</button></header>
        ${this.dialogHtml()}${conflicts}
        <div class="ctl-body">${body}</div>
      </div>`;
  }

  dialogHtml() {
    if (this.capturing) {
      const a = ACTION_BY_ID[this.capturing.id];
      const what = this.capturing.kind === 'pad' ? 'Gamepad-Knopf drücken' : this.capturing.kind === 'axis' ? 'Achse bewegen' : 'Taste oder Maustaste drücken';
      return `<div class="ctl-dialog">${esc(a ? a.label : 'Achse')}: <b>${what}</b> · Esc bricht ab${this.capturing.kind === 'key' ? ' · Rück löscht' : ''}</div>`;
    }
    if (this.pending) {
      const p = this.pending;
      const names = p.others.map((id) => ACTION_BY_ID[id].label).join(', ');
      const label = p.kind === 'pad' ? padLabel(p.token) : tokenLabel(p.token);
      return `<div class="ctl-dialog warn"><b>${esc(label)}</b> ist im selben Kontext schon belegt: ${esc(names)}.
        <button class="btn" data-act="swap">Tauschen</button>
        <button class="btn" data-act="force">Trotzdem belegen</button>
        <button class="btn" data-act="cancel">Abbrechen</button></div>`;
    }
    return '';
  }

  keysHtml() {
    const pad = this.input.gamepad.connected;
    return Object.entries(CATEGORIES).map(([cat, name]) => {
      const rows = ACTIONS.filter((a) => a.category === cat && !a.id.startsWith('menuChoice')).map((a) => {
        const k = this.input.keys[a.id];
        const slot = (i) => `<button class="slot ${this.isCapturing(a.id, 'key', i) ? 'cap' : ''}" data-bind="${a.id}" data-slot="${i}">${esc(k[i] ? tokenLabel(k[i]) : '—')}</button>`;
        const p = this.input.pad[a.id];
        return `<tr><td>${esc(a.label)}</td><td>${slot(0)}</td><td>${slot(1)}</td>
          <td><button class="slot pad ${this.isCapturing(a.id, 'pad') ? 'cap' : ''}" data-padbind="${a.id}" ${pad ? '' : 'title="Kein Gamepad erkannt"'}>${esc(p.length ? p.map(padLabel).join('/') : '—')}</button></td></tr>`;
      }).join('');
      return `<h3>${esc(name)}</h3><table class="ctl-table"><tr><th>Aktion</th><th>Taste 1</th><th>Taste 2</th><th>Gamepad</th></tr>${rows}</table>`;
    }).join('');
  }

  padHtml() {
    const g = this.input.settings.gamepad;
    const gp = this.input.gamepad;
    const axisOptions = (sel) => Array.from({ length: Math.max(8, gp.axes.length) }, (_, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>Achse ${i}</option>`).join('');
    const actOptions = (sel) => Object.entries(AXIS_ACTIONS).map(([id, l]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const rows = g.axes.map((m, i) => `<tr>
      <td><select data-axis="${i}" data-field="axis">${axisOptions(m.axis)}</select> <button class="btn small" data-axiscap="${i}">bewegen…</button></td>
      <td><select data-axis="${i}" data-field="action">${actOptions(m.action)}</select></td>
      <td><label><input type="checkbox" data-axis="${i}" data-field="invert" ${m.invert ? 'checked' : ''}> invertiert</label></td>
      <td><div class="meter"><span data-live="${i}"></span></div></td>
      <td><button class="btn small" data-axisdel="${i}">×</button></td></tr>`).join('');
    const profiles = Object.keys(this.input.settings.profiles);
    return `
      <p>${gp.connected ? `Erkannt: <b>${esc(gp.id)}</b>` : 'Kein Gamepad/HOTAS erkannt — einen Knopf drücken, damit der Browser es meldet.'}</p>
      <h3>Achsen</h3>
      <table class="ctl-table">${rows}</table>
      <button class="btn small" data-act="axisadd">Achse hinzufügen</button>
      <h3>Einstellungen</h3>
      <label>Totzone <input type="range" min="0" max="0.5" step="0.01" data-set="deadzone" value="${g.deadzone}"> <span>${g.deadzone.toFixed(2)}</span></label><br>
      <label>Blickgeschwindigkeit <input type="range" min="0.5" max="5" step="0.1" data-set="lookSpeed" value="${g.lookSpeed}"> <span>${g.lookSpeed.toFixed(1)}</span></label>
      <h3>Knöpfe live</h3><div class="pad-live" data-role="buttons"></div>
      <h3>Profile</h3>
      <input type="text" data-role="profileName" placeholder="Name, z. B. HOTAS" maxlength="24">
      <button class="btn small" data-act="profileSave">Speichern</button>
      ${profiles.map((n) => `<div class="profile"><b>${esc(n)}</b> <button class="btn small" data-profload="${esc(n)}">Laden</button> <button class="btn small" data-profdel="${esc(n)}">Löschen</button></div>`).join('') || '<p>Noch keine Profile.</p>'}
      <p class="note">Gamepad-Knöpfe der einzelnen Aktionen stehen im Reiter „Tastatur &amp; Maus“, Spalte Gamepad.</p>`;
  }

  miscHtml() {
    const m = this.input.settings.mouse;
    return `
      <h3>Maus</h3>
      <label>Empfindlichkeit <input type="range" min="0.0005" max="0.006" step="0.0001" data-set="sensitivity" value="${m.sensitivity}"> <span>${(m.sensitivity * 1000).toFixed(1)}</span></label><br>
      <label><input type="checkbox" data-set="invertY" ${m.invertY ? 'checked' : ''}> Y-Achse invertieren</label>
      <h3>Export / Import</h3>
      <textarea data-role="json" rows="8" spellcheck="false" placeholder="Hier exportierte Belegung einfügen und Importieren drücken"></textarea><br>
      <button class="btn small" data-act="export">Exportieren</button>
      <button class="btn small" data-act="download">Als Datei speichern</button>
      <button class="btn small" data-act="import">Importieren</button>
      <span data-role="msg" class="note"></span>
      <h3>Zurücksetzen</h3>
      <button class="btn" data-act="reset">${this.confirmReset ? 'Wirklich alles auf Standard? Nochmal klicken' : 'Standard wiederherstellen'}</button>`;
  }

  isCapturing(id, kind, slot) {
    const c = this.capturing;
    return !!c && c.id === id && c.kind === kind && (slot === undefined || c.slot === slot);
  }

  // ---- events ----

  onClick(e) {
    const t = e.target.closest('button');
    if (!t || performance.now() < (this.ignoreClickUntil ?? 0)) return;
    const d = t.dataset;
    if (d.tab) {
      this.tab = d.tab;
      this.confirmReset = false;
      return this.render();
    }
    if (d.bind) return this.captureKey(d.bind, Number(d.slot));
    if (d.padbind) return this.capturePad(d.padbind);
    if (d.axiscap !== undefined) return this.captureAxis(Number(d.axiscap));
    if (d.axisdel !== undefined) {
      this.input.settings.gamepad.axes.splice(Number(d.axisdel), 1);
      this.input.save();
      return this.changed();
    }
    if (d.profload) {
      this.input.loadProfile(d.profload);
      return this.changed();
    }
    if (d.profdel) {
      this.input.deleteProfile(d.profdel);
      return this.changed();
    }
    const act = d.act;
    if (act === 'close') return this.close();
    if (act === 'swap' || act === 'force') return this.resolve(act === 'swap');
    if (act === 'cancel') {
      this.pending = null;
      return this.render();
    }
    if (act === 'axisadd') {
      this.input.settings.gamepad.axes.push({ axis: 0, action: 'throttleAbs', invert: false });
      this.input.save();
      return this.changed();
    }
    if (act === 'profileSave') {
      const name = this.root.querySelector('[data-role="profileName"]').value.trim();
      if (!name) return;
      this.input.saveProfile(name);
      return this.changed();
    }
    if (act === 'export' || act === 'download') {
      const json = this.input.exportJSON();
      this.root.querySelector('[data-role="json"]').value = json;
      if (act === 'download') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = 'steelwarden-steuerung.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      return this.message('Exportiert.');
    }
    if (act === 'import') {
      try {
        this.input.importJSON(this.root.querySelector('[data-role="json"]').value);
        this.changed();
        this.message('Importiert.');
      } catch (err) {
        this.message(`Import fehlgeschlagen: ${err.message}`);
      }
      return;
    }
    if (act === 'reset') {
      if (!this.confirmReset) {
        this.confirmReset = true;
        return this.render();
      }
      this.confirmReset = false;
      this.input.resetDefaults();
      return this.changed();
    }
  }

  onChange(e) {
    const el = e.target;
    const d = el.dataset;
    if (d.axis !== undefined) {
      const m = this.input.settings.gamepad.axes[Number(d.axis)];
      if (d.field === 'axis') m.axis = Number(el.value);
      if (d.field === 'action') m.action = el.value;
      if (d.field === 'invert') m.invert = el.checked;
      this.input.save();
      return;
    }
    if (d.set) {
      const g = this.input.settings.gamepad;
      const m = this.input.settings.mouse;
      if (d.set === 'deadzone' || d.set === 'lookSpeed') g[d.set] = Number(el.value);
      if (d.set === 'sensitivity') m.sensitivity = Number(el.value);
      if (d.set === 'invertY') m.invertY = el.checked;
      const out = el.parentElement.querySelector('span');
      if (out) out.textContent = d.set === 'sensitivity' ? (m.sensitivity * 1000).toFixed(1) : Number(el.value).toFixed(2);
      if (e.type === 'change') this.input.save();
    }
  }

  message(text) {
    const el = this.root.querySelector('[data-role="msg"]');
    if (el) el.textContent = text;
  }

  // ---- capture ----

  captureKey(id, slot) {
    this.pending = null;
    this.capturing = { id, kind: 'key', slot };
    this.render();
    this.input.startCapture('key', (token) => {
      this.capturing = null;
      this.ignoreClickUntil = performance.now() + 400; // the click of a bound mouse button

      if (token === 'Backspace') {
        this.input.bindKey(id, slot, null);
        return this.changed();
      }
      if (token) this.offer(id, 'key', token, slot);
      else this.render();
    });
  }

  capturePad(id) {
    if (!this.input.gamepad.connected) return;
    this.pending = null;
    this.capturing = { id, kind: 'pad' };
    this.render();
    this.input.startCapture('pad', (button) => {
      this.capturing = null;
      this.offer(id, 'pad', button);
    });
  }

  captureAxis(i) {
    if (!this.input.gamepad.connected) return;
    this.capturing = { id: null, kind: 'axis' };
    this.render();
    this.input.startCapture('axis', (axis) => {
      this.capturing = null;
      this.input.settings.gamepad.axes[i].axis = axis;
      this.input.save();
      this.changed();
    });
  }

  /** Binds unless the token is taken in the same context — then asks. */
  offer(id, kind, token, slot = 0) {
    const others = this.input.conflictsFor(id, token, kind === 'pad' ? 'pad' : 'tokens');
    if (!others.length) {
      this.apply(id, kind, token, slot);
      return this.changed();
    }
    this.pending = { id, kind, token, slot, others };
    this.render();
  }

  apply(id, kind, token, slot) {
    if (kind === 'pad') this.input.bindPad(id, token);
    else this.input.bindKey(id, slot, token);
  }

  /** swap: the other actions get what this action had in that slot. */
  resolve(swap) {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    const old = p.kind === 'pad' ? this.input.pad[p.id][0] ?? null : this.input.keys[p.id][p.slot] ?? null;
    if (swap) {
      for (const other of p.others) {
        if (p.kind === 'pad') this.input.bindPad(other, old);
        else {
          const i = this.input.keys[other].indexOf(p.token);
          this.input.bindKey(other, i, old);
        }
      }
    }
    this.apply(p.id, p.kind, p.token, p.slot);
    this.changed();
  }

  /** Live gamepad display while the pad tab is open. */
  tick() {
    cancelAnimationFrame(this.raf);
    if (!this.visible) return;
    this.raf = requestAnimationFrame(() => this.tick());
    if (this.tab !== 'pad') return;
    const gp = this.input.gamepad;
    const g = this.input.settings.gamepad;
    g.axes.forEach((m, i) => {
      const el = this.root.querySelector(`[data-live="${i}"]`);
      if (!el) return;
      let v = gp.axis(m.axis);
      if (m.invert) v = -v;
      const inDead = Math.abs(v) < g.deadzone;
      el.style.left = `${(50 + Math.min(0, v) * 50).toFixed(1)}%`;
      el.style.width = `${(Math.abs(v) * 50).toFixed(1)}%`;
      el.classList.toggle('dead', inDead);
    });
    const btn = this.root.querySelector('[data-role="buttons"]');
    if (btn) {
      const on = gp.buttons.map((d, i) => (d ? padLabel(i) : null)).filter(Boolean);
      const text = on.length ? on.join(' · ') : '—';
      if (btn.textContent !== text) btn.textContent = text;
    }
  }
}
