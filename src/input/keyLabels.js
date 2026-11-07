/**
 * Labels for binding tokens as printed on the player's keyboard.
 * Bindings use the physical KeyboardEvent.code; the label comes from
 * navigator.keyboard.getLayoutMap() where the browser offers it (Chrome,
 * Edge), otherwise from a German QWERTZ table. Pure module (Node-safe).
 */

/** German QWERTZ: physical code → printed key. */
const DE = {
  KeyY: 'Z', KeyZ: 'Y', Backquote: '^', Minus: 'ß', Equal: '´', BracketLeft: 'Ü', BracketRight: '+',
  Semicolon: 'Ö', Quote: 'Ä', Backslash: '#', IntlBackslash: '<', Comma: ',', Period: '.', Slash: '-',
};
const SPECIAL = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  ShiftLeft: 'Shift', ShiftRight: 'Shift rechts', ControlLeft: 'Strg', ControlRight: 'Strg rechts',
  AltLeft: 'Alt', AltRight: 'Alt Gr', Space: 'Leertaste', Escape: 'Esc', Enter: 'Enter', NumpadEnter: 'Num Enter',
  Tab: 'Tab', Backspace: 'Rück', CapsLock: 'Feststell', Insert: 'Einfg', Delete: 'Entf', Home: 'Pos1', End: 'Ende',
  PageUp: 'Bild ↑', PageDown: 'Bild ↓', NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num ×',
  NumpadDivide: 'Num ÷', NumpadDecimal: 'Num ,',
  Mouse0: 'LMT', Mouse1: 'MMT', Mouse2: 'RMT', Mouse3: 'Maus 4', Mouse4: 'Maus 5',
};
const PAD = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'Kreuz ↑', 'Kreuz ↓', 'Kreuz ←', 'Kreuz →', 'Home'];

let layout = null; // Map code → character from the browser, if available

/** Asks the browser for the real layout (async, optional). Calls back when known. */
export function loadLayoutMap(onReady) {
  try {
    const kb = typeof navigator !== 'undefined' ? navigator.keyboard : null;
    if (!kb?.getLayoutMap) return;
    kb.getLayoutMap().then((map) => {
      layout = map;
      onReady?.();
    }).catch(() => {});
  } catch {
    /* not offered — fallback table */
  }
}

/** Printed label of one physical key code. */
export function codeLabel(code) {
  if (SPECIAL[code]) return SPECIAL[code];
  const fromLayout = layout?.get?.(code);
  if (fromLayout && fromLayout.trim()) return fromLayout.toUpperCase();
  if (DE[code]) return DE[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** Label of a binding token ('Shift+KeyC' → 'Shift+C', 'Mouse0' → 'LMT'). */
export function tokenLabel(token) {
  if (!token) return '–';
  const shift = token.startsWith('Shift+');
  const code = shift ? token.slice(6) : token;
  return (shift ? 'Shift+' : '') + codeLabel(code);
}

export function padLabel(button) {
  return PAD[button] ?? `Knopf ${button}`;
}
