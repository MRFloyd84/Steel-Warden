import * as THREE from 'three';
import { DEG } from '../util/math.js';
import { hash2 } from '../util/noise.js';

/**
 * Sky dome, fog, sun and ambient light for a theater + time of day.
 * The dome and starfield follow the camera so they never get closer.
 */
export class Environment {
  constructor(scene, theater, lighting, seed) {
    this.scene = scene;
    this.objects = [];

    const tint = new THREE.Color(lighting.tint);
    const zenith = new THREE.Color(theater.sky.zenith).multiply(tint).multiplyScalar(lighting.skyBrightness);
    const horizon = new THREE.Color(theater.sky.horizon).multiply(tint).multiplyScalar(lighting.skyBrightness);
    this.fogColor = horizon.clone();

    scene.background = horizon.clone();
    scene.fog = new THREE.Fog(horizon, theater.fog.near, theater.fog.far);

    const ambient = lighting.ambient * (theater.ambientScale ?? 1);
    const hemi = new THREE.HemisphereLight(zenith.clone().lerp(horizon, 0.5), new THREE.Color(theater.sky.ground), ambient);
    this.add(hemi);

    const sun = new THREE.DirectionalLight(new THREE.Color(lighting.sunColor), lighting.sunIntensity);
    const el = lighting.sunElevation * DEG;
    const az = lighting.sunAzimuth * DEG;
    sun.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(1000);
    this.add(sun);
    this.sun = sun;

    this.dome = this.createDome(zenith, horizon);
    this.add(this.dome);

    if (theater.stars || lighting.stars) {
      this.stars = this.createStars(seed);
      this.add(this.stars);
    }
  }

  add(obj) {
    this.scene.add(obj);
    this.objects.push(obj);
  }

  createDome(zenith, horizon) {
    const geo = new THREE.SphereGeometry(3000, 16, 10);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / 3000);
      c.copy(horizon).lerp(zenith, Math.pow(t, 0.6));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    return dome;
  }

  createStars(seed) {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = hash2(i, 1, seed);
      const v = hash2(i, 2, seed);
      const theta = u * Math.PI * 2;
      const y = 0.05 + v * 0.95; // upper hemisphere only
      const r = Math.sqrt(1 - y * y);
      positions.set([Math.cos(theta) * r * 2800, y * 2800, Math.sin(theta) * r * 2800], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2, sizeAttenuation: false, fog: false, depthWrite: false });
    const stars = new THREE.Points(geo, mat);
    stars.renderOrder = -9;
    stars.frustumCulled = false;
    return stars;
  }

  update(cameraPosition) {
    this.dome.position.copy(cameraPosition);
    this.stars?.position.copy(cameraPosition);
  }

  dispose() {
    for (const obj of this.objects) {
      this.scene.remove(obj);
      obj.geometry?.dispose();
      obj.material?.dispose();
      obj.dispose?.();
    }
    this.scene.fog = null;
    this.scene.background = null;
  }
}
