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
  GUN: { OFFSET_X: 0.28, OFFSET_Y: -0.22, OFFSET_Z: -0.55 },

  // — Range environment (shell) —
  RANGE: {
    WIDTH: 30,                // x spans ±WIDTH/2
    BACK_Z: -30,              // far wall
    FRONT_Z: 4,               // wall behind the player (player stands at z=0)
    WALL_HEIGHT: 5,
  },
  FOG: { NEAR: 18, FAR: 55 }, // FAR past the back wall so it fades, not vanishes

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

  // — Persistence (consumed by the results pass) —
  STORAGE_KEY: 'zombieShooter.v1.best',
  // — Debug (dev-only; the suite FAILS any truthy flag when the SHIP env
  // var is set — the pre-ship gate that keeps these out of a real build) —
  // — Player (waves mode) —
  PLAYER: {
    MAX_HITS: 5,            // arcade health: hits before game over
    DAMAGE_SHAKE_MS: 120,   // camera kick duration on taking a hit
    DAMAGE_SHAKE_AMP: 0.02, // radians of pitch wobble
  },
  DEBUG: { SPAWN_ZOMBIE: true },
};
