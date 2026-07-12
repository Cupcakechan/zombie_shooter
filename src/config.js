// config.js — the ONE place every tunable lives (mirrors DESIGN.md §8).
// Values are starting points, meant to be tuned one at a time. Groups marked
// "consumed later" are the contract for upcoming passes; the shell doesn't
// read them yet, but keeping the whole table here means later passes never
// invent constants elsewhere.

export const CONFIG = {
  // — Camera / look —
  FOV: 75,                    // degrees
  EYE_HEIGHT: 1.7,            // metres — camera Y
  MOUSE_SENSITIVITY: 0.002,   // radians per pixel of mouse movement
  PITCH_CLAMP_DEG: 85,        // max look up/down — stops camera flipping over

  // — Shooting (consumed by the shooting pass) —
  FIRE_COOLDOWN_MS: 150,      // semi-auto: clicks inside this window are ignored

  // — Round flow (consumed by the round pass) —
  ROUND_LENGTH_S: 60,
  COUNTDOWN_S: 3,

  // — Targets (consumed by the targets pass) —
  TARGETS_LIVE: 3,
  TARGET_RADIUS: 0.5,         // metres — visual = hitbox in Stage 1
  MIN_TARGET_SEPARATION: 2,   // metres between live target centres
  // Jittered slot grid (Option 3, picked 2026-07-11). Separation is guaranteed
  // by math, not runtime checks: worst case, two adjacent slots jitter toward
  // each other — lateral 5 − 2×1.5 = 2 m, depth 4 − 2×1.0 = 2 m — exactly
  // MIN_TARGET_SEPARATION. The suite asserts this, so changing any of these
  // numbers without re-checking the invariant fails the tests, not the game.
  // Jitter extremes push the effective envelope to x ±11.5, z −7…−21.
  SPAWN: {
    SLOT_XS: [-10, -5, 0, 5, 10], // lateral slot columns (5 m spacing)
    SLOT_ZS: [-8, -12, -16, -20], // depth slot rows (4 m spacing, downrange)
    JITTER_X: 1.5,                // per-spawn scatter, metres
    JITTER_Z: 1.0,
    Y_MIN: 0.8,                   // target centre height, drawn fresh each spawn
    Y_MAX: 2.2,
  },

  // — Scoring (consumed by the scoring pass) —
  POINTS_PER_HIT: 100,
  // Highest tier first — evaluation takes the first tier the streak reaches,
  // so keeping this sorted descending is load-bearing.
  STREAK_TIERS: [
    { streak: 20, mult: 3 },
    { streak: 10, mult: 2 },
  ],

  // — Feel (consumed by the feel pass) —
  POP_MS: 120,                // target pop animation
  RECOIL_MS: 60,
  RECOIL_KICK_DEG: 1,
  RECOIL_MS: 60,
  RECOIL_KICK_DEG: 1,
  RECOIL_KICK_BACK: 0.06,     // metres the gun slides toward the camera
  FLASH_MS: 50,               // muzzle flash lifetime
  FLASH_INTENSITY: 6,         // point-light peak at the muzzle

  // — Gun viewmodel (camera-space offset: right, down, forward) —
  GUN: {
    OFFSET_X: 0.28, OFFSET_Y: -0.22, OFFSET_Z: -0.55,
    RELOAD_DIP: 0.18,       // how far the viewmodel dips during a reload
  },

  // — Range environment (shell) —
  RANGE: {
    WIDTH: 30,                // x spans ±WIDTH/2
    BACK_Z: -30,              // far wall
    FRONT_Z: 4,               // wall behind the player (player stands at z=0)
    WALL_HEIGHT: 5,
  },
FOG: {
    NEAR: 18, FAR: 55, // distance fog: FAR past the back wall so it fades, not vanishes
    // Perimeter fog bank (pass 8.1, Waves only): fixed curtains hugging the
    // walls so zombies spawn inside the murk and walk out. DEPTH is per-wall
    // because spawn rows sit at different distances (back row is 6 m in from
    // the wall, side spawns only 2 m) — the suite asserts every spawn point
    // is covered.
    // Waves-mode distance fog (pass 8.2): pulled way in so the WHOLE arena
    // sits in murk — the back wall (30 m) is fully swallowed and zombies
    // resolve out of the haze as they close. Range keeps NEAR/FAR above.
    WAVES: { NEAR: 1, FAR: 13 },
    BANK: {
      HEIGHT: 5, // curtain height — matches RANGE.WALL_HEIGHT
      LAYERS: 3, // translucent curtains per wall
      OPACITY_MAX: 0.45, // layer nearest the wall
      OPACITY_MIN: 0.25, // innermost layer
      DEPTH: { BACK: 7, SIDE: 3, FRONT: 2 }, // metres each bank extends inward
    },
  },
  // — Palette (scene side; UI colours live as CSS variables in style.css) —
  // Provisional placeholder palette — retheme = edit this block + the CSS vars.
  COLORS: {
    SKY: 0x0a0d0b,
    FLOOR: 0x161a18,
    WALL: 0x101513,
    GRID_MAJOR: 0x2f3d36,
    GRID_MINOR: 0x1d2622,
    HEMI_SKY: 0x89a08c,
    HEMI_GROUND: 0x0e120f,
    SUN: 0xfff1d6,
  },

// — Blood (pass 8.3): world bursts + floor pools; screen splatter is CSS —
  BLOOD: {
    HIT_PARTICLES: 10,      // burst size for a landed shot
    KILL_PARTICLES: 22,     // extra burst on the killing blow
    PARTICLE_SIZE: 0.06,    // metres — little cubes, matching the blocky look
    PARTICLE_SPEED: 2.2,    // m/s initial spray speed
    PARTICLE_LIFE_MS: 600,  // shrink-to-nothing lifetime
    GRAVITY: 9,             // m/s² pulling droplets down
    POOL_RADIUS: 0.4,       // metres — floor stain size (randomly scaled ±)
    POOL_LINGER_MS: 8000,   // stain holds fully visible this long
    POOL_FADE_MS: 1000,     // then fades out over this
    COLOR: 0x7a1212,        // droplet red
    POOL_COLOR: 0x4a0d0d,   // stain dark red — reads as dried
    MAX_PARTICLES: 64,      // hard pool caps: worst case cost is fixed
    MAX_POOLS: 24,
  },
// — Casings (pass 8.4): ejected brass, pooled like BLOOD —
  CASINGS: {
    SIZE: 0.035,          // metres — shell length (cross-section is half)
    COLOR: 0xb08d2f,      // brass
    PORT_UP:  0.03,        // ejection port offset from the gun, camera-space
    PORT_FWD: -0.45,        //   (up and toward the muzzle)
    EJECT_SPEED: 1.6,     // m/s to the player's right
    EJECT_UP: 2.2,        // m/s upward arc
    JITTER: 0.5,          // random velocity spread per axis
    SPIN: 12,             // rad/s max tumble on each axis
    GRAVITY: 9,           // m/s² — matches BLOOD.GRAVITY
    RESTITUTION: 0.35,    // energy kept by the single bounce
    LINGER_MS: 3000,      // rest on the floor this long
    VANISH_MS: 250,       // then shrink away over this
    MAX: 40,              // hard pool cap
  },
  // — Ammo (pass 9): finite magazine, unlimited reserve, manual R reload —
  AMMO: {
    MAG_SIZE: 12,         // rounds per magazine — 4 kills at zombie HP 3
    RELOAD_MS: 1200,      // equals the zombie attack cooldown ON PURPOSE:
                          //   reloading in melee range risks eating a hit
    LOW_AT: 3,            // HUD counter turns red at/below this
  },
  // — Persistence (consumed by the results pass) —
  STORAGE_KEY: 'zombieShooter.v1.best',
  // — Debug (dev-only; the suite FAILS any truthy flag when the SHIP env
  // var is set — the pre-ship gate that keeps these out of a real build) —
  // — Player (waves mode) —
  PLAYER: {
    MAX_HITS: 5,            // arcade health: hits before game over
    DAMAGE_SHAKE_MS: 120,   // camera kick duration on taking a hit
    DAMAGE_SHAKE_AMP: 0.02, // radians of pitch wobble
    MOVE_SPEED: 4.5,        // m/s — comfortably outpaces capped zombies (1.68)
    WALL_MARGIN: 0.6,       // camera keeps this far from any wall
    BODY_RADIUS: 0.3,       // player's solid circle vs zombie bodies
  },
  DEBUG: {},
};
