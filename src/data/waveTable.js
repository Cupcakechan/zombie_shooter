// data/waveTable.js — wave composition as data. The TABLE is the hand-tuned
// onboarding; past its end, EXTEND generates waves forever (+COUNT_STEP
// zombies, +SPEED_STEP walk speed, +WINDOW_STEP window-entry share per
// wave, each capped). ENTRY mixes are 4.3c's pressure dial: perimeter
// zombies walk out of the fog at the map edge; window zombies materialize
// in the murk OUTSIDE a window, loiter a beat (the dread meter), then
// climb in. SPAWN_GAP staggers a wave's zombies so they arrive as a
// group, not a pop-in clump.

export const WAVES = {
  // TYPES (7d): each row's type mix, shares like the entry mix — rounded
// per-wave by largest remainder (typeAssignments), so shares survive
// count changes and new archetypes are just new keys. Prone-spawning
// types are auto-paired away from window entries (they can't climb).
// Past the table, EXTEND carries the LAST row's mix unchanged.
TABLE: [
  { count: 1, speedMult: 1.0,  entry: { perimeter: 1.0, window: 0 },
    types: { proto_zombie: 1.0 } },
  { count: 2, speedMult: 1.0,  entry: { perimeter: 1.0, window: 0 },
    types: { proto_zombie: 1.0 } },
  { count: 3, speedMult: 1.05, entry: { perimeter: 0.7, window: 0.3 },
    types: { proto_zombie: 1.0 } },
  { count: 4, speedMult: 1.1,  entry: { perimeter: 0.6, window: 0.4 },
    types: { proto_zombie: 0.75, crawler: 0.25 } },
   { count: 5, speedMult: 1.15, entry: { perimeter: 0.5, window: 0.5 },
    types: { proto_zombie: 0.6, crawler: 0.2, sprinter: 0.2 } },
  { count: 6, speedMult: 1.2,  entry: { perimeter: 0.5, window: 0.5 },
    types: { proto_zombie: 0.55, crawler: 0.15, sprinter: 0.2, brute: 0.1 } },
],
  EXTEND: {
    COUNT_STEP: 1,      // extra zombies per wave past the table
    SPEED_STEP: 0.05,   // extra speed multiplier per wave past the table
    SPEED_CAP: 1.4,     // shamblers, not sprinters — hard ceiling
    WINDOW_STEP: 0.03,  // extra window-entry share per wave past the table
    WINDOW_CAP: 0.6,    // sieges stay mixed — never all-window
  },
  HP: {                 // wave HP scaling (pass 12). No table column — a
                      //   formula covers every wave, so the table stays
                      //   the composition dial and this stays the
                      //   durability dial.
  RAMP_START: 8,      // the one-shot era ends HERE by design: through
                      //   this wave hpMult is 1.0, so HITBOX.HEAD 3
                      //   still one-shots the base HP 3 (suite-pinned)
  STEP: 0.15,         // extra HP multiplier per wave past RAMP_START
  CAP: 2.0,           // ceiling — base HP 3 tops out at 6 (torso
                      //   six-shot); LEG_HP deliberately does NOT scale:
                      //   crippling is a mobility kill, and cheap legs
                      //   late is the intended counterplay
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
