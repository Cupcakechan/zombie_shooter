// data/enemyTypes.js — the enemy registry. Same pattern as targetTypes.js:
// content as data, so pass 7's designed creatures become new entries flowing
// through the same spawn/update/hit/attack pipeline. Body dimensions live in
// the builder for now — they move here the day a second enemy type needs
// different proportions.

export const ENEMY_TYPES = {
  proto_zombie: {
    id: 'proto_zombie',
    HP: 3,                // hits to kill (any body part counts)
    WALK_SPEED: 1.2,      // m/s — shamble pace (26 m from spawn ≈ 22 s to reach you)
    STOP_DISTANCE: 2,     // m — where it halts and starts attacking
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
    COMBAT: {
      FLINCH_MS: 100,     // red flash on taking a hit
      STAGGER_MS: 200,    // movement pause per hit
      KNOCKBACK: 0.15,    // metres shoved away from the player per hit
    },
    ATTACK: {             // telegraphed swipe (player-forgiving convention)
      RANGE_SLACK: 0.5,   // attacks within STOP_DISTANCE + this (covers knockback drift)
      WINDUP_MS: 300,     // arms rear back — the tell; a hit here CANCELS the attack
      STRIKE_MS: 150,     // arms thrust; damage lands at the START of this phase
      RECOVER_MS: 300,    // return to pose
      COOLDOWN_MS: 1200,  // attack-start to attack-start; must cover the three
                          // phases above (suite-asserted, relatively)
      DAMAGE: 1,          // arcade hits removed per landed strike
      REAR_RAD: 0.6,      // how far the arms rear back in windup
      THRUST_RAD: 0.5,    // how far past the pose the strike thrusts
    },
    DEATH: {              // Option A (picked 2026-07-11): fall over
      FALL_MS: 600,       // pitch to the ground (eased, accelerating)
      LIE_MS: 1500,       // corpse holds on the floor
      FADE_MS: 400,       // fade out, then despawn
      CORPSE_LIFT: 0.12,  // metres the fallen body is raised so boxes rest ON
                          // the floor instead of half-sinking through it
    },
  },
};
