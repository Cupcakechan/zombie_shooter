// data/waveTable.js — wave composition as data. The TABLE is the hand-tuned
// onboarding; past its end, EXTEND generates waves forever (+COUNT_STEP
// zombies and +SPEED_STEP walk speed per wave, capped). Spawn points ring
// the arena's far half; SPAWN_GAP staggers a wave's zombies so they arrive
// as a group, not a pop-in clump.

export const WAVES = {
  TABLE: [
    { count: 1, speedMult: 1.0 },
    { count: 2, speedMult: 1.0 },
    { count: 3, speedMult: 1.05 },
    { count: 4, speedMult: 1.1 },
    { count: 5, speedMult: 1.15 },
  ],
  EXTEND: {
    COUNT_STEP: 1,     // extra zombies per wave past the table
    SPEED_STEP: 0.05,  // extra speed multiplier per wave past the table
    SPEED_CAP: 1.4,    // shamblers, not sprinters — hard ceiling
  },
  SPAWN_POINTS: [
    { x: 0, z: -28 },
    { x: -12, z: -28 },
    { x: 12, z: -28 },
    { x: -14, z: -18 },
    { x: 14, z: -18 },
  ],
  SPAWN_GAP_MS: 800,      // stagger between a wave's spawns
  INTERMISSION_MS: 2500,  // breather + banner between waves
  CROWD: {
    SEPARATION_RADIUS: 0.9, // zombies closer than this push apart
  },
};
