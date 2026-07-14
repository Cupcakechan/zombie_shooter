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
      LEG: 0.5,           // same tier as LIMB — the leg tag changes the
                          // ACCOUNTING (crawl threshold), never the damage
                          // math (suite-pinned equal)
    },
SCORE: {              // the bounty (pass 10) — becomes spendable in pass 11.
  KILL: 100,          // base points per kill; a headshot kill pays
                      //   this times CONFIG.WAVES_SCORE.HEADSHOT_MULT
},

    BODY_RADIUS: 0.45,    // solid circle for player collision (walk-through-proof)
    WALL: {               // forward reach vs walls (4.3 clip fix): keeps the
      REACH: 0.75,        //   raised arms/head (MEASURED ~1.0 m past the feet)
      RADIUS: 0.25,       //   out of walls the body FACES; feet circle unchanged
    },
    VAULT: {              // window climb (4.3b)
      MS: 1100,           //   the whole haul-over — a fat free-hit telegraph
    },
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
      // Hit-flinch squash spring (pass 7c) — MEASURED at 60 fps: kick 11.5
      // gives a 25% squash peak, 5% stretch rebound, settled in ~350 ms.
      SQUASH_F: 5,        // spring frequency, Hz
      SQUASH_ZETA: 0.4,   // underdamped: the overshoot IS the flinch look
      SQUASH_KICK: 2,  // velocity impulse per hit — ~9% peak squash (kick × 0.022)
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
    // The Crawler (pass 7c): enough LEG damage destroys the legs — the
    // zombie collapses and keeps coming, prone, dragging itself on its
    // arms. Behavioral dismemberment: the threat transforms instead of
    // dying. Guarded everywhere — a type WITHOUT this block never crawls.
    CRAWL: {
      LEG_HP: 1.5,        // leg damage that destroys the legs: 3 leg hits
                          //   at the 0.5 LEG tier (suite-pinned arithmetic)
      FALL_MS: 550,       // the collapse — reads like the death fall, then
                          //   the arms catch it
      SPEED_MULT: 0.45,   // fraction of WALK_SPEED while prone
      STOP_DISTANCE: 1.1, // closer than the standing 2 — it claws at
                          //   ankles, not faces (suite asserts <= standing)
      ATTACK: {           // the crawl claw: slower tell, longer recovery
        RANGE_SLACK: 0.4,
        WINDUP_MS: 400,
        STRIKE_MS: 150,
        RECOVER_MS: 400,
        COOLDOWN_MS: 1500, // must cover the three phases (suite, relative)
        DAMAGE: 1,
        REAR_RAD: 1.05,   // rear-back from the PRONE arm rest — swings the
                          //   upper arm up past vertical-ish for the coiled
                          //   claw (probe-measured; feel report 2026-07-12)
        THRUST_RAD: 0.45, // the ground slam past the plant — lands the
                          //   hands ON the floor (−0.005 m, probe-measured),
                          //   not half a metre through it
      },
      WALL: {             // prone reach probe: lying down, the body chain
        REACH: 2.0,       //   extends up to ~2.2 m ahead of the feet origin
        RADIUS: 0.25,     //   (arms can point straight forward mid-pull) —
                          //   the standing 0.75 reach would bury the head
                          //   in any faced wall (suite pins REACH+RADIUS
                          //   against the registry-derived extent)
      },
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
// The Crawler as a SPAWNABLE type (7d): derived from the Shambler by
// spread, so shared dimensions stay single-source — only identity,
// durability, bounty, palette, and the PRONE spawn flag differ. Nested
// blocks being overridden are spread too, so untouched siblings survive
// a future hand-edit to the base (preserve hand-authored data).
const protoBase = ENEMY_TYPES.proto_zombie;
ENEMY_TYPES.crawler = {
  ...protoBase,
  id: 'crawler',
  HP: 2,                  // pre-crippled: torso two-shots; the head still
                          //   one-shots (HITBOX.HEAD 3 carries over ≥ HP)
  SCORE: { ...protoBase.SCORE, KILL: 125 }, // the low-profile premium —
                          //   a harder target pays more (pass 10 economy)
  COLORS: { ...protoBase.COLORS, CLOTH: 0x4a3038 }, // dried-blood cloth:
                          //   reads at fog distance where the silhouette
                          //   sits low against the street
  SPAWN: { ...protoBase.SPAWN, PRONE: true }, // enters the world already
                          //   down: legs gone, ground field, no climbing
                          //   reads at fog distance where the silhouette
                          //   sits low against the street
  SPAWN: { ...protoBase.SPAWN, PRONE: true }, // enters the world already
                          //   down: legs gone, ground field, no climbing
                          
};
// Pass 13 — the archetype expansion (report #3A). Both are registry
// spreads like the crawler: shared machinery (flow field, locational
// damage, windows, crawl transition, bounty scaling) applies with zero
// new wiring; only the numbers and flags differ.

// scaleBody: a uniformly bigger body as DATA. Every metric field (metres)
// multiplies by k; fields that are NOT lengths — fractions along a limb
// (KNEE_AT, ELBOW_AT) and angles in radians (HUNCH, COCK, TILT, REST_RAD)
// — pass through untouched, because scaling an angle would change the
// POSE, not the size. Returns a fresh deep copy: the base BODY is never
// mutated (preserve hand-authored data). The builder's small overlap
// constants (-0.06/-0.08) stay absolute, so a scaled body is measured,
// never assumed (LESSONS #19) — the suite re-derives its prone extent
// from these dims and the probe measured the standing reach below.
const NON_METRIC = new Set(['KNEE_AT', 'ELBOW_AT', 'HUNCH', 'COCK', 'TILT', 'REST_RAD']);
export function scaleBody(body, k) {
  const out = {};
  for (const [part, fields] of Object.entries(body)) {
    out[part] = {};
    for (const [key, v] of Object.entries(fields)) {
      out[part][key] = NON_METRIC.has(key) ? v : v * k;
    }
  }
  return out;
}

// The Sprinter (pass 13): low HP, high base speed — the "deal with me
// FIRST" question. Speed lives in WALK_SPEED, not the wave multiplier:
// EXTEND.SPEED_CAP caps the WAVE dial (shamblers never become sprinters),
// while a sprinter TYPE simply starts fast — the wave mult still applies
// on top (2.4 × 1.4 = 3.36 ceiling; suite pins that a base sprinter
// outruns even a capped shambler, the reason this is a type and not a
// mult). Head one-shots through the pre-ramp era like everything else
// (HP 2 < HEAD 3, §18's tying pin sweeps it) and stops one-shotting at
// hpMult > 1.5 — wave 12 — a deliberate late-game bite.
ENEMY_TYPES.sprinter = {
  ...protoBase,
  id: 'sprinter',
  HP: 2,
  SCORE: { ...protoBase.SCORE, KILL: 150 }, // fast targets pay a premium
  WALK_SPEED: 2.4,
  ANIM: {
    ...protoBase.ANIM,
    LIMP: 0.1,   // the drag leg mostly heals — a lurching RUN, not a shuffle
    LEAN: 0.25,  // aggressive forward pitch sells the sprint at fog distance
  },
  COLORS: {
    ...protoBase.COLORS,
    SKIN: 0x8f9a5a,   // jaundiced — paler than the Shambler's green
    CLOTH: 0x6a3a2a,  // rust rags
    EYES: 0xff6a3a,   // hot orange pinpricks — the first thing the fog shows
  },
};

// The Brute (pass 13): the camping-breaker. 1.25× body (probe-measured
// extents below), high HP, slow, and PERIMETER-ONLY — NO_CLIMB routes it
// onto the ground field (windows not traversable BY CONSTRUCTION, the 7c
// crawler guarantee generalized) and pairSpawns keeps it out of window
// spawn slots (7d repair). Brutes pressure the open ground while normals
// pour through glass. HEAVY declares it OUTSIDE the one-shot guarantee
// (HEAD 3 < HP 8 — ~3 headshots base, ~6 at the wave-HP cap); §18 pins
// that the flag is real, not stale. Legs stay cheap (LEG_HP unscaled by
// design) — crippling a brute into a huge slow crawler IS the counterplay.
ENEMY_TYPES.brute = {
  ...protoBase,
  id: 'brute',
  HP: 8,
  HEAVY: true,
  NO_CLIMB: true,
  SCORE: { ...protoBase.SCORE, KILL: 250 },
  WALK_SPEED: 0.75,
  BODY: scaleBody(protoBase.BODY, 1.25),
  BODY_RADIUS: 0.56,    // 0.45 × 1.25, the solid circle grows with the mass
  WALL: {               // standing forward reach — PROBE-MEASURED on the
    REACH: 0.94,        //   1.25× build: extent 1.156 m past the feet
    RADIUS: 0.31,       //   (sub-linear — absolute overlaps don't scale);
  },                    //   REACH + RADIUS = 1.25 covers, margin ~0.09
  CRAWL: {
    ...protoBase.CRAWL,
    WALL: {             // prone reach — the suite re-derives the chain
      REACH: 2.50,      //   extent from THESE dims (2.71 m) and pins
      RADIUS: 0.31,     //   REACH + RADIUS = 2.81 covers it
    },
  },
  COLORS: {
    ...protoBase.COLORS,
    SKIN: 0x5f7a55,     // darker, muddier green — mass reads dark
    CLOTH: 0x23262a,    // near-black bulk
  },
};
