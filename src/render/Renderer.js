import * as THREE from 'three';
import { CONFIG } from '../data/config.js';

/**
 * WebGL renderer with two cameras: the world camera and the cockpit camera
 * (tiny near plane, own pass). Renders at a reduced internal resolution and
 * upscales with nearest-neighbour filtering for the chunky mid-90s look.
 */
export class Renderer {
  constructor(container, config) {
    this.config = config;
    this.renderScale = config.renderScale;
    this.renderer = new THREE.WebGLRenderer({
      antialias: config.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    const canvas = this.renderer.domElement;
    canvas.classList.add('game-canvas');
    container.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(config.fov, 1, config.near, config.far);
    this.cockpitCamera = new THREE.PerspectiveCamera(config.fov, 1, CONFIG.cockpit.near, CONFIG.cockpit.far);
    this.width = 0;
    this.height = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get canvas() {
    return this.renderer.domElement;
  }

  get info() {
    return this.renderer.info;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.cssWidth = w;
    this.cssHeight = h;
    this.width = Math.max(1, Math.floor(w * this.renderScale));
    this.height = Math.max(1, Math.floor(h * this.renderScale));
    this.renderer.setSize(this.width, this.height, false);
    for (const cam of [this.camera, this.cockpitCamera]) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
  }

  setRenderScale(scale) {
    this.renderScale = Math.min(1, Math.max(0.25, scale));
    this.resize();
  }

  beginFrame() {
    this.renderer.info.reset();
  }

  /** World only (menu flyover, debug free camera). */
  render(scene) {
    this.renderer.clear();
    this.renderer.render(scene, this.camera);
  }

  /** World, then the cockpit over it with a fresh depth buffer. */
  renderWithCockpit(worldScene, cockpitScene) {
    this.renderer.clear();
    this.renderer.render(worldScene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(cockpitScene, this.cockpitCamera);
  }

  /** Screen position (CSS px) of a world point, or null if behind the camera. */
  project(worldPoint, out) {
    out.copy(worldPoint).project(this.camera);
    if (out.z > 1) return null;
    return { x: (out.x * 0.5 + 0.5) * this.cssWidth, y: (-out.y * 0.5 + 0.5) * this.cssHeight };
  }
}
