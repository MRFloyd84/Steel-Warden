import * as THREE from 'three';
import { makeCanvas } from './cockpit/canvasKit.js';

const dir = new THREE.Vector3();
const look = new THREE.Vector3();

/**
 * Nose camera of a missile: renders the world scene from the missile at a
 * low rate into a tiny render target, reads the pixels back and turns them
 * into a monochrome picture (luminance) on a canvas. The missile camera
 * page on a cockpit monitor draws that canvas with its own overlays.
 */
export class MissileCamera {
  constructor(glRenderer, { resolution = [160, 120], fov = 50, hz = 15 } = {}) {
    const [w, h] = resolution;
    this.gl = glRenderer;
    this.w = w;
    this.h = h;
    this.interval = 1 / hz;
    this.timer = 0;
    this.target = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
    this.camera = new THREE.PerspectiveCamera(fov, w / h, 0.5, 3000);
    this.pixels = new Uint8Array(w * h * 4);
    this.canvas = makeCanvas(w, h);
    this.ctx = this.canvas.getContext('2d');
    this.image = this.ctx.createImageData(w, h);
    this.frames = 0;
  }

  /**
   * Renders a new picture if it is time. beforeRender(camera) lets the
   * world move its sky dome; the caller restores it for the main camera.
   */
  update(dt, missile, scene, beforeRender) {
    this.timer += dt;
    if (!missile || this.timer < this.interval) return false;
    this.timer %= this.interval;
    const cam = this.camera;
    dir.copy(missile.vel).normalize();
    cam.position.copy(missile.pos).addScaledVector(dir, 1.2);
    cam.up.set(0, 1, 0);
    cam.lookAt(look.copy(cam.position).add(dir));
    cam.updateMatrixWorld();
    beforeRender(cam);
    const gl = this.gl;
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(this.target);
    gl.clear();
    gl.render(scene, cam);
    gl.readRenderTargetPixels(this.target, 0, 0, this.w, this.h, this.pixels);
    gl.setRenderTarget(prev);
    this.toMono();
    this.frames++;
    return true;
  }

  /** Luminance → grey (the monitor's phosphor tints it), flipped to canvas orientation. */
  toMono() {
    const { w, h, pixels } = this;
    const out = this.image.data;
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4;
      const dst = y * w * 4;
      for (let x = 0; x < w; x++) {
        const i = src + x * 4;
        // Lifted shadows (like a video tube) so terrain and walkers separate on the small screen
        const l0 = (0.3 * pixels[i] + 0.59 * pixels[i + 1] + 0.11 * pixels[i + 2]) / 255;
        const l = Math.min(255, 255 * Math.sqrt(l0) * 1.05);
        const o = dst + x * 4;
        out[o] = out[o + 1] = out[o + 2] = l;
        out[o + 3] = 255;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
  }

  dispose() {
    this.target.dispose();
  }
}
