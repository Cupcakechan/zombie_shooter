// data/enemyTypes.js — the enemy registry. Same pattern as targetTypes.js:
// content as data, so pass 7's designed creatures become new entries flowing
// through the same spawn/update (and, from pass 4, hit) pipeline. Body
// dimensions live in the builder for now — they move here the day a second
// enemy type needs different proportions.

export const ENEMY_TYPES = {
  proto_zombie: {
    id: 'proto_zombie',
    WALK_SPEED: 1.2,      // m/s — shamble pace (26 m from spawn ≈ 22 s to reach you)
    STOP_DISTANCE: 2,     // m — where it halts; becomes the attack range in pass 5
    SPAWN: { x: 0, z: -28 }, // back-centre of the range
    COLORS: {
      SKIN: 0x7da06a,     // sickly green — distinct from the orange targets
      CLOTH: 0x343b3f,
    },
    ANIM: {
      BOB_AMP: 0.06,      // metres of vertical bob
      BOB_FREQ: 4.0,      // radians per metre WALKED — stride-locked, not time-locked
      SWAY_AMP: 0.10,     // radians of side-to-side roll
      SWAY_FREQ: 2.2,     // radians per metre walked
      IDLE_SWAY_FREQ: 0.0018, // radians per ms — keeps a STOPPED zombie subtly alive
      LEAN: 0.12,         // constant forward lean, radians
      ARM_WOBBLE: 0.08,   // radians of raised-arm bounce
    },
  },
};
