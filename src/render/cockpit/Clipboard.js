import * as THREE from 'three';
import { makeCanvas, canvasTexture, fitText, STENCIL_FONT } from './canvasKit.js';

const PAPER_W = 384;
const PAPER_H = 512;
const TINTS = { day: 1, night: 0.8, off: 0.55, emergency: 0.5 };

/**
 * Checklist clipboard. Hangs beside the pilot; clicking it (or C) brings it
 * up in front of the eyes, where it follows the head until put away. The
 * paper is redrawn only when the checklist changes.
 */
export class Clipboard {
  constructor(def, walker) {
    this.walker = walker;
    this.object = new THREE.Group();
    this.object.name = 'clipboard';

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.29, 0.006),
      new THREE.MeshLambertMaterial({ color: '#5b4a33', flatShading: true }),
    );
    const clip = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.028, 0.012).translate(0, 0.128, 0.006),
      new THREE.MeshLambertMaterial({ color: '#9a9c94', flatShading: true }),
    );
    this.canvas = makeCanvas(PAPER_W, PAPER_H);
    this.texture = canvasTexture(this.canvas);
    this.paperMat = new THREE.MeshBasicMaterial({ map: this.texture });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.253), this.paperMat);
    paper.position.set(0, -0.01, 0.0035);
    this.object.add(board, clip, paper);
    this.pickables = [board, clip, paper];

    this.rest = {
      position: new THREE.Vector3().fromArray(def.position),
      quaternion: new THREE.Quaternion(),
    };
    // Face the pilot's eye, then tilt as configured.
    const m = new THREE.Matrix4().lookAt(this.rest.position, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    this.rest.quaternion.setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    this.rest.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...def.tilt.map((d) => (d * Math.PI) / 180))));
    this.heldDistance = def.heldDistance;
    this.object.position.copy(this.rest.position);
    this.object.quaternion.copy(this.rest.quaternion);

    this.up = false;
    this.t = 0;
    this.version = -1;
    this.tmpPos = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
  }

  toggle() {
    this.up = !this.up;
  }

  setLightMode(mode) {
    const k = TINTS[mode] ?? 1;
    this.paperMat.color.setRGB(k, mode === 'emergency' ? k * 0.55 : k, mode === 'emergency' ? k * 0.5 : k * 0.95);
  }

  /** @param camera cockpit camera (torso space) */
  update(dt, checklist, camera) {
    if (checklist.version !== this.version) {
      this.version = checklist.version;
      this.paint(checklist.view);
    }
    const target = this.up ? 1 : 0;
    this.t += Math.sign(target - this.t) * Math.min(Math.abs(target - this.t), dt / 0.35);
    const e = this.t * this.t * (3 - 2 * this.t);

    // Held pose: in front of the eyes, slightly low, square to the view.
    this.tmpPos.set(0, -0.035, -this.heldDistance).applyQuaternion(camera.quaternion).add(camera.position);
    this.tmpQuat.copy(camera.quaternion);
    this.object.position.lerpVectors(this.rest.position, this.tmpPos, e);
    this.object.quaternion.slerpQuaternions(this.rest.quaternion, this.tmpQuat, e);
  }

  paint(view) {
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = '#ece6d2';
    ctx.fillRect(0, 0, PAPER_W, PAPER_H);
    ctx.fillStyle = 'rgba(120,110,80,0.15)';
    for (let y = 120; y < PAPER_H - 30; y += 30) ctx.fillRect(14, y + 14, PAPER_W - 28, 1);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = view.restart ? '#9c1e12' : '#1d1c18';
    fitText(ctx, view.title, 16, 30, PAPER_W - 32, 22, 'bold', STENCIL_FONT);
    ctx.fillStyle = '#3c3a32';
    fitText(ctx, `${this.walker.name}  ·  S/N ${this.walker.cockpit.serial}`, 16, 58, PAPER_W - 32, 14, 'normal', STENCIL_FONT);
    ctx.fillRect(16, 76, PAPER_W - 32, 2);

    const rowH = Math.min(30, (PAPER_H - 140) / view.steps.length);
    view.steps.forEach((step, i) => {
      const y = 104 + i * rowH;
      if (i === view.current) {
        ctx.fillStyle = 'rgba(255,170,40,0.45)';
        ctx.fillRect(10, y - rowH / 2 + 2, PAPER_W - 20, rowH - 4);
        ctx.fillStyle = '#1d1c18';
        ctx.font = `bold 16px ${STENCIL_FONT}`;
        ctx.fillText('▶', 14, y);
      }
      ctx.strokeStyle = '#2a2924';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(34, y - 8, 16, 16);
      if (step.done) {
        ctx.strokeStyle = '#26407a'; // pencil tick
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(36, y);
        ctx.lineTo(41, y + 6);
        ctx.lineTo(52, y - 10);
        ctx.stroke();
      }
      ctx.fillStyle = step.done ? 'rgba(40,38,32,0.5)' : '#1d1c18';
      fitText(ctx, `${i + 1}. ${step.text}`, 60, y, PAPER_W - 74, 15, step.done ? 'normal' : 'bold', STENCIL_FONT);
    });
    ctx.fillStyle = '#5a574c';
    fitText(ctx, 'C / Klick: Klemmbrett holen und weglegen', 16, PAPER_H - 18, PAPER_W - 32, 12, 'normal', STENCIL_FONT);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.object.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.texture.dispose();
  }
}
