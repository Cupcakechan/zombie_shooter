// data/enemyTypes.js — the enemy registry. Same pattern as targetTypes.js:
// content as data, so pass 7's designed creatures become new entries flowing
// through the same spawn/update/hit/attack pipeline. Spawn POSITIONS live in
// waveTable.js (they're an arena property, not an enemy property). Body
// dimensions live in the builder until a second type needs different
// proportions.

export const ENEMY_TYPES = {
  proto_zombie: {
    id: 'proto_zombie',
    HP: 3,                // hits to kill (per-part damage below — pass 7b)
    // Per-part damage (pass 7b): the skill layer. At HP 3 — head one-shots,
    // torso is the reliable three-shot center mass, limb spray is punished.
    HITBOX: {
      HEAD: 3,
      TORSO: 1,
      LIMB: 0.5,
    },
    BODY_RADIUS: 0.45,    // solid circle for player collision (walk-through-proof)
    WALK_SPEED: 1.2,      // m/s base — waves multiply this per waveTable.js
    STOP_DISTANCE: 2,     // m — where it halts and starts attacking
    COLORS: {
      SKIN: 0x7da06a,     // sickly green — distinct from the orange targets
      CLOTH: 0x343b3f,
      FEET: 0x232527,     // darker ground anchors (anatomy rule: feet read darker)
      EYES: 0xffb832,     // sickly amber pinpricks — unlit + fog-free (enemyBody.js)
    },
    // The Shambler (pass 7a, Direction A): every box dimension lives HERE so
    // a future enemy type is pure data. Metres; the builder derives the
    // height stack bottom-up (feet → legs → belly → chest → head), so
    // retuning one part's size keeps everything attached.
    BODY: {
      FOOT:  { W: 0.20, H: 0.10, D: 0.28, FWD: 0.05 },
      LEG:   { W: 0.17, LEN: 0.68, D: 0.17, X: 0.13, KNEE_AT: 0.55 },
      BELLY: { W: 0.42, H: 0.34, D: 0.26 },
      CHEST: { W: 0.54, H: 0.44, D: 0.32, FWD: 0.10, HUNCH: 0.30 },
      HEAD:  { W: 0.40, H: 0.36, D: 0.34, FWD: 0.30, COCK: 0.12, TILT: -0.15 },
      JAW:   { W: 0.24, H: 0.10, D: 0.20, DROP: 0.06, FWD: 0.08 },
      EYE:   { SIZE: 0.06, X: 0.09, Y: 0.02, FWD: 0.02 },
      ARM:   { W: 0.13, LEN: 0.75, D: 0.13, X: 0.23, Y: 1.30, FWD: 0.14, REST_RAD: 1.85, ELBOW_AT: 0.55 },
      HAND:  { SIZE: 0.16 },
    },
    ANIM: {
      BOB_AMP: 0.05,      // metres of once-per-stride DIP onto the bad leg (7a.6 — was a symmetric bob)
      BOB_FREQ: 2.6,      // stride phase, radians per metre WALKED — drives legs, knees, and the dip together
      SWAY_AMP: 0.04,     // radians of side-to-side roll
      SWAY_FREQ: 1.3,     // MUST stay BOB_FREQ / 2: one roll per step, phase-locked to the stride
      IDLE_SWAY_FREQ: 0.0018, // radians per ms — keeps a STOPPED zombie subtly alive
      LEAN: 0.12,         // constant forward lean, radians
      ARM_WOBBLE: 0.08,   // radians of raised-arm bounce
      LEG_SWING: 0.5,     // radians of alternating hip swing while walking
      KNEE_REST: 0.15,    // permanent knee bend — the shuffle-crouch stance
      KNEE_BEND: 0.55,    // extra knee bend at mid-swing (quarter-stride lag)
      ELBOW_BEND: 0.45,   // rest elbow droop; the strike extends it to 0
      LIMP: 0.5,          // fraction removed from the RIGHT knee's bend — the stiff-leg drag
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
    SPAWN: {              // emergence from the fog bank (pass 8.1)
      FADE_MS: 600,       // opacity 0 → 1 as the zombie walks out of the murk
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
