import * as THREE from 'three';
import { ChunkBuilder } from './ChunkBuilder.js';

/**
 * Streams terrain chunks around a focus point. Chunks get a LOD by ring
 * distance; missing or wrong-LOD chunks are queued and built a few per frame.
 */
export class TerrainManager {
  constructor(scene, sampler, theater, config, seed) {
    this.scene = scene;
    this.config = config;
    this.builder = new ChunkBuilder(sampler, theater, config, seed);
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);

    this.chunks = new Map(); // key -> { mesh, lod }
    this.desired = new Map(); // key -> { cx, cz, lod, dist }
    this.queue = [];
    this.centerKey = null;
  }

  lodFor(ring) {
    const rings = this.config.lodRings;
    for (let i = 0; i < rings.length; i++) if (ring <= rings[i]) return i;
    return rings.length;
  }

  update(x, z) {
    const size = this.config.chunkSize;
    const ccx = Math.floor(x / size);
    const ccz = Math.floor(z / size);
    const key = `${ccx},${ccz}`;
    if (key !== this.centerKey) {
      this.centerKey = key;
      this.recomputeDesired(ccx, ccz);
    }
    this.processQueue(this.config.buildsPerFrame);
  }

  recomputeDesired(ccx, ccz) {
    const R = this.config.viewRadius;
    const limit = (R + 0.5) * (R + 0.5);
    this.desired.clear();
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const dist = dx * dx + dz * dz;
        if (dist > limit) continue;
        const cx = ccx + dx;
        const cz = ccz + dz;
        const lod = this.lodFor(Math.max(Math.abs(dx), Math.abs(dz)));
        this.desired.set(`${cx},${cz}`, { cx, cz, lod, dist });
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!this.desired.has(key)) {
        this.group.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        this.chunks.delete(key);
      }
    }

    this.queue = [];
    for (const [key, want] of this.desired) {
      const have = this.chunks.get(key);
      if (!have || have.lod !== want.lod) this.queue.push(key);
    }
    this.queue.sort((a, b) => this.desired.get(a).dist - this.desired.get(b).dist);
  }

  processQueue(budget) {
    let built = 0;
    while (this.queue.length && built < budget) {
      const key = this.queue.shift();
      const want = this.desired.get(key);
      if (!want) continue;
      this.buildChunk(key, want);
      built++;
    }
  }

  /** Builds everything pending immediately (used behind a loading screen). */
  flush() {
    this.processQueue(Infinity);
  }

  buildChunk(key, want) {
    const segments = this.config.lodSegments[want.lod];
    const geometry = this.builder.build(want.cx, want.cz, segments);
    const existing = this.chunks.get(key);
    if (existing) {
      existing.mesh.geometry.dispose();
      existing.mesh.geometry = geometry;
      existing.lod = want.lod;
      return;
    }
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(want.cx * this.config.chunkSize, 0, want.cz * this.config.chunkSize);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    this.chunks.set(key, { mesh, lod: want.lod });
  }

  setWireframe(on) {
    this.material.wireframe = on;
  }

  get stats() {
    const perLod = [0, 0, 0];
    for (const c of this.chunks.values()) perLod[c.lod] = (perLod[c.lod] ?? 0) + 1;
    return { chunks: this.chunks.size, queued: this.queue.length, perLod };
  }

  dispose() {
    for (const chunk of this.chunks.values()) chunk.mesh.geometry.dispose();
    this.chunks.clear();
    this.scene.remove(this.group);
    this.material.dispose();
  }
}
