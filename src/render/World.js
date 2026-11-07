import * as THREE from 'three';
import { getTheater } from '../data/theaters.js';
import { getLighting } from '../data/lighting.js';
import { TerrainSampler } from './terrain/TerrainSampler.js';
import { TerrainManager } from './terrain/TerrainManager.js';
import { Environment } from './Environment.js';
import { SITES, SCATTER_MODELS } from '../data/structures.js';
import { getWeather } from '../data/weather.js';
import { Weather } from './Weather.js';
import { WorldObjects } from '../world/WorldObjects.js';
import { ScatterField } from '../world/ScatterField.js';
import { ScatterRenderer, scatterHeights } from './world/ScatterRenderer.js';

/** Scene for one mission: environment + streamed terrain built from mission data. */
export class World {
  constructor(mission, terrainConfig, { bus = null, scatterConfig = {}, light = false, weather = null } = {}) {
    this.mission = mission;
    this.theater = withMissionOverrides(getTheater(mission.theater), mission);
    this.scene = new THREE.Scene();

    const start = mission.playerStart;
    const gridStep = terrainConfig.chunkSize / terrainConfig.lodSegments[0];
    const flatZones = [{
      x: start.x, z: start.z, radius: 60, falloff: 90,
      minHeight: this.theater.terrain.startMinHeight,
    }, ...siteFlatZones(mission)];
    this.sampler = new TerrainSampler(this.theater.terrain, mission.seed, gridStep, flatZones, mission.hills ?? [], {
      features: [...(this.theater.features ?? []), ...(mission.features ?? [])],
      surface: this.theater.surface,
    });
    this.sampler.gravity = this.theater.gravity ?? 1;

    this.lighting = { ...getLighting(mission.timeOfDay), ...this.theater.lightingOverride };
    this.weatherId = weather ?? mission.weather ?? this.theater.weather ?? 'clear';
    this.weatherDef = getWeather(this.weatherId);
    this.environment = new Environment(this.scene, this.theater, this.lighting, mission.seed, this.weatherDef);
    this.terrain = new TerrainManager(this.scene, this.sampler, this.theater, terrainConfig, mission.seed);

    // Scatter, buildings, weather (the menu flyover skips the heavy parts)
    const chunkSize = terrainConfig.chunkSize;
    const keepClear = [
      { x: start.x, z: start.z, r: 70 },
      ...(mission.spawns ?? []).map((sp) => ({ x: sp.at[0], z: sp.at[1], r: 18 })),
    ];
    this.scatter = new ScatterField({
      sampler: this.sampler, rules: light ? [] : this.theater.scatter ?? [], seed: mission.seed, chunkSize, keepClear, heights: scatterHeights(),
    });
    const models = [...new Set((this.theater.scatter ?? []).map((r) => r.model))].filter((m) => SCATTER_MODELS[m]);
    this.scatterView = light ? null : new ScatterRenderer(this.scene, this.scatter, models, scatterConfig);
    this.objects = new WorldObjects({
      scene: this.scene, sampler: this.sampler, mission, theater: light ? {} : this.theater, bus, scatter: this.scatter, seed: mission.seed, chunkSize,
    });
    this.structureView = scatterConfig.structureDistance ?? 1100;
    this.weather = light ? null : new Weather(this.scene, this.weatherDef);
  }

  /** Per frame: weather particles and fluid animation. */
  frame(dt, camera, focus) {
    this.terrain.tick(dt);
    this.weather?.update(dt, camera.position, this.sampler.heightAt(camera.position.x, camera.position.z));
    if (focus) this.objects.updateVisibility(focus.x, focus.z, this.structureView);
  }

  setViewportHeight(px) {
    this.weather?.setViewportHeight(px);
  }

  /** Synchronously builds all chunks around a point (call before first frame). */
  preload(x, z) {
    this.terrain.update(x, z);
    this.terrain.flush();
    this.objects.ensureAround(x, z);
    this.scatterView?.update(x, z);
  }

  update(focus) {
    this.terrain.update(focus.x, focus.z);
    this.objects.ensureAround(focus.x, focus.z);
    this.scatterView?.update(focus.x, focus.z);
  }

  beforeRender(camera) {
    this.environment.update(camera.position);
  }

  dispose() {
    this.weather?.dispose();
    this.scatterView?.dispose();
    this.objects.dispose();
    this.terrain.dispose();
    this.environment.dispose();
  }
}

/**
 * Mission-level overrides of the theater (test fields): terrainFeatures: false
 * drops the theater's features, surface replaces its ground mask, scatter: false
 * and autoStructures: false switch off scatter and rule-placed buildings,
 * surfaceColors adds ground colours.
 */
function withMissionOverrides(theater, m) {
  const t = { ...theater };
  if (m.terrainFeatures === false) t.features = [];
  if (m.surface) t.surface = m.surface;
  if (m.scatter === false) t.scatter = [];
  if (m.autoStructures === false) t.structureRules = [];
  if (m.surfaceColors) t.palette = { ...t.palette, surfaces: { ...t.palette.surfaces, ...m.surfaceColors } };
  if (m.surfaceTints) t.palette = { ...t.palette, tints: { ...t.palette.tints, ...m.surfaceTints } };
  return t;
}

/** Levelled ground under the mission's sites (data/structures.js → SITES). */
function siteFlatZones(mission) {
  return (mission.sites ?? []).map((site) => {
    const def = SITES[site.type];
    if (!def) throw new Error(`Unknown site "${site.type}"`);
    return { x: site.at[0], z: site.at[1], radius: def.flatten.radius, falloff: def.flatten.falloff };
  });
}
