import * as THREE from 'three';

/**
 * WebGL renderer + main camera. Renders at a reduced internal resolution
 * and upscales with nearest-neighbour filtering for the chunky mid-90s look.
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
    const canvas = this.renderer.domElement;
    canvas.classList.add('game-canvas');
    container.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(config.fov, 1, config.near, config.far);
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
    this.width = Math.max(1, Math.floor(w * this.renderScale));
    this.height = Math.max(1, Math.floor(h * this.renderScale));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setRenderScale(scale) {
    this.renderScale = Math.min(1, Math.max(0.25, scale));
    this.resize();
  }

  render(scene) {
    this.renderer.render(scene, this.camera);
  }
}
