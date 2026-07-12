// data/waveTable.js — wave composition as data. The TABLE is the hand-tuned
// onboarding; past its end, EXTEND generates waves forever (+COUNT_STEP
// zombies, +SPEED_STEP walk speed, +WINDOW_STEP window-entry share per
// wave, each capped). ENTRY mixes are 4.3c's pressure dial: perimeter
// zombies walk out of the fog at the map edge; window zombies materialize
// in the murk OUTSIDE a window, loiter a beat (the dread meter), then
// climb in. SPAWN_GAP staggers a wave's zombies so they arrive as a
// group, not a pop-in clump.

export const WAVES = {
  TABLE: [
    { count: 1, speedMult: 1.0,  entry: { perimeter: 1.0, window: 0 } },
    { count: 2, speedMult: 1.0,  entry: { perimeter: 1.0, window: 0 } },
    { count: 3, speedMult: 1.05, entry: { perimeter: 0.7, window: 0.3 } },
    { count: 4, speedMult: 1.1,  entry: { perimeter: 0.6, window: 0.4 } },
    { count: 5, speedMult: 1.15, entry: { perimeter: 0.5, window: 0.5 } },
  ],
  EXTEND: {
    COUNT_STEP: 1,      // extra zombies per wave past the table
    SPEED_STEP: 0.05,   // extra speed multiplier per wave past the table
    SPEED_CAP: 1.4,     // shamblers, not sprinters — hard ceiling
    WINDOW_STEP: 0.03,  // extra window-entry share per wave past the table
    WINDOW_CAP: 0.6,    // sieges stay mixed — never all-window
  },
  SPAWN: {
    MIN_PLAYER_DIST: 10,          // m — perimeter entries prefer spots at
                                  //   least this far from the player (fair)
    WINDOW_LOITER_MS: {           // the dread beat: a shape at the glass
      MIN: 900,                   //   before the sill creaks; randomized so
      MAX: 1600,                  //   multi-window waves stagger naturally
    },
  },
  SPAWN_GAP_MS: 800,      // stagger between a wave's spawns
  INTERMISSION_MS: 2500,  // breather + banner between waves
  CROWD: {
    SEPARATION_RADIUS: 0.9, // zombies closer than this push apart
  },
};
