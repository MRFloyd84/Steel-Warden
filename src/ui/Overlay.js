/** Base for HTML overlays: owns one root element inside the game container. */
export class Overlay {
  constructor(container, className) {
    this.root = document.createElement('div');
    this.root.className = `overlay ${className}`;
    this.root.hidden = true;
    container.appendChild(this.root);
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  get visible() {
    return !this.root.hidden;
  }

  destroy() {
    this.root.remove();
  }
}

/** Escapes text for safe insertion into innerHTML templates. */
export function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
