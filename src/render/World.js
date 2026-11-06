import * as THREE from 'three';
import { getTheater } from '../data/theaters.js';
import { getLighting } from '../data/lighting.js';
import { TerrainSampler } from './terrain/TerrainSampler.js';
import { TerrainManager } from './terrain/TerrainManager.js';
import { Environment } from './Environment.js';

/** Scene for one mission: environment + streamed terrain built from mission data. */
export class World {
  constructor(mission, terrainConfig) {
    this.mission = mission;
    this.theater = getTheater(mission.theater);
    this.scene = new THREE.Scene();

    const start = mission.playerStart;
    const gridStep = terrainConfig.chunkSize / terrainConfig.lodSegments[0];
    const flatZones = [{
      x: start.x, z: start.z, radius: 60, falloff: 90,
      minHeight: this.theater.terrain.startMinHeight,
    }];
    this.sampler = new TerrainSampler(this.theater.terrain, mission.seed, gridStep, flatZones);

    this.environment = new Environment(this.scene, this.theater, { ...getLighting(mission.timeOfDay), ...this.theater.lightingOverride }, mission.seed);
    this.terrain = new TerrainManager(this.scene, this.sampler, this.theater, terrainConfig, mission.seed);
  }

  /** Synchronously builds all chunks around a point (call before first frame). */
  preload(x, z) {
    this.terrain.update(x, z);
    this.terrain.flush();
  }

  update(focus) {
    this.terrain.update(focus.x, focus.z);
  }

  beforeRender(camera) {
    this.environment.update(camera.position);
  }

  dispose() {
    this.terrain.dispose();
    this.environment.dispose();
  }
}
