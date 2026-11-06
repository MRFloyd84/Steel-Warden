/** Global engine settings. Tune freely — nothing here is gameplay balance. */
export const CONFIG = {
  sim: {
    fixedStep: 1 / 60,
    maxStepsPerFrame: 5,
  },

  render: {
    // < 1 renders fewer pixels and upscales with hard edges (period look + speed).
    renderScale: 0.75,
    fov: 68,
    near: 0.5,
    far: 4000,
    antialias: false,
  },

  terrain: {
    chunkSize: 160, // metres per chunk edge
    // Segments per chunk edge for each LOD; LOD0 spacing = chunkSize / 40 = 4 m.
    lodSegments: [40, 20, 10],
    // Chebyshev ring distance (in chunks) up to which each LOD is used.
    lodRings: [1, 3],
    viewRadius: 6, // chunks around the camera
    buildsPerFrame: 3,
    skirtDepth: 14, // hides cracks between neighbouring LODs
  },

  // Phase-1 test camera; replaced by the walker in phase 2.
  testRig: {
    eyeHeight: 9,
    groundSpeed: 14,
    flySpeed: 60,
    boostFactor: 4,
    responsiveness: 4,
    minFlyClearance: 2,
  },

  debug: {
    refreshMs: 250,
  },
};
