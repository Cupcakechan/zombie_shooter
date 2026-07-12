// test_suite.mjs — committed headless suite. Run from the repo root:
//   node test_suite.mjs
// Pre-ship gate (all DEBUG flags must be false):
//   PowerShell:  $env:SHIP=1; node test_suite.mjs
//   cmd:         set SHIP=1&& node test_suite.mjs
//
// Section 0 — module health: imports EVERY src/**/*.js module under a minimal
// DOM stub, so parse errors, duplicate import bindings, and broken import
// paths fail HERE instead of in the browser. The browser must never be the
// first parser to see delivered code.
// Section 1 — spawn placement invariants (hand-computed, DESIGN.md §5/§8).
// Section 2 — scoring exact math (multiplier tiers, best streak, accuracy).
// Section 3 — round clock timing (countdown ticks, round end, resume rule).
// Section 4 — personal-best persistence contract (hermetic storage stub).
// Section 5 — config contract: schema (numbers FINITE) + usage scan of every
//             literal CONFIG.<path> read in src (incl. main.js) + registry
//             leaf sweep + the SHIP gate for DEBUG flags. Added after the
//             NaN-light incident (LESSONS.md 2026-07-11).
// Section 6 — enemy movement math (stop-ring clamping).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// — Minimal DOM stub (installed BEFORE any dynamic import) —
const noop = () => {};
const fakeEl = () => ({
  style: {},
  classList: { add: noop, remove: noop, toggle: noop },
  addEventListener: noop,
  appendChild: noop,
  setAttribute: noop,
  textContent: '',
});
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: fakeEl,
  addEventListener: noop,
  body: { appendChild: noop, addEventListener: noop },
  pointerLockElement: null,
  exitPointerLock: noop,
};
globalThis.window = {
  addEventListener: noop,
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 720,
};

const failures = [];

function assertNear(section, label, actual, expected) {
  const ok = Math.abs(actual - expected) < 1e-9;
  console.log(`  ${ok ? 'ok     ' : 'FAIL   '}${label}: ${actual} (expected ${expected})`);
  if (!ok) failures.push({ file: section, err: new Error(`${label}: ${actual} != ${expected}`) });
}

function assertTrue(section, label, cond) {
  console.log(`  ${cond ? 'ok     ' : 'FAIL   '}${label}`);
  if (!cond) failures.push({ file: section, err: new Error(label) });
}

// ————— Section 0: module health —————

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

// main.js is the boot entry: it needs a real canvas/WebGL context, so it is
// the one legitimate exclusion. Everything else must import cleanly.
const EXCLUDE = new Set([join('src', 'main.js')]);
// Guard-the-guard: exactly this many modules exist today. Raise it when a
// module is added; a drop below means a module silently went missing.
const MIN_EXPECTED_MODULES = 28;

const allSrcFiles = walk('src');
const files = allSrcFiles.filter((p) => !EXCLUDE.has(p));

console.log('— Section 0: module health —');
for (const file of files) {
  try {
    await import(pathToFileURL(file).href);
    console.log(`  ok     ${file}`);
  } catch (err) {
    failures.push({ file, err });
    console.log(`  FAIL   ${file}`);
    console.log(`         ${err.message}`);
  }
}
assertTrue(
  '(walker)',
  `walker found >= ${MIN_EXPECTED_MODULES} modules (found ${files.length})`,
  files.length >= MIN_EXPECTED_MODULES,
);

// ————— Section 1: spawn placement invariants —————

console.log('');
console.log('— Section 1: spawn placement invariants —');
try {
  const { computeSlots, jitterFromSlot } = await import(
    pathToFileURL(join('src', 'render', 'targets.js')).href
  );
  const { CONFIG } = await import(pathToFileURL(join('src', 'config.js')).href);
  const S = CONFIG.SPAWN;
  const slots = computeSlots();

  // 5 lateral × 4 depth = 20 distinct slots
  assertNear('section1', 'slot count', slots.length, S.SLOT_XS.length * S.SLOT_ZS.length);
  const keys = new Set(slots.map((s) => `${s.x}|${s.z}`));
  assertNear('section1', 'slots distinct', keys.size, slots.length);

  // Worst-case adjacent separation: two neighbouring slots jittered toward
  // each other. Hand-computed: lateral 5 − 2×1.5 = 2, depth 4 − 2×1.0 = 2.
  const minGap = (arr) => {
    const a = [...arr].sort((p, q) => p - q);
    let m = Infinity;
    for (let i = 1; i < a.length; i++) m = Math.min(m, a[i] - a[i - 1]);
    return m;
  };
  const worstX = minGap(S.SLOT_XS) - 2 * S.JITTER_X;
  const worstZ = minGap(S.SLOT_ZS) - 2 * S.JITTER_Z;
  assertNear('section1', 'worst-case lateral separation (m)', worstX, 2);
  assertNear('section1', 'worst-case depth separation (m)', worstZ, 2);
  assertTrue('section1', 'lateral separation >= MIN_TARGET_SEPARATION',
    worstX >= CONFIG.MIN_TARGET_SEPARATION - 1e-9);
  assertTrue('section1', 'depth separation >= MIN_TARGET_SEPARATION',
    worstZ >= CONFIG.MIN_TARGET_SEPARATION - 1e-9);

  // Jitter extremes: sweep every slot at rx/rz/ry ∈ {0,1} and pin the
  // envelope to the hand-computed values documented in DESIGN.md.
  let minX = Infinity; let maxX = -Infinity;
  let minZ = Infinity; let maxZ = -Infinity;
  let yInBand = true;
  for (const slot of slots) {
    for (const rx of [0, 1]) {
      for (const rz of [0, 1]) {
        for (const ry of [0, 1]) {
          const p = jitterFromSlot(slot, rx, rz, ry);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
          if (p.y < S.Y_MIN - 1e-9 || p.y > S.Y_MAX + 1e-9) yInBand = false;
        }
      }
    }
  }
  assertNear('section1', 'envelope x min', minX, -11.5);
  assertNear('section1', 'envelope x max', maxX, 11.5);
  assertNear('section1', 'envelope z far', minZ, -21);
  assertNear('section1', 'envelope z near', maxZ, -7);
  assertTrue('section1', 'heights inside Y_MIN..Y_MAX at extremes', yInBand);
} catch (err) {
  failures.push({ file: 'section1', err });
  console.log(`  FAIL   section 1 threw: ${err.message}`);
}

// ————— Section 2: scoring exact math —————

console.log('');
console.log('— Section 2: scoring exact math —');
try {
  const scoring = await import(pathToFileURL(join('src', 'game', 'scoring.js')).href);
  const {
    multiplierFor, registerHit, registerMiss,
    getScore, getStreak, getBestStreak, getMultiplier, getAccuracy, resetScoring,
  } = scoring;

  // Tier boundaries (×1 base, ×2 @ 10, ×3 @ 20 cap)
  assertNear('section2', 'multiplier at streak 0', multiplierFor(0), 1);
  assertNear('section2', 'multiplier at streak 9', multiplierFor(9), 1);
  assertNear('section2', 'multiplier at streak 10', multiplierFor(10), 2);
  assertNear('section2', 'multiplier at streak 19', multiplierFor(19), 2);
  assertNear('section2', 'multiplier at streak 20', multiplierFor(20), 3);
  assertNear('section2', 'multiplier capped at streak 100', multiplierFor(100), 3);

  // Fresh state: accuracy is null (not 0, not 1) before any shot
  resetScoring();
  assertTrue('section2', 'accuracy is null before any shot', getAccuracy() === null);

  // 25 consecutive hits, hand-computed:
  // hits 1–9 at ×1 = 900; hits 10–19 at ×2 = 2000; hits 20–25 at ×3 = 1800.
  resetScoring();
  for (let i = 0; i < 25; i++) registerHit();
  assertNear('section2', 'score after 25 straight hits', getScore(), 4700);
  assertNear('section2', 'streak after 25 straight hits', getStreak(), 25);
  assertNear('section2', 'best streak after 25 straight hits', getBestStreak(), 25);
  assertNear('section2', 'multiplier after 25 straight hits', getMultiplier(), 3);
  assertNear('section2', 'accuracy after 25/25', getAccuracy(), 1);

  // Miss resets the streak but keeps score AND best streak:
  // 12 hits = 9×100 + 3×200 = 1500; miss; next hit back at ×1 → 1600.
  resetScoring();
  for (let i = 0; i < 12; i++) registerHit();
  assertNear('section2', 'score after 12 straight hits', getScore(), 1500);
  registerMiss();
  assertNear('section2', 'streak resets on miss', getStreak(), 0);
  assertNear('section2', 'best streak survives the miss', getBestStreak(), 12);
  assertNear('section2', 'multiplier back to 1 on miss', getMultiplier(), 1);
  registerHit();
  assertNear('section2', 'hit after miss pays x1 (total)', getScore(), 1600);
  assertNear('section2', 'best streak still 12 after 1-hit rebuild', getBestStreak(), 12);
  assertNear('section2', 'accuracy 13 hits / 14 shots', getAccuracy(), 13 / 14);

  // Reset zeroes everything
  resetScoring();
  assertNear('section2', 'reset: score 0', getScore(), 0);
  assertNear('section2', 'reset: streak 0', getStreak(), 0);
  assertNear('section2', 'reset: best streak 0', getBestStreak(), 0);
  assertTrue('section2', 'reset: accuracy null again', getAccuracy() === null);
} catch (err) {
  failures.push({ file: 'section2', err });
  console.log(`  FAIL   section 2 threw: ${err.message}`);
}

// ————— Section 3: round clock timing —————

console.log('');
console.log('— Section 3: round clock timing —');
try {
  const round = await import(pathToFileURL(join('src', 'game', 'round.js')).href);
  const { CONFIG } = await import(pathToFileURL(join('src', 'config.js')).href);

  let ticks = [];
  let done = 0;
  let ended = 0;
  round.initRound({
    onCountdownTick: (n) => ticks.push(n),
    onCountdownDone: () => { done++; },
    onRoundEnd: () => { ended++; },
  });

  // Fresh round: 3-2-1 in 3 one-second steps, then the round clock arms.
  round.beginCountdown({ fresh: true });
  assertNear('section3', 'first tick shows immediately', ticks[0], CONFIG.COUNTDOWN_S);
  round.updateRound(1000);
  round.updateRound(1000);
  assertTrue('section3', `countdown ticks are 3,2,1 (got ${ticks.join(',')})`,
    ticks.join(',') === '3,2,1');
  assertNear('section3', 'countdown not done at t=2s', done, 0);
  round.updateRound(1000);
  assertNear('section3', 'countdown done fires exactly once', done, 1);
  assertNear('section3', 'round clock arms at full length', round.getRemainingS(), CONFIG.ROUND_LENGTH_S);

  // Run the round down: 59.5 s leaves the display at 0:01, not 0:00.
  round.updateRound(59500);
  assertNear('section3', 'display shows 1 through the last second', round.getRemainingS(), 1);
  assertNear('section3', 'round not ended at 59.5s', ended, 0);
  round.updateRound(500);
  assertNear('section3', 'round end fires exactly once', ended, 1);
  assertNear('section3', 'remaining clamps to 0', round.getRemainingS(), 0);
  round.updateRound(1000);
  assertNear('section3', 'no double round-end after idle', ended, 1);

  // Resume rule: fresh:false preserves the round clock across the 3-2-1.
  ticks = []; done = 0; ended = 0;
  round.beginCountdown({ fresh: true });
  round.updateRound(3000); // countdown done
  round.updateRound(5000); // 5s of play
  assertNear('section3', '55s remain after 5s of play', round.getRemainingS(), 55);
  round.beginCountdown({ fresh: false }); // pause → resume
  assertNear('section3', 'resume countdown keeps the clock', round.getRemainingS(), 55);
  round.updateRound(3000); // resume countdown done
  assertNear('section3', 'countdown consumed no round time', round.getRemainingS(), 55);
  round.updateRound(1000);
  assertNear('section3', 'clock resumes ticking after resume', round.getRemainingS(), 54);

  // Untimed (Waves) rule: the 3-2-1 runs, the round clock never does.
  ticks = []; done = 0; ended = 0;
  round.beginCountdown({ fresh: true, timed: false });
  round.updateRound(3000); // countdown done
  assertNear('section3', 'untimed: countdown still completes', done, 1);
  round.updateRound(120000); // two minutes of "play"
  assertNear('section3', 'untimed: round never ends', ended, 0);
  assertNear('section3', 'untimed: clock stays full', round.getRemainingS(), CONFIG.ROUND_LENGTH_S);
  // And untimed-ness survives a pause/resume cycle:
  round.beginCountdown({ fresh: false });
  round.updateRound(3000);
  round.updateRound(120000);
  assertNear('section3', 'untimed survives resume', ended, 0);
} catch (err) {
  failures.push({ file: 'section3', err });
  console.log(`  FAIL   section 3 threw: ${err.message}`);
}

// ————— Section 4: personal-best persistence contract —————

console.log('');
console.log('— Section 4: personal-best persistence —');
try {
  const best = await import(pathToFileURL(join('src', 'game', 'best.js')).href);

  // Without any localStorage (plain Node), everything is null-safe.
  assertTrue('section4', 'loadBest is null without storage', best.loadBest() === null);

  // Hermetic in-memory stub — best.js checks availability per call, so
  // installing it after import still takes effect.
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
  };

  const zero = best.saveBestIfBeaten(0, null);
  assertTrue('section4', 'score 0 never records a best', zero.isNew === false && zero.best === null);

  const first = best.saveBestIfBeaten(1200, 0.9);
  assertTrue('section4', 'first positive score is a new best', first.isNew === true);
  assertNear('section4', 'stored best score', best.loadBest().score, 1200);
  assertNear('section4', 'stored best accuracy', best.loadBest().accuracy, 0.9);

  const lower = best.saveBestIfBeaten(1100, 1);
  assertTrue('section4', 'lower score is not a new best', lower.isNew === false);
  assertNear('section4', 'lower score returns the standing best', lower.best.score, 1200);

  const tie = best.saveBestIfBeaten(1200, 1);
  assertTrue('section4', 'a tie is not a new best (strictly greater)', tie.isNew === false);

  const higher = best.saveBestIfBeaten(1300, 0.8);
  assertTrue('section4', 'higher score is a new best', higher.isNew === true);
  assertNear('section4', 'new best persists', best.loadBest().score, 1300);

  delete globalThis.localStorage;
} catch (err) {
  failures.push({ file: 'section4', err });
  console.log(`  FAIL   section 4 threw: ${err.message}`);
}

// ————— Section 5: config contract —————
// A parse-clean config with a missing constant shipped a black screen with
// zero console errors (NaN light intensity — see LESSONS.md 2026-07-11).
// Layers: a hand-maintained schema (covers destructured reads; EXTEND IT
// when adding constants), a usage scan of every literal CONFIG.<path> in
// src — including main.js, which section 0 can't import — a registry leaf
// sweep, and the SHIP gate for DEBUG flags.

console.log('');
console.log('— Section 5: config contract —');
try {
  const { CONFIG } = await import(pathToFileURL(join('src', 'config.js')).href);

  const SCHEMA = {
    'FOV': 'number', 'EYE_HEIGHT': 'number', 'MOUSE_SENSITIVITY': 'number',
    'PITCH_CLAMP_DEG': 'number', 'FIRE_COOLDOWN_MS': 'number',
    'ROUND_LENGTH_S': 'number', 'COUNTDOWN_S': 'number',
    'TARGETS_LIVE': 'number', 'TARGET_RADIUS': 'number', 'MIN_TARGET_SEPARATION': 'number',
    'SPAWN.SLOT_XS': 'numberArray', 'SPAWN.SLOT_ZS': 'numberArray',
    'SPAWN.JITTER_X': 'number', 'SPAWN.JITTER_Z': 'number',
    'SPAWN.Y_MIN': 'number', 'SPAWN.Y_MAX': 'number',
    'POINTS_PER_HIT': 'number', 'STREAK_TIERS': 'tierArray',
    'POP_MS': 'number', 'RECOIL_MS': 'number', 'RECOIL_KICK_DEG': 'number',
    'RECOIL_KICK_BACK': 'number', 'FLASH_MS': 'number', 'FLASH_INTENSITY': 'number',
    'GUN.OFFSET_X': 'number', 'GUN.OFFSET_Y': 'number', 'GUN.OFFSET_Z': 'number',
    'RANGE.WIDTH': 'number', 'RANGE.BACK_Z': 'number', 'RANGE.FRONT_Z': 'number',
    'RANGE.WALL_HEIGHT': 'number', 'FOG.NEAR': 'number', 'FOG.FAR': 'number',
    'FOG.WAVES.NEAR': 'number', 'FOG.WAVES.FAR': 'number',
    'FOG.BANK.HEIGHT': 'number', 'FOG.BANK.LAYERS': 'number',
    'FOG.BANK.OPACITY_MAX': 'number', 'FOG.BANK.OPACITY_MIN': 'number',
    'FOG.BANK.DEPTH.BACK': 'number', 'FOG.BANK.DEPTH.SIDE': 'number',
    'FOG.BANK.DEPTH.FRONT': 'number',
    'COLORS.SKY': 'number', 'COLORS.FLOOR': 'number', 'COLORS.WALL': 'number',
    'COLORS.GRID_MAJOR': 'number', 'COLORS.GRID_MINOR': 'number',
    'COLORS.HEMI_SKY': 'number', 'COLORS.HEMI_GROUND': 'number', 'COLORS.SUN': 'number',
    'STORAGE_KEY': 'string',
    'BLOOD.HIT_PARTICLES': 'number', 'BLOOD.KILL_PARTICLES': 'number',
    'BLOOD.PARTICLE_SIZE': 'number', 'BLOOD.PARTICLE_SPEED': 'number',
    'BLOOD.PARTICLE_LIFE_MS': 'number', 'BLOOD.GRAVITY': 'number',
    'BLOOD.POOL_RADIUS': 'number', 'BLOOD.POOL_LINGER_MS': 'number',
    'BLOOD.POOL_FADE_MS': 'number', 'BLOOD.COLOR': 'number',
    'BLOOD.POOL_COLOR': 'number', 'BLOOD.MAX_PARTICLES': 'number',
    'BLOOD.MAX_POOLS': 'number',
    'CASINGS.SIZE': 'number', 'CASINGS.COLOR': 'number',
    'CASINGS.PORT_UP': 'number', 'CASINGS.PORT_FWD': 'number',
    'CASINGS.EJECT_SPEED': 'number', 'CASINGS.EJECT_UP': 'number',
    'CASINGS.JITTER': 'number', 'CASINGS.SPIN': 'number',
    'CASINGS.GRAVITY': 'number', 'CASINGS.RESTITUTION': 'number',
    'CASINGS.LINGER_MS': 'number', 'CASINGS.VANISH_MS': 'number',
    'CASINGS.MAX': 'number',
    'AMMO.MAG_SIZE': 'number', 'AMMO.RELOAD_MS': 'number', 'AMMO.LOW_AT': 'number',
    'GUN.RELOAD_DIP': 'number',
    'PLAYER.MAX_HITS': 'number', 'PLAYER.DAMAGE_SHAKE_MS': 'number',
    'PLAYER.DAMAGE_SHAKE_AMP': 'number', 'PLAYER.MOVE_SPEED': 'number',
    'PLAYER.WALL_MARGIN': 'number', 'PLAYER.BODY_RADIUS': 'number',
    'NAV.BEELINE_DIST': 'number', 'NAV.TURN_RATE': 'number',
    'NAV.WINDOW_COST': 'number', 'NAV.VAULT_TRIGGER': 'number',
  };

  const resolvePath = (obj, path) =>
    path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  let schemaFails = 0;
  for (const [path, kind] of Object.entries(SCHEMA)) {
    const v = resolvePath(CONFIG, path);
    let ok = false;
    if (kind === 'number') ok = typeof v === 'number' && Number.isFinite(v);
    else if (kind === 'string') ok = typeof v === 'string' && v.length > 0;
    else if (kind === 'boolean') ok = typeof v === 'boolean';
    else if (kind === 'numberArray') ok = Array.isArray(v) && v.length > 0 && v.every((n) => Number.isFinite(n));
    else if (kind === 'tierArray') ok = Array.isArray(v) && v.length > 0 && v.every((t) => Number.isFinite(t?.streak) && Number.isFinite(t?.mult));
    if (!ok) {
      schemaFails++;
      console.log(`  FAIL   schema: ${path} (${kind}) got ${JSON.stringify(v)}`);
      failures.push({ file: 'section5', err: new Error(`schema ${path}`) });
    }
  }
  if (schemaFails === 0) {
    console.log(`  ok     schema: all ${Object.keys(SCHEMA).length} required keys present, typed, finite`);
  }

  // The descending order is load-bearing (first tier reached wins).
  const tiers = CONFIG.STREAK_TIERS;
  assertTrue('section5', 'STREAK_TIERS sorted descending',
    tiers.every((t, i) => i === 0 || tiers[i - 1].streak > t.streak));

  // Usage scan: every literal CONFIG.<path> in src must resolve; number
  // leaves must be finite. Text-level, so it covers main.js too.
  const refRe = /CONFIG\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;
  const seen = new Map(); // path -> file first seen in
  for (const f of allSrcFiles) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(refRe)) {
      if (!seen.has(m[1])) seen.set(m[1], f);
    }
  }
  let scanFails = 0;
  for (const [path, file] of seen) {
    const v = resolvePath(CONFIG, path);
    const bad = v === undefined || (typeof v === 'number' && !Number.isFinite(v));
    if (bad) {
      scanFails++;
      console.log(`  FAIL   unresolved CONFIG.${path} (read in ${file})`);
      failures.push({ file: 'section5', err: new Error(`unresolved CONFIG.${path}`) });
    }
  }
  if (scanFails === 0) {
    console.log(`  ok     usage scan: ${seen.size} distinct CONFIG reads all resolve`);
  }
  // Guard-the-guard: a rotted regex finding nothing must fail, not pass.
  assertTrue('section5', `usage scan found >= 15 reads (found ${seen.size})`, seen.size >= 15);

  // Registries get the same finite-leaf guarantee as CONFIG.
  const { TARGET_TYPES } = await import(pathToFileURL(join('src', 'data', 'targetTypes.js')).href);
  const { ENEMY_TYPES } = await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const { WAVES } = await import(pathToFileURL(join('src', 'data', 'waveTable.js')).href);
  let leafCount = 0;
  let regFails = 0;
  const checkLeaf = (v, p) => {
    leafCount++;
    const bad = v === undefined || (typeof v === 'number' && !Number.isFinite(v));
    if (bad) {
      regFails++;
      console.log(`  FAIL   registry leaf ${p} = ${v}`);
      failures.push({ file: 'section5', err: new Error(`registry ${p}`) });
    }
  };
  const sweepRegistry = (obj, path) => {
    for (const [k, v] of Object.entries(obj)) {
      const p = `${path}.${k}`;
      if (Array.isArray(v)) {
        v.forEach((item, idx) => {
          if (item && typeof item === 'object') sweepRegistry(item, `${p}[${idx}]`);
          else checkLeaf(item, `${p}[${idx}]`);
        });
      } else if (v && typeof v === 'object') {
        sweepRegistry(v, p);
      } else {
        checkLeaf(v, p);
      }
    }
  };
  sweepRegistry(TARGET_TYPES, 'TARGET_TYPES');
  sweepRegistry(ENEMY_TYPES, 'ENEMY_TYPES');
  sweepRegistry(WAVES, 'WAVES');
  if (regFails === 0) {
    console.log(`  ok     registries: ${leafCount} leaves defined and finite`);
  }
  assertTrue('section5', `registry sweep found >= 10 leaves (found ${leafCount})`, leafCount >= 10);

  // Enemy-registry SCHEMA — the sweep above validates fields that EXIST;
  // this names the fields that MUST exist. A missing registry number NaNs
  // exactly like a missing config key (2026-07-11 movement incident,
  // branch (b)) — extend this list when enemies gain required fields.
  const ENEMY_REQUIRED = [
    'HP', 'BODY_RADIUS', 'WALK_SPEED', 'STOP_DISTANCE',
    'HITBOX.HEAD', 'HITBOX.TORSO', 'HITBOX.LIMB',
    'COLORS.SKIN', 'COLORS.CLOTH', 'COLORS.FEET', 'COLORS.EYES',
    'BODY.FOOT.W', 'BODY.FOOT.H', 'BODY.FOOT.D', 'BODY.FOOT.FWD',
    'BODY.LEG.W', 'BODY.LEG.LEN', 'BODY.LEG.D', 'BODY.LEG.X', 'BODY.LEG.KNEE_AT',
    'BODY.BELLY.W', 'BODY.BELLY.H', 'BODY.BELLY.D',
    'BODY.CHEST.W', 'BODY.CHEST.H', 'BODY.CHEST.D', 'BODY.CHEST.FWD',
    'BODY.CHEST.HUNCH',
    'BODY.HEAD.W', 'BODY.HEAD.H', 'BODY.HEAD.D', 'BODY.HEAD.FWD',
    'BODY.HEAD.COCK', 'BODY.HEAD.TILT',
    'BODY.JAW.W', 'BODY.JAW.H', 'BODY.JAW.D', 'BODY.JAW.DROP', 'BODY.JAW.FWD',
    'BODY.EYE.SIZE', 'BODY.EYE.X', 'BODY.EYE.Y', 'BODY.EYE.FWD',
    'BODY.ARM.W', 'BODY.ARM.LEN', 'BODY.ARM.D', 'BODY.ARM.X',
    'BODY.ARM.Y', 'BODY.ARM.FWD', 'BODY.ARM.REST_RAD', 'BODY.ARM.ELBOW_AT',
    'BODY.HAND.SIZE',
    'ANIM.BOB_AMP', 'ANIM.BOB_FREQ', 'ANIM.SWAY_AMP', 'ANIM.SWAY_FREQ',
    'ANIM.IDLE_SWAY_FREQ', 'ANIM.LEAN', 'ANIM.ARM_WOBBLE', 'ANIM.LEG_SWING',
    'ANIM.KNEE_REST', 'ANIM.KNEE_BEND', 'ANIM.ELBOW_BEND', 'ANIM.LIMP',
    'COMBAT.FLINCH_MS', 'COMBAT.STAGGER_MS', 'COMBAT.KNOCKBACK',
    'COMBAT.SQUASH_F', 'COMBAT.SQUASH_ZETA', 'COMBAT.SQUASH_KICK',
    'ATTACK.RANGE_SLACK', 'ATTACK.WINDUP_MS', 'ATTACK.STRIKE_MS',
    'ATTACK.RECOVER_MS', 'ATTACK.COOLDOWN_MS', 'ATTACK.DAMAGE',
    'ATTACK.REAR_RAD', 'ATTACK.THRUST_RAD',
    'SPAWN.FADE_MS',
    'DEATH.FALL_MS', 'DEATH.LIE_MS', 'DEATH.FADE_MS', 'DEATH.CORPSE_LIFT',
  ];
  let enemySchemaFails = 0;
  for (const [typeId, type] of Object.entries(ENEMY_TYPES)) {
    for (const fieldPath of ENEMY_REQUIRED) {
      const v = resolvePath(type, fieldPath);
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        enemySchemaFails++;
        console.log(`  FAIL   enemy schema: ${typeId}.${fieldPath} got ${JSON.stringify(v)}`);
        failures.push({ file: 'section5', err: new Error(`enemy schema ${typeId}.${fieldPath}`) });
      }
    }
  }
  if (enemySchemaFails === 0) {
    console.log(`  ok     enemy schema: ${Object.keys(ENEMY_TYPES).length} type(s) × ${ENEMY_REQUIRED.length} required numeric fields present`);
  }

  // SHIP gate: with the SHIP env var set, every DEBUG flag must be false.
  const truthyFlags = Object.entries(CONFIG.DEBUG || {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (process.env.SHIP) {
    assertTrue('section5',
      `SHIP gate: all DEBUG flags false (truthy: ${truthyFlags.join(', ') || 'none'})`,
      truthyFlags.length === 0);
  } else {
    console.log(`  info   DEBUG flags truthy: ${truthyFlags.join(', ') || 'none'} (SHIP gate not active)`);
  }
} catch (err) {
  failures.push({ file: 'section5', err });
  console.log(`  FAIL   section 5 threw: ${err.message}`);
}

// ————— Section 6: enemy movement math —————

console.log('');
console.log('— Section 6: enemy movement + death timeline —');
try {
  const { advanceDistance, deathPhase } = await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  const { ENEMY_TYPES } = await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);

  assertNear('section6', 'full-speed step (10 m away, 2 m/s, 1 s)', advanceDistance(10, 2, 1000, 2), 2);
  assertNear('section6', 'clamps exactly onto the stop ring (from 2.5 m)', advanceDistance(2.5, 2, 1000, 2), 0.5);
  assertNear('section6', 'on the ring: no movement', advanceDistance(2, 2, 1000, 2), 0);
  assertNear('section6', 'inside the ring: never negative', advanceDistance(1.5, 2, 1000, 2), 0);
  assertNear('section6', 'sub-second precision (1.2 m/s, 500 ms)', advanceDistance(10, 1.2, 500, 2), 0.6);

  // Death timeline: boundaries computed FROM the registry timings, so tuning
  // FALL/LIE/FADE never breaks the suite — only reordering the phases would.
  const D = ENEMY_TYPES.proto_zombie.DEATH;
  assertTrue('section6', 'death t=0 is falling (k=0)',
    deathPhase(0, D).phase === 'falling' && deathPhase(0, D).k === 0);
  assertNear('section6', 'falling midpoint k', deathPhase(D.FALL_MS / 2, D).k, 0.5);
  assertTrue('section6', 'fall end flips to lying',
    deathPhase(D.FALL_MS, D).phase === 'lying');
  assertTrue('section6', 'lie end flips to fading (k=0)',
    deathPhase(D.FALL_MS + D.LIE_MS, D).phase === 'fading'
    && deathPhase(D.FALL_MS + D.LIE_MS, D).k === 0);
  assertNear('section6', 'fading midpoint k',
    deathPhase(D.FALL_MS + D.LIE_MS + D.FADE_MS / 2, D).k, 0.5);
  assertTrue('section6', 'timeline ends in done',
    deathPhase(D.FALL_MS + D.LIE_MS + D.FADE_MS, D).phase === 'done');

  // Blood-pool timeline (pass 8.3): same relative-boundary convention as the
  // death timeline — retuning LINGER/FADE never breaks these.
  const { poolPhase } = await import(pathToFileURL(join('src', 'render', 'bloodFX.js')).href);
  const { CONFIG: BCFG } = await import(pathToFileURL(join('src', 'config.js')).href);
  const PB = BCFG.BLOOD;
  assertTrue('section6', 'pool t=0 is solid at full opacity',
    poolPhase(0, PB.POOL_LINGER_MS, PB.POOL_FADE_MS).opacity === 1);
  assertNear('section6', 'pool fade midpoint opacity',
    poolPhase(PB.POOL_LINGER_MS + PB.POOL_FADE_MS / 2, PB.POOL_LINGER_MS, PB.POOL_FADE_MS).opacity, 0.5);
  assertTrue('section6', 'pool past fade is done',
    poolPhase(PB.POOL_LINGER_MS + PB.POOL_FADE_MS, PB.POOL_LINGER_MS, PB.POOL_FADE_MS).phase === 'done');

  // Casing timeline (pass 8.4): same relative-boundary convention.
  const { landedScale } = await import(pathToFileURL(join('src', 'render', 'casings.js')).href);
  const CC = BCFG.CASINGS;
  assertTrue('section6', 'casing t=0 rests at full scale',
    landedScale(0, CC.LINGER_MS, CC.VANISH_MS).scale === 1);
  assertNear('section6', 'casing vanish midpoint scale',
    landedScale(CC.LINGER_MS + CC.VANISH_MS / 2, CC.LINGER_MS, CC.VANISH_MS).scale, 0.5);
  assertTrue('section6', 'casing past vanish is done',
    landedScale(CC.LINGER_MS + CC.VANISH_MS, CC.LINGER_MS, CC.VANISH_MS).phase === 'done');
} catch (err) {
  failures.push({ file: 'section6', err });
  console.log(`  FAIL   section 6 threw: ${err.message}`);
}

// ————— Section 7: player health + attack pacing —————

console.log('');
console.log('— Section 7: player health + attack pacing —');
try {
  const player = await import(pathToFileURL(join('src', 'game', 'player.js')).href);
  const { CONFIG } = await import(pathToFileURL(join('src', 'config.js')).href);
  const { ENEMY_TYPES } = await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);

  player.resetPlayer();
  assertNear('section7', 'fresh player at MAX_HITS', player.getHits(), CONFIG.PLAYER.MAX_HITS);
  // Damage down to exactly 1: still alive.
  for (let i = 0; i < CONFIG.PLAYER.MAX_HITS - 1; i++) player.damagePlayer(1);
  assertTrue('section7', 'alive at 1 hit remaining', !player.isDead());
  player.damagePlayer(1);
  assertTrue('section7', 'dead exactly at 0', player.isDead());
  player.damagePlayer(5);
  assertNear('section7', 'overkill clamps at 0', player.getHits(), 0);
  player.resetPlayer();
  assertTrue('section7', 'reset revives to full', !player.isDead()
    && player.getHits() === CONFIG.PLAYER.MAX_HITS);

  // Attack pacing invariant (relative, so retuning stays safe): the
  // start-to-start cooldown must cover windup + strike + recover, or two
  // attacks could overlap their animations.
  const AT = ENEMY_TYPES.proto_zombie.ATTACK;
  assertTrue('section7', 'attack cooldown covers windup+strike+recover',
    AT.COOLDOWN_MS >= AT.WINDUP_MS + AT.STRIKE_MS + AT.RECOVER_MS);
} catch (err) {
  failures.push({ file: 'section7', err });
  console.log(`  FAIL   section 7 threw: ${err.message}`);
}

// ————— Section 8: wave composition math —————

console.log('');
console.log('— Section 8: wave composition math —');
try {
  const { waveSpec } = await import(pathToFileURL(join('src', 'game', 'waves.js')).href);
  const { WAVES } = await import(pathToFileURL(join('src', 'data', 'waveTable.js')).href);
  const { TABLE, EXTEND } = WAVES;
  const L = TABLE.length;
  const last = TABLE[L - 1];

  // Table waves come back verbatim (relative: retuning the table stays safe).
  let tableOk = true;
  for (let n = 1; n <= L; n++) {
    const s = waveSpec(n);
    if (s.count !== TABLE[n - 1].count || Math.abs(s.speedMult - TABLE[n - 1].speedMult) > 1e-9) {
      tableOk = false;
    }
  }
  assertTrue('section8', `table waves 1..${L} match the table verbatim`, tableOk);

  // Extension formula: hand-relative expectations three waves past the table.
  const ext = waveSpec(L + 3);
  assertNear('section8', 'extended count follows COUNT_STEP',
    ext.count, last.count + 3 * EXTEND.COUNT_STEP);
  assertNear('section8', 'extended speed follows SPEED_STEP (pre-cap)',
    ext.speedMult, Math.min(EXTEND.SPEED_CAP, last.speedMult + 3 * EXTEND.SPEED_STEP));

  // The cap engages far out.
  assertNear('section8', 'speed cap engages at wave 99', waveSpec(99).speedMult, EXTEND.SPEED_CAP);

  // Counts never shrink wave-over-wave (the table itself must honour this too).
  let monotonic = true;
  for (let n = 2; n <= 12; n++) {
    if (waveSpec(n).count < waveSpec(n - 1).count) monotonic = false;
  }
  assertTrue('section8', 'wave counts are non-decreasing (1..12)', monotonic);

  // Fog-bank coverage (pass 8.1, reworked for 4.3c): every PERIMETER
  // SPAWN CELL on the chosen edges (north/east/west — main's set) must
  // sit INSIDE a bank volume, or that zombie pops into view instead of
  // walking out of the murk. The south edge is excluded BECAUSE it sits
  // 1.4 m short of the front bank — this probe is why. Window entries are
  // exempt by design: materializing at the glass IS the dread beat, and
  // the loiter makes the appearance intentional.
  const { CONFIG: CFG } = await import(pathToFileURL(join('src', 'config.js')).href);
  const { MAPS: S8MAPS } = await import(pathToFileURL(join('src', 'data', 'maps.js')).href);
  const { parseLayout: s8parse, cellToWorld: s8c2w, perimeterSpawnCells: s8perim } =
    await import(pathToFileURL(join('src', 'game', 'mapGrid.js')).href);
  const bank = CFG.FOG.BANK;
  const inBack = (p) => p.z <= CFG.RANGE.BACK_Z + bank.DEPTH.BACK;
  const inSide = (p) => Math.abs(p.x) >= CFG.RANGE.WIDTH / 2 - bank.DEPTH.SIDE;
  const s8grid = s8parse(S8MAPS.village01);
  const ring = s8perim(s8grid, ['north', 'east', 'west']);
  const uncovered = ring
    .map((cl) => s8c2w(S8MAPS.village01, s8grid, cl.c, cl.r))
    .filter((p) => !inBack(p) && !inSide(p));
  assertTrue('section8',
    `all ${ring.length} perimeter spawn cells (N/E/W ring) sit inside the fog bank (uncovered: ${uncovered.length})`,
    ring.length > 0 && uncovered.length === 0);

  // Entry mixes (4.3c): the table carries them, the extension creeps the
  // window share to its cap, and entryKinds honours the arithmetic.
  for (const [i, row] of WAVES.TABLE.entries()) {
    assertTrue('section8', `table wave ${i + 1} entry mix valid`,
      !!row.entry && row.entry.perimeter >= 0 && row.entry.window >= 0
      && (row.entry.perimeter + row.entry.window) > 0);
  }
  assertTrue('section8', 'wave 1 is perimeter-only (onboarding)',
    waveSpec(1).entry.window === 0);
  const farSpec = waveSpec(99);
  assertNear('section8', 'window share caps far out', farSpec.entry.window, EXTEND.WINDOW_CAP);
  assertTrue('section8', 'SPAWN block sane (loiter MIN<MAX, player dist > 0)',
    WAVES.SPAWN.WINDOW_LOITER_MS.MIN < WAVES.SPAWN.WINDOW_LOITER_MS.MAX
    && WAVES.SPAWN.MIN_PLAYER_DIST > 0);
  const { entryKinds } = await import(pathToFileURL(join('src', 'game', 'waves.js')).href);
  const noShuffle = () => 0; // deterministic Fisher–Yates
  assertTrue('section8', 'entryKinds {1,0}: all perimeter',
    entryKinds(5, { perimeter: 1, window: 0 }, noShuffle).every((k) => k === 'perimeter'));
  assertTrue('section8', 'entryKinds {0,1}: all window',
    entryKinds(5, { perimeter: 0, window: 1 }, noShuffle).every((k) => k === 'window'));
  const mixed = entryKinds(5, { perimeter: 0.5, window: 0.5 }, noShuffle);
  assertTrue('section8', `entryKinds 5 @ 50/50 rounds to 3 windows (got ${mixed.filter((k) => k === 'window').length})`,
    mixed.length === 5 && mixed.filter((k) => k === 'window').length === 3);
  assertTrue('section8', 'entryKinds length always equals count',
    entryKinds(9, { perimeter: 0.7, window: 0.3 }, Math.random).length === 9);
} catch (err) {
  failures.push({ file: 'section8', err });
  console.log(`  FAIL   section 8 threw: ${err.message}`);
}

// ————— Section 9: player movement math —————

console.log('');
console.log('— Section 9: player movement math —');
try {
  const { computeMove, clampToArena, resolveCircleObstacles } =
    await import(pathToFileURL(join('src', 'game', 'movement.js')).href);

  // Directions at yaw 0 (facing −z; MEASURED vs r185 getWorldDirection).
  let m = computeMove(0, 1, 0, 4, 1000); // W
  assertNear('section9', 'W at yaw 0 moves −z (dz)', m.dz, -4);
  assertNear('section9', 'W at yaw 0 moves −z (dx)', m.dx, 0);
  m = computeMove(1, 0, 0, 4, 1000); // D
  assertNear('section9', 'D at yaw 0 strafes +x', m.dx, 4);
  m = computeMove(0, 1, Math.PI / 2, 4, 1000); // W looking left
  assertNear('section9', 'W at yaw +90° moves −x', m.dx, -4);
  assertNear('section9', 'W at yaw +90° has no z drift', m.dz, 0);

  // Diagonals are normalized: same speed as cardinals, split by √2.
  m = computeMove(1, 1, 0, 4, 1000);
  assertNear('section9', 'diagonal magnitude equals speed·dt',
    Math.hypot(m.dx, m.dz), 4);
  assertNear('section9', 'diagonal splits evenly (dx)', m.dx, 4 / Math.SQRT2);

  // No input, no motion.
  m = computeMove(0, 0, 1.23, 4, 1000);
  assertNear('section9', 'zero axes move nothing', Math.hypot(m.dx, m.dz), 0);

  // Arena clamp: exact at the walls.
  const B = { minX: -14.4, maxX: 14.4, minZ: -29.4, maxZ: 3.4 };
  let c = clampToArena(99, -99, B);
  assertNear('section9', 'clamp pins x to maxX', c.x, 14.4);
  assertNear('section9', 'clamp pins z to minZ', c.z, -29.4);
  c = clampToArena(1.5, 2.5, B);
  assertNear('section9', 'inside stays untouched (x)', c.x, 1.5);
  assertNear('section9', 'inside stays untouched (z)', c.z, 2.5);

  // Obstacle resolve: player pushed OUT to exactly the combined radius.
  let r = resolveCircleObstacles(0.5, 0, [{ x: 0, z: 0, radius: 0.45 }], 0.3);
  assertNear('section9', 'overlap resolves to combined radius', r.x, 0.75);
  assertNear('section9', 'pushout stays on the approach axis', r.z, 0);
  r = resolveCircleObstacles(2, 0, [{ x: 0, z: 0, radius: 0.45 }], 0.3);
  assertNear('section9', 'clear of the circle: untouched', r.x, 2);

  // Circle-vs-AABB (pass 4.2): the wall resolver. One unit box, radius 0.3.
  const { resolveCircleAABBs } = await import(pathToFileURL(join('src', 'game', 'movement.js')).href);
  const box = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }];
  assertNear('section9', 'AABB: pushed off the +x face',
    resolveCircleAABBs(1.1, 0, box, 0.3).x, 1.3);
  assertNear('section9', 'AABB: pushed off the -z face',
    resolveCircleAABBs(0, -1.2, box, 0.3).z, -1.3);
  const corner = resolveCircleAABBs(1.15, 1.15, box, 0.3);
  assertTrue('section9', 'AABB: corner exits along the diagonal (dist = radius)',
    Math.abs(Math.hypot(corner.x - 1, corner.z - 1) - 0.3) < 1e-9);
  const inside = resolveCircleAABBs(0.9, 0.1, box, 0.3);
  assertNear('section9', 'AABB: centre inside exits the shallow axis', inside.x, 1.3);
  const clearPt = resolveCircleAABBs(2.0, 2.0, box, 0.3);
  assertTrue('section9', 'AABB: clear point untouched',
    clearPt.x === 2.0 && clearPt.z === 2.0);
  // Wall sliding: a point pressed diagonally into a face keeps its lateral
  // coordinate — the resolve is normal-only, so motion along the wall lives.
  const slide = resolveCircleAABBs(0.5, 1.2, box, 0.3);
  assertTrue('section9', 'AABB: face resolve preserves lateral position (sliding)',
    slide.x === 0.5 && Math.abs(slide.z - 1.3) < 1e-9);
} catch (err) {
  failures.push({ file: 'section9', err });
  console.log(`  FAIL   section 9 threw: ${err.message}`);
}

// ————— Section 10: ammo + reload invariants —————

console.log('');
console.log('— Section 10: ammo + reload —');
try {
  const A = await import(pathToFileURL(join('src', 'game', 'ammo.js')).href);
  const { CONFIG: ACFG } = await import(pathToFileURL(join('src', 'config.js')).href);
  const M = ACFG.AMMO.MAG_SIZE;
  const R = ACFG.AMMO.RELOAD_MS;

  A.resetAmmo();
  assertNear('section10', 'fresh mag is full', A.getMag(), M);
  assertTrue('section10', 'full mag can fire', A.canFire());
  assertTrue('section10', 'reload refused on a full mag', A.startReload() === false);

  for (let i = 0; i < M; i++) A.consumeRound();
  assertNear('section10', 'mag empty after MAG_SIZE shots', A.getMag(), 0);
  assertTrue('section10', 'empty mag cannot fire', !A.canFire());
  assertTrue('section10', 'consume on empty stays at zero (guarded)',
    (A.consumeRound(), A.getMag() === 0));

  assertTrue('section10', 'reload starts from empty', A.startReload() === true);
  assertTrue('section10', 'reloading blocks fire', !A.canFire());
  assertTrue('section10', 'second reload refused mid-reload', A.startReload() === false);
  assertTrue('section10', 'one tick before done: still reloading',
    A.updateAmmo(R - 1) === false && A.isReloading());
  assertTrue('section10', 'completion tick reports true', A.updateAmmo(2) === true);
  assertNear('section10', 'mag refilled on completion', A.getMag(), M);
  assertTrue('section10', 'idle after completion', !A.isReloading() && A.canFire());

  // Partial-mag manual reload (the R-key path) works too.
  A.consumeRound();
  assertTrue('section10', 'partial mag may reload manually', A.startReload() === true);
  assertNear('section10', 'progress at half reload', (A.updateAmmo(R / 2), A.reloadProgress()), 0.5);
} catch (err) {
  failures.push({ file: 'section10', err });
  console.log(`  FAIL   section 10 threw: ${err.message}`);
}

// ————— Section 11: enemy body geometry (pass 7a) —————
// Builds a REAL body headless and measures world positions — the guard for
// the sign-slip class (LESSONS 2026-07-12): "forward" on the body is +Z,
// feet sit on the ground, the head leads the silhouette. A flipped sign or
// broken height stack fails HERE, not as a scrambled mesh in the browser.

console.log('');
console.log('— Section 11: enemy body geometry —');
try {
  const { buildBody } = await import(pathToFileURL(join('src', 'render', 'enemyBody.js')).href);
  const { ENEMY_TYPES: ET } = await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const THREE = await import(pathToFileURL(join('lib', 'three.module.js')).href);
  const zb = ET.proto_zombie;
  const { group, parts } = buildBody(zb);
  group.updateMatrixWorld(true);

  const worldOf = (obj) => {
    const v = new THREE.Vector3();
    obj.getWorldPosition(v);
    return v;
  };

  // Feet on the ground: the lowest mesh bottom sits at ~0.
  let minY = Infinity;
  group.traverse((c) => {
    if (!c.isMesh) return;
    c.geometry.computeBoundingBox();
    const bb = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
    if (bb.min.y < minY) minY = bb.min.y;
  });
  assertTrue('section11', `lowest mesh point sits on the ground (${minY.toFixed(3)})`,
    Math.abs(minY) < 0.03);

  // Hitbox coverage (7b): every mesh carries a VALID part tag — an untagged
  // mesh silently deals torso damage, exactly the class the schemas catch.
  const VALID_PARTS = new Set(['head', 'torso', 'limb']);
  const partCounts = { head: 0, torso: 0, limb: 0 };
  let untagged = 0;
  group.traverse((c) => {
    if (!c.isMesh) return;
    if (VALID_PARTS.has(c.userData.part)) partCounts[c.userData.part] += 1;
    else untagged += 1;
  });
  assertNear('section11', 'every mesh carries a valid part tag (untagged)', untagged, 0);
  assertTrue('section11',
    `all three tiers present (head ${partCounts.head}, torso ${partCounts.torso}, limb ${partCounts.limb})`,
    partCounts.head >= 2 && partCounts.torso >= 2 && partCounts.limb >= 8);

  // Damage tiers are exactly the registry's (pure lookup, fallback-guarded).
  const { partDamage } = await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  assertNear('section11', 'head damage matches registry', partDamage(zb, 'head'), zb.HITBOX.HEAD);
  assertNear('section11', 'torso damage matches registry', partDamage(zb, 'torso'), zb.HITBOX.TORSO);
  assertNear('section11', 'limb damage matches registry', partDamage(zb, 'limb'), zb.HITBOX.LIMB);
  assertNear('section11', 'untagged part falls back to torso tier',
    partDamage(zb, undefined), zb.HITBOX.TORSO);
  assertNear('section11', 'missing HITBOX table falls back to 1', partDamage({}, 'head'), 1);

  // The head LEADS: its world position is forward (+Z) of the group origin
  // and above the chest stack's midpoint.
  const headW = worldOf(parts.head);
  assertTrue('section11', `head juts forward (+Z world, got ${headW.z.toFixed(2)})`, headW.z > 0.2);
  assertTrue('section11', `head rides high (y ${headW.y.toFixed(2)})`, headW.y > 1.1);

  // Eyes: children of the head, world z ahead of the head centre (the face
  // is the +Z side — the exact class of slip that shipped in the casings).
  const eyes = parts.head.children.filter((c) => c.isMesh && c.material.fog === false);
  assertNear('section11', 'exactly two fog-free eye meshes', eyes.length, 2);
  for (const e of eyes) {
    assertTrue('section11', `eye sits on the face (+Z of head centre, ${worldOf(e).z.toFixed(2)})`,
      worldOf(e).z > headW.z);
  }

  // Jaw hangs BELOW the head centre.
  assertTrue('section11', 'jaw hangs below the head centre', worldOf(parts.jaw).y < headW.y);

  // Legs are two-segment chains: thigh → shin → foot. A foot left parented
  // higher up would stay planted while the shin swings through it.
  for (const side of ['L', 'R']) {
    const thigh = parts[`leg${side}`];
    const shin = parts[`shin${side}`];
    assertTrue('section11', `leg${side} exists in the parts map`, !!thigh);
    assertTrue('section11', `shin${side} is a child of leg${side}`,
      !!shin && shin.parent === thigh);
    const foot = shin && shin.children.find((c) => c.isMesh);
    assertTrue('section11', `shin${side} carries the foot`, !!foot);
  }

  // Arms are two-segment chains: upper → forearm → hand. Rest pose points
  // the HAND (chain end) forward of the shoulder and at/below it (dangling
  // reach) — measured on the true chain end, not a proxy segment.
  for (const side of ['L', 'R']) {
    const arm = parts[`arm${side}`];
    const fore = parts[`fore${side}`];
    assertTrue('section11', `fore${side} is a child of arm${side}`,
      !!fore && fore.parent === arm);
    const hand = fore && fore.children.find((c) => c.isMesh);
    assertTrue('section11', `fore${side} carries the hand`, !!hand);
    if (hand) {
      assertTrue('section11', `arm${side} hand reaches forward of the shoulder`,
        worldOf(hand).z > worldOf(arm).z);
      assertTrue('section11', `arm${side} hand hangs at/below the shoulder (dangle)`,
        worldOf(hand).y <= worldOf(arm).y + 0.01);
    }
  }
} catch (err) {
  failures.push({ file: 'section11', err });
  console.log(`  FAIL   section 11 threw: ${err.message}`);
}

// ————— Section 12: spring behaviors (pass 7c) —————
// secondOrder.js is PORTED from halted research (see its provenance header)
// — nothing trusted on provenance. These are OUR probes of the claims the
// flinch relies on. All simulated at 60 fps in Node.

console.log('');
console.log('— Section 12: spring behaviors —');
try {
  const { createSecondOrder } = await import(pathToFileURL(join('src', 'game', 'secondOrder.js')).href);
  const DT = 1 / 60;
  const sim = (s, target, frames) => {
    let peak = -Infinity, trough = Infinity, last = 0;
    for (let i = 0; i < frames; i++) {
      last = s.update(target, DT);
      if (last > peak) peak = last;
      if (last < trough) trough = last;
    }
    return { peak, trough, last };
  };

  // Critically damped step: approaches 1, never overshoots.
  const crit = sim(createSecondOrder(5, 1, 1, 0), 1, 180);
  assertTrue('section12', `critical damping never overshoots (peak ${crit.peak.toFixed(4)})`,
    crit.peak <= 1.0001);
  assertTrue('section12', `critical damping settles (last ${crit.last.toFixed(4)})`,
    Math.abs(crit.last - 1) < 0.01);

  // Underdamped step: overshoots, then settles — the flinch look.
  const under = sim(createSecondOrder(5, 0.4, 1, 0), 1, 240);
  assertTrue('section12', `underdamped overshoots (peak ${under.peak.toFixed(3)})`,
    under.peak > 1.05);
  assertTrue('section12', 'underdamped still settles',
    Math.abs(under.last - 1) < 0.01);

  // Kick: lurches up, rebounds below zero (the stretch), settles back to 0.
  const k = createSecondOrder(5, 0.4, 1, 0);
  k.kick(11.5);
  const kick = sim(k, 0, 240);
  assertTrue('section12', `kick peaks near the measured 0.25 (${kick.peak.toFixed(3)})`,
    kick.peak > 0.2 && kick.peak < 0.3);
  assertTrue('section12', `kick rebounds into stretch (trough ${kick.trough.toFixed(3)})`,
    kick.trough < -0.02);
  assertTrue('section12', 'kick settles back to zero', Math.abs(kick.last) < 0.01);

  // Pause safety: dt 0 holds exactly; no drift over many held frames.
  const pz = createSecondOrder(5, 0.4, 1, 0);
  pz.kick(5);
  pz.update(0, DT);
  const held = pz.value;
  for (let i = 0; i < 100; i++) pz.update(0, 0);
  assertNear('section12', 'dt=0 holds the value exactly', pz.value, held);

  // Undersampling: a stiff spring at a huge dt stays finite (the clamp).
  const stiff = createSecondOrder(20, 0.3, 1, 0);
  let finite = true;
  for (let i = 0; i < 60; i++) {
    if (!Number.isFinite(stiff.update(1, 0.25))) finite = false;
  }
  assertTrue('section12', 'stability clamp survives 4 Hz undersampling of a 20 Hz spring', finite);
} catch (err) {
  failures.push({ file: 'section12', err });
  console.log(`  FAIL   section 12 threw: ${err.message}`);
}

// ————— Section 13: map integrity (Stage 4) —————
// The map is the single source the house derives from — a malformed layout
// must fail HERE by name, never as geometry soup or a sealed room in play.

console.log('');
console.log('— Section 13: map integrity —');
try {
  const { MAPS } = await import(pathToFileURL(join('src', 'data', 'maps.js')).href);
  const { parseLayout, floodReachable, countWalkable, cellToWorld } =
    await import(pathToFileURL(join('src', 'game', 'mapGrid.js')).href);

  for (const [id, map] of Object.entries(MAPS)) {
    // Constants sane.
    for (const k of ['CELL', 'FLOOR_H', 'WINDOW_SILL_H', 'HEADER_H']) {
      assertTrue('section13', `${id}.${k} is a positive finite number`,
        Number.isFinite(map[k]) && map[k] > 0);
    }
    assertTrue('section13', `${id}.ANCHOR is finite`,
      Number.isFinite(map.ANCHOR.x) && Number.isFinite(map.ANCHOR.z));

    const grid = parseLayout(map); // throws on ragged rows / duplicate P
    assertTrue('section13', `${id}: layout parsed (${grid.cols}×${grid.rows})`, true);
    assertTrue('section13', `${id}: exactly one player start`, !!grid.playerStart);

    // Every window is embedded in a straight wall run — a free-floating W
    // renders as furniture, not a window.
    const looseWindows = grid.windows.filter(({ c, r }) =>
      !((grid.at(c - 1, r) === '#' && grid.at(c + 1, r) === '#')
        || (grid.at(c, r - 1) === '#' && grid.at(c, r + 1) === '#')));
    assertNear('section13', `${id}: every window embedded in a wall run`,
      looseWindows.length, 0);
    assertTrue('section13', `${id}: has spawn windows (${grid.windows.length})`,
      grid.windows.length >= 1);

    // Fountain cells (if any) are blocked ground.
    const walkableFountains = grid.fountains.filter(({ c, r }) => grid.walkable(c, r));
    assertNear('section13', `${id}: fountain cells are blocked`,
      walkableFountains.length, 0);

    // Every walkable cell reachable from P — sealed rooms cannot ship.
    const reached = floodReachable(grid).size;
    const total = countWalkable(grid);
    assertNear('section13', `${id}: flood from P covers every walkable cell`,
      reached, total);

    // The whole map (cell edges, not centres) fits inside the arena's
    // walkable clamp — retuning ANCHOR, CELL, or RANGE inconsistently
    // fails HERE, not as an unreachable map edge in play.
    const { CONFIG: MCFG } = await import(pathToFileURL(join('src', 'config.js')).href);
    const boundX = MCFG.RANGE.WIDTH / 2 - MCFG.PLAYER.WALL_MARGIN;
    const minZb = MCFG.RANGE.BACK_Z + MCFG.PLAYER.WALL_MARGIN;
    const maxZb = MCFG.RANGE.FRONT_Z - MCFG.PLAYER.WALL_MARGIN;
    const tl = cellToWorld(map, grid, 0, 0);
    const br = cellToWorld(map, grid, grid.cols - 1, grid.rows - 1);
    const inClamp =
      tl.x - map.CELL / 2 >= -boundX && br.x + map.CELL / 2 <= boundX
      && tl.z - map.CELL / 2 >= minZb && br.z + map.CELL / 2 <= maxZb;
    assertTrue('section13', `${id}: map extent fits the arena clamp`, inClamp);

    // The start lands inside the map (and therefore inside the clamp).
    const start = cellToWorld(map, grid, grid.playerStart.c, grid.playerStart.r);
    assertTrue('section13', `${id}: player start inside the map extent`,
      start.x > tl.x - map.CELL && start.x < br.x + map.CELL
      && start.z > tl.z - map.CELL && start.z < br.z + map.CELL);

    // Colliders (4.2): derived from the same cells as the geometry — assert
    // total agreement: every BLOCKED cell centre sits inside a collider, and
    // NO walkable cell centre does (a wall you can walk through, or a floor
    // that blocks, both fail here by name).
    const { buildColliders } = await import(pathToFileURL(join('src', 'game', 'mapGrid.js')).href);
    const boxes = buildColliders(map, grid);
    const insideAny = (x, z) => boxes.some((b) =>
      x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
    let blockedUncovered = 0;
    let walkableCovered = 0;
    for (let rr = 0; rr < grid.rows; rr++) {
      for (let cc = 0; cc < grid.cols; cc++) {
        const w = cellToWorld(map, grid, cc, rr);
        const ch = grid.at(cc, rr);
        if ('#WF'.includes(ch) && !insideAny(w.x, w.z)) blockedUncovered += 1;
        if (grid.walkable(cc, rr) && insideAny(w.x, w.z)) walkableCovered += 1;
      }
    }
    assertNear('section13', `${id}: every blocked cell is solid`, blockedUncovered, 0);
    assertNear('section13', `${id}: no walkable cell centre is solid`, walkableCovered, 0);

    // Fence solidity (4.2b): a body standing ON the boundary line gets
    // pushed back inside — the visible edge is the real edge.
    const { resolveCircleAABBs: solve } =
      await import(pathToFileURL(join('src', 'game', 'movement.js')).href);
    const northLine = tl.z - map.CELL / 2;
    const onFence = solve(map.ANCHOR.x, northLine, boxes, 0.3);
    assertTrue('section13', `${id}: the fence line is solid (pushed to z ${onFence.z.toFixed(2)})`,
      onFence.z > northLine);
  }
} catch (err) {
  failures.push({ file: 'section13', err });
  console.log(`  FAIL   section 13 threw: ${err.message}`);
}

// ————— Section 14: navigation (pass 4.3 — the flow field) —————
// The field must be PROVEN here because in play it only shows as feel:
// coverage (every walkable cell has a distance), strict descent (every
// direction moves closer — no flats, no cycles), the corner guard (no
// diagonal shaves a wall corner), and full greedy routing (from EVERY
// cell, following the field reaches the player — doorway routing included).
// worldToCell round-trips cellToWorld so zombies read the cell they stand in.

console.log('');
console.log('— Section 14: navigation (flow field) —');
try {
  const { MAPS: NAV_MAPS } = await import(pathToFileURL(join('src', 'data', 'maps.js')).href);
  const { parseLayout: navParse, countWalkable: navCount, cellToWorld: navC2W, worldToCell: navW2C } =
    await import(pathToFileURL(join('src', 'game', 'mapGrid.js')).href);
  const { buildFlowField } = await import(pathToFileURL(join('src', 'game', 'flowField.js')).href);

  for (const [id, map] of Object.entries(NAV_MAPS)) {
    const grid = navParse(map);
    const start = grid.playerStart;
    const field = buildFlowField(grid, start);
    const walkableTotal = navCount(grid);

    // Coverage: every walkable cell is on the field (matches the flood's
    // guarantee — a covered map cannot strand a zombie).
    let covered = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.walkable(c, r) && Number.isFinite(field.distAt(c, r))) covered += 1;
      }
    }
    assertTrue('section14', `${id}: field covers every walkable cell (${covered}/${walkableTotal})`,
      covered === walkableTotal);

    // The target cell: distance 0, no step (a zombie ON the player's cell
    // is inside beeline range by definition).
    assertTrue('section14', `${id}: target cell distance is 0`, field.distAt(start.c, start.r) === 0);
    assertTrue('section14', `${id}: target cell has no step`, field.stepAt(start.c, start.r) === null);

    // Strict descent + landing legality + the corner guard, every cell.
    let descentFails = 0;
    let landingFails = 0;
    let cornerFails = 0;
    let dirNormFails = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (!grid.walkable(c, r) || (c === start.c && r === start.r)) continue;
        const s = field.stepAt(c, r);
        if (!s) { descentFails += 1; continue; } // a reached cell must step
        const nc = c + s.dc;
        const nr = r + s.dr;
        if (!grid.walkable(nc, nr)) landingFails += 1;
        if (!(field.distAt(nc, nr) < field.distAt(c, r))) descentFails += 1;
        if (s.dc !== 0 && s.dr !== 0
          && !(grid.walkable(c + s.dc, r) && grid.walkable(c, r + s.dr))) {
          cornerFails += 1;
        }
        const d = field.dirAt(c, r);
        if (Math.abs(Math.hypot(d.x, d.z) - 1) > 1e-6) dirNormFails += 1;
      }
    }
    assertTrue('section14', `${id}: every step strictly descends: ${descentFails} violations (expected 0)`,
      descentFails === 0);
    assertTrue('section14', `${id}: every step lands on a walkable cell: ${landingFails} violations (expected 0)`,
      landingFails === 0);
    assertTrue('section14', `${id}: no diagonal shaves a corner: ${cornerFails} violations (expected 0)`,
      cornerFails === 0);
    assertTrue('section14', `${id}: every direction is unit length: ${dirNormFails} violations (expected 0)`,
      dirNormFails === 0);

    // Greedy routing: from EVERY walkable cell, walking the field reaches
    // the target within cols×rows steps — termination AND doorway routing
    // in one probe (an interior room only reaches the plaza through its D).
    let routeFails = 0;
    const maxSteps = grid.cols * grid.rows;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (!grid.walkable(c, r)) continue;
        let cc = c;
        let cr = r;
        let steps = 0;
        while ((cc !== start.c || cr !== start.r) && steps < maxSteps) {
          const s = field.stepAt(cc, cr);
          if (!s) break;
          cc += s.dc;
          cr += s.dr;
          steps += 1;
        }
        if (cc !== start.c || cr !== start.r) routeFails += 1;
      }
    }
    assertTrue('section14', `${id}: greedy walk reaches the player from every cell: ${routeFails} strandings (expected 0)`,
      routeFails === 0);

    // worldToCell round-trips cellToWorld for every cell — the zombie reads
    // the cell it actually stands in.
    let rtFails = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const w = navC2W(map, grid, c, r);
        const back = navW2C(map, grid, w.x, w.z);
        if (back.c !== c || back.r !== r) rtFails += 1;
      }
    }
    assertTrue('section14', `${id}: worldToCell round-trips every cell centre: ${rtFails} misses (expected 0)`,
      rtFails === 0);

    // Off-field queries answer null/Infinity, never throw — the beeline
    // fallback's contract.
    assertTrue('section14', `${id}: blocked cell has no direction`,
      field.dirAt(0, -1) === null && field.distAt(0, -1) === Infinity);

    // GUARD: an invalid target (a wall cell) yields an all-null field —
    // a bad seed degrades to the beeline, it does not throw in the loop.
    let wallCell = null;
    for (let r = 0; r < grid.rows && !wallCell; r++) {
      for (let c = 0; c < grid.cols && !wallCell; c++) {
        if (grid.at(c, r) === '#') wallCell = { c, r };
      }
    }
    const badField = buildFlowField(grid, wallCell);
    assertTrue('section14', `${id}: a blocked target yields a null field (graceful)`,
      badField.target === null && badField.stepAt(start.c, start.r) === null);
  }

  // The corner guard on a hand-built fixture where the diagonal WOULD cut:
  // target around an L-corner — the corner-adjacent cell must step
  // orthogonally even though the diagonal is strictly closer.
  const fixture = {
    ANCHOR: { x: 0, z: 0 },
    CELL: 1,
    layout: [
      'P#.',
      '...',
      '...',
    ],
  };
  const fGrid = navParse(fixture);
  const fField = buildFlowField(fGrid, fGrid.playerStart);
  const cutStep = fField.stepAt(2, 0); // the SW diagonal (dist 2) would shave the '#'
  assertTrue('section14', 'fixture: corner cell steps orthogonally (0,+1), not through the wall corner',
    !!cutStep && cutStep.dc === 0 && cutStep.dr === 1);

  // turnToward (the feel fix): the body TURNS through quantized field
  // headings instead of snapping. Wrap, clamp, exact arrival, symmetry.
  const { turnToward } = await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  assertTrue('section14', 'turnToward: clamps a big turn to maxStep',
    Math.abs(turnToward(0, Math.PI / 2, 0.1) - 0.1) < 1e-12);
  assertTrue('section14', 'turnToward: negative turns clamp symmetrically',
    Math.abs(turnToward(0, -Math.PI / 2, 0.1) - (-0.1)) < 1e-12);
  assertTrue('section14', 'turnToward: arrives exactly when the gap is inside maxStep',
    Math.abs(turnToward(1.0, 1.05, 0.1) - 1.05) < 1e-12);
  // The ±π seam: from +3.0 to −3.0 rad the SHORT way is +0.283 rad
  // (through π), never −6.0 the long way round.
  const seam = turnToward(3.0, -3.0, 10.0);
  assertTrue('section14', `turnToward: crosses the ±π seam the short way (landed ${seam.toFixed(3)})`,
    Math.abs(seam - (3.0 + (2 * Math.PI - 6.0))) < 1e-9);
  assertTrue('section14', 'turnToward: zero gap is a no-op',
    turnToward(0.7, 0.7, 0.5) === 0.7);

  // The climb timeline (4.3b.2): the pose must start and end EXACTLY on
  // the walk rest (a pop at handoff reads as a glitch), stay continuous
  // across phase boundaries, top out at sill height, and haul the TRAIL
  // leg over LATE (the limp reading through the climb).
  const { climbPose } = await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  const rest = { REST: 1.85, ELBOW: 0.45, KNEE: 0.15, LEAN: 0.12, sillH: 1.0 };
  const CH = ['h', 'y', 'pitch', 'shoulder', 'elbow', 'hipL', 'kneeL', 'hipR', 'kneeR'];
  const p0 = climbPose(0, rest);
  assertTrue('section14', 'climb: k=0 is the walk rest pose',
    p0.y === 0 && p0.shoulder === rest.REST && p0.elbow === rest.ELBOW
    && p0.hipL === 0 && p0.hipR === 0 && p0.kneeL === rest.KNEE
    && p0.kneeR === rest.KNEE && p0.pitch === rest.LEAN && p0.h === 0);
  const p1 = climbPose(1, rest);
  assertTrue('section14', 'climb: k=1 hands back the walk rest pose',
    Math.abs(p1.y) < 1e-9 && Math.abs(p1.shoulder - rest.REST) < 1e-9
    && Math.abs(p1.elbow - rest.ELBOW) < 1e-9 && Math.abs(p1.hipL) < 1e-9
    && Math.abs(p1.hipR) < 1e-9 && Math.abs(p1.kneeL - rest.KNEE) < 1e-9
    && Math.abs(p1.kneeR - rest.KNEE) < 1e-9 && Math.abs(p1.pitch - rest.LEAN) < 1e-9
    && Math.abs(p1.h - 1) < 1e-9);
  let popCount = 0;
  for (const kb of [0.25, 0.65]) {
    const a = climbPose(kb - 1e-6, rest);
    const b = climbPose(kb + 1e-6, rest);
    for (const ch of CH) if (Math.abs(a[ch] - b[ch]) > 1e-3) popCount += 1;
  }
  assertTrue('section14', `climb: continuous across both phase boundaries (${popCount} pops, expected 0)`,
    popCount === 0);
  let peakYc = 0;
  let hMono = true;
  let prevH = -1;
  for (let k = 0; k <= 1.0001; k += 0.01) {
    const p = climbPose(Math.min(1, k), rest);
    peakYc = Math.max(peakYc, p.y);
    if (p.h < prevH - 1e-9) hMono = false;
    prevH = p.h;
  }
  assertTrue('section14', `climb: tops out at sill height (peak ${peakYc.toFixed(2)} vs 1.0)`,
    Math.abs(peakYc - rest.sillH) < 0.02);
  assertTrue('section14', 'climb: horizontal progress never reverses', hMono);
  const early = climbPose(0.68, rest);
  const late = climbPose(0.88, rest);
  assertTrue('section14', 'climb: the trail leg hauls over LATE in the drop',
    early.hipR > 0.1 && late.hipR < -0.3);

  // Spawn geometry (4.3c): the exterior flood knows streets from rooms
  // without hints; the ring and window spots derive from it. Pinned to
  // the measured village truths; house01's zeros are ITS truth (its
  // boundary is the house wall) — the picker's fallback chain covers it.
  const { exteriorCells, perimeterSpawnCells, windowEntrySpots } =
    await import(pathToFileURL(join('src', 'game', 'mapGrid.js')).href);
  const sgGrid = navParse(NAV_MAPS.village01);
  const vExt = exteriorCells(sgGrid);
  assertTrue('section14', `village: exterior region is the streets (${vExt.size} cells, expected 318)`,
    vExt.size === 318);
  assertTrue('section14', 'village: a room interior is NOT exterior; a street IS',
    !vExt.has('3,6') && vExt.has('1,1'));
  const vRing = perimeterSpawnCells(sgGrid, ['north', 'east', 'west']);
  assertTrue('section14', `village: N/E/W spawn ring has 65 cells, all walkable (got ${vRing.length})`,
    vRing.length === 65 && vRing.every(({ c, r }) => sgGrid.walkable(c, r)));
  const vSpots = windowEntrySpots(sgGrid);
  assertTrue('section14', `village: every window is an entry spot (${vSpots.length}/6)`,
    vSpots.length === 6);
  assertTrue('section14', 'village: every spot: outside on the street, inside in a room',
    vSpots.every((s) => vExt.has(`${s.outC},${s.outR}`) && !vExt.has(`${s.inC},${s.inR}`)
      && sgGrid.walkable(s.outC, s.outR) && sgGrid.walkable(s.inC, s.inR)));
  const hGrid = navParse(NAV_MAPS.house01);
  assertTrue('section14', 'house01: no exterior, no ring, no entry spots (its boundary IS the wall)',
    exteriorCells(hGrid).size === 0 && perimeterSpawnCells(hGrid).length === 0
    && windowEntrySpots(hGrid).length === 0);

  // The reach resolve (the wall-clip fix): the front of the body — arms
  // and head, ~1.0 m past the feet circle — must stay out of walls the
  // body FACES, while sideways sliding and doorway transit are untouched.
  const { resolveCircleAABBs: plainSolve, resolveBodyWithReach } =
    await import(pathToFileURL(join('src', 'game', 'movement.js')).href);
  const wallBox = [{ minX: -5, maxX: 5, minZ: 2, maxZ: 4 }]; // a wall to the north (+z)

  // Head-on: facing the wall (yaw 0 → forward +z), starting overlapped —
  // the body must stand off REACH + RADIUS from the face, not BODY_RADIUS.
  const headOn = resolveBodyWithReach(0, 1.8, 0, wallBox, 0.45, 0.75, 0.25);
  assertTrue('section14', `reach: facing a wall stands off arms-length (z ${headOn.z.toFixed(2)}, face at 2)`,
    Math.abs((2 - headOn.z) - (0.75 + 0.25)) < 1e-9);

  // Parallel: facing along the wall (yaw π/2 → forward +x), pressed to it —
  // the reach circle runs parallel and must not disturb the feet standoff.
  const parallel = resolveBodyWithReach(0, 1.6, Math.PI / 2, wallBox, 0.45, 0.75, 0.25);
  const parallelPlain = plainSolve(0, 1.6, wallBox, 0.45);
  assertTrue('section14', 'reach: sliding parallel to a wall matches the plain circle exactly',
    Math.abs(parallel.x - parallelPlain.x) < 1e-9 && Math.abs(parallel.z - parallelPlain.z) < 1e-9);

  // Doorway: a 1.6 m gap between two wall runs; a body centred in the gap,
  // facing through it, must pass undisturbed.
  const doorBoxes = [
    { minX: -5, maxX: -0.8, minZ: 2, maxZ: 3.6 },
    { minX: 0.8, maxX: 5, minZ: 2, maxZ: 3.6 },
  ];
  const doorway = resolveBodyWithReach(0, 2.8, 0, doorBoxes, 0.45, 0.75, 0.25);
  assertTrue('section14', 'reach: a centred body passes a 1.6 m doorway undisturbed',
    Math.abs(doorway.x) < 1e-9 && Math.abs(doorway.z - 2.8) < 1e-9);

  // reach = 0 is byte-identical to the plain circle — the guard for types
  // without a WALL block.
  const noReach = resolveBodyWithReach(0.3, 1.7, 0, wallBox, 0.45, 0, 0);
  const noReachPlain = plainSolve(0.3, 1.7, wallBox, 0.45);
  assertTrue('section14', 'reach: reach 0 is a no-op (identical to the plain resolve)',
    noReach.x === noReachPlain.x && noReach.z === noReachPlain.z);

  // Registry sanity: any type carrying a WALL block must fit a doorway —
  // the reach circle radius has to clear the 1.6 m gap's half-width.
  const { ENEMY_TYPES: WALL_ET } = await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  for (const [tid, t] of Object.entries(WALL_ET)) {
    if (!t.WALL) continue;
    assertTrue('section14', `${tid}: WALL block finite and doorway-passable`,
      Number.isFinite(t.WALL.REACH) && Number.isFinite(t.WALL.RADIUS)
      && t.WALL.REACH > 0 && t.WALL.RADIUS > 0 && t.WALL.RADIUS < 0.8 && t.BODY_RADIUS < 0.8);
  }

  // Line of sight (the through-wall fix): the segment test that gates the
  // beeline switch, the stop ring, and both attack moments.
  const { segmentClearOfAABBs } =
    await import(pathToFileURL(join('src', 'game', 'movement.js')).href);
  const losBox = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }];
  assertTrue('section14', 'LOS: an open segment is clear',
    segmentClearOfAABBs(2, 2, 5, 5, losBox) === true);
  assertTrue('section14', 'LOS: a segment through the box is blocked',
    segmentClearOfAABBs(-3, 0, 3, 0, losBox) === false);
  assertTrue('section14', 'LOS: a diagonal through the box corner region is blocked',
    segmentClearOfAABBs(-2, 0, 0, 2, losBox) === false);
  assertTrue('section14', 'LOS: a graze passing just outside is clear',
    segmentClearOfAABBs(-3, 1.05, 3, 1.05, losBox) === true);
  assertTrue('section14', 'LOS: a degenerate-axis (vertical) segment inside the slab is blocked',
    segmentClearOfAABBs(0, -3, 0, 3, losBox) === false);
  assertTrue('section14', 'LOS: a degenerate-axis segment outside the slab is clear',
    segmentClearOfAABBs(2, -3, 2, 3, losBox) === true);
  assertTrue('section14', 'LOS: an endpoint inside the box is blocked',
    segmentClearOfAABBs(0, 0, 5, 0, losBox) === false);

  // Village integration: across a wall = blocked; through a doorway = clear.
  const losMap = NAV_MAPS.village01;
  const losGrid = navParse(losMap);
  const { buildColliders: losBuild } = await import(pathToFileURL(join('src', 'game', 'mapGrid.js')).href);
  const losBoxes = losBuild(losMap, losGrid);
  const roomSide = navC2W(losMap, losGrid, 3, 6);   // inside the TL west room
  const outsideWall = navC2W(losMap, losGrid, 3, 8); // outside, across row-7 wall
  assertTrue('section14', 'village: LOS across an interior wall is blocked',
    segmentClearOfAABBs(roomSide.x, roomSide.z, outsideWall.x, outsideWall.z, losBoxes) === false);
  const doorIn = navC2W(losMap, losGrid, 4, 6);     // inside, in line with the D at (4,7)
  const doorOut = navC2W(losMap, losGrid, 4, 8);    // outside, same column
  assertTrue('section14', 'village: LOS straight through a doorway is clear',
    segmentClearOfAABBs(doorIn.x, doorIn.z, doorOut.x, doorOut.z, losBoxes) === true);

  // — 4.3b: window edges + the vault —
  const { CONFIG: NAVCFG } = await import(pathToFileURL(join('src', 'config.js')).href);
  const wField = buildFlowField(losGrid, losGrid.playerStart,
    { windowCost: NAVCFG.NAV.WINDOW_COST });

  // Every village window is CONNECTED (both perpendicular neighbors
  // walkable) and on the priced field.
  let badWindows = 0;
  let unpricedWindows = 0;
  for (const { c, r } of losGrid.windows) {
    const vertical = losGrid.walkable(c, r - 1) && losGrid.walkable(c, r + 1);
    const horizontal = losGrid.walkable(c - 1, r) && losGrid.walkable(c + 1, r);
    if (!vertical && !horizontal) badWindows += 1;
    if (!Number.isFinite(wField.distAt(c, r))) unpricedWindows += 1;
  }
  assertTrue('section14', `village: every window connects two walkable cells: ${badWindows} orphans (expected 0)`,
    badWindows === 0);
  assertTrue('section14', `village: every window is on the priced field: ${unpricedWindows} missing (expected 0)`,
    unpricedWindows === 0);

  // Descent stays strict over the priced field, steps land only on
  // traversable cells, and every step touching a window is ORTHOGONAL
  // (a diagonal through a sill would grind the corner guard's geometry).
  let wDescentFails = 0;
  let wLandFails = 0;
  let wDiagFails = 0;
  for (let r = 0; r < losGrid.rows; r++) {
    for (let c = 0; c < losGrid.cols; c++) {
      const traversable = losGrid.walkable(c, r) || losGrid.at(c, r) === 'W';
      if (!traversable || !Number.isFinite(wField.distAt(c, r))) continue;
      if (c === losGrid.playerStart.c && r === losGrid.playerStart.r) continue;
      const s = wField.stepAt(c, r);
      if (!s) { wDescentFails += 1; continue; }
      const nc = c + s.dc;
      const nr = r + s.dr;
      const landTrav = losGrid.walkable(nc, nr) || losGrid.at(nc, nr) === 'W';
      if (!landTrav) wLandFails += 1;
      if (!(wField.distAt(nc, nr) < wField.distAt(c, r))) wDescentFails += 1;
      const touchesWindow = losGrid.at(c, r) === 'W' || losGrid.at(nc, nr) === 'W';
      if (touchesWindow && s.dc !== 0 && s.dr !== 0) wDiagFails += 1;
    }
  }
  assertTrue('section14', `village priced field: strict descent holds: ${wDescentFails} violations (expected 0)`,
    wDescentFails === 0);
  assertTrue('section14', `village priced field: steps land traversable: ${wLandFails} violations (expected 0)`,
    wLandFails === 0);
  assertTrue('section14', `village priced field: window steps are orthogonal: ${wDiagFails} diagonals (expected 0)`,
    wDiagFails === 0);

  // The exact price of a crossing, on a room reachable ONLY by window:
  // P above the sill, the room below it. dist(W) = cost, dist(inside) =
  // cost + 1; and with windows unpriced the room is UNREACHED.
  const winFixture = {
    ANCHOR: { x: 0, z: 0 },
    CELL: 1,
    layout: [
      '.P.',
      '#W#',
      '...',
    ],
  };
  const wfGrid = navParse(winFixture);
  const priced = buildFlowField(wfGrid, wfGrid.playerStart, { windowCost: 6 });
  assertTrue('section14', 'fixture: window cell costs exactly WINDOW_COST (6)',
    priced.distAt(1, 1) === 6);
  assertTrue('section14', 'fixture: the room beyond costs WINDOW_COST + 1 (7)',
    priced.distAt(1, 2) === 7);
  assertTrue('section14', 'fixture: the room routes UP through the window',
    (() => { const s = priced.stepAt(1, 2); return !!s && s.dc === 0 && s.dr === -1; })());
  const unpriced = buildFlowField(wfGrid, wfGrid.playerStart);
  assertTrue('section14', 'fixture: with windows unpriced the room is unreached',
    unpriced.distAt(1, 2) === Infinity && unpriced.stepAt(1, 2) === null);

  // Blocked windows (4.3b.1): a congested window prices out exactly like
  // an unpriced one — the fixture room drops off the field again.
  const blockedFix = buildFlowField(wfGrid, wfGrid.playerStart,
    { windowCost: 6, blockedWindows: new Set(['1,1']) });
  assertTrue('section14', 'fixture: a blocked window unreaches the room (latch parity)',
    blockedFix.distAt(1, 1) === Infinity && blockedFix.distAt(1, 2) === Infinity);

  // Village: blocking one window costs nothing in coverage — every
  // walkable cell still routes via doors and the other windows.
  const oneBlocked = buildFlowField(losGrid, losGrid.playerStart, {
    windowCost: NAVCFG.NAV.WINDOW_COST,
    blockedWindows: new Set(['3,2']),
  });
  let blockedCoverage = 0;
  for (let r = 0; r < losGrid.rows; r++) {
    for (let c = 0; c < losGrid.cols; c++) {
      if (losGrid.walkable(c, r) && Number.isFinite(oneBlocked.distAt(c, r))) blockedCoverage += 1;
    }
  }
  assertTrue('section14', `village: full walkable coverage with a window blocked (${blockedCoverage}/${navCount(losGrid)})`,
    blockedCoverage === navCount(losGrid));
  assertTrue('section14', 'village: the blocked window itself is off the field',
    oneBlocked.distAt(3, 2) === Infinity);

  // Route preference flips with the price: window vs door, same map.
  // Door route from (1,3) is 6 steps; the window crossing is cost+1.
  const routeFixture = {
    ANCHOR: { x: 0, z: 0 },
    CELL: 1,
    layout: [
      '.....',
      '.P...',
      '#W#D#',
      '.....',
    ],
  };
  const rGrid = navParse(routeFixture);
  const cheapWin = buildFlowField(rGrid, rGrid.playerStart, { windowCost: 2 });
  const dearWin = buildFlowField(rGrid, rGrid.playerStart, { windowCost: 6 });
  assertTrue('section14', 'fixture: a cheap window (2) pulls the route through it',
    (() => { const s = cheapWin.stepAt(1, 3); return !!s && s.dc === 0 && s.dr === -1; })());
  assertTrue('section14', 'fixture: a dear window (6) sends the route to the door',
    (() => { const s = dearWin.stepAt(1, 3); return !!s && s.dc === 1; })());

  // The trigger must sit PAST the reach-probe standoff for every type that
  // both climbs and reaches — a trigger inside the standoff freezes
  // zombies at every sill (the 4.3a freeze class, negative-tested by name).
  const { MAPS: VMAPS } = await import(pathToFileURL(join('src', 'data', 'maps.js')).href);
  for (const [tid, t] of Object.entries(WALL_ET)) {
    if (!t.VAULT) continue;
    assertTrue('section14', `${tid}: VAULT.MS finite and positive`,
      Number.isFinite(t.VAULT.MS) && t.VAULT.MS > 0);
    if (t.WALL) {
      const standoff = VMAPS.village01.CELL / 2 + t.WALL.REACH + t.WALL.RADIUS;
      assertTrue('section14',
        `${tid}: VAULT_TRIGGER (${NAVCFG.NAV.VAULT_TRIGGER}) clears the reach standoff (${standoff.toFixed(2)})`,
        NAVCFG.NAV.VAULT_TRIGGER > standoff);
    }
  }
} catch (err) {
  failures.push({ file: 'section14', err });
  console.log(`  FAIL   section 14 threw: ${err.message}`);
}

// ————— Report —————

console.log('');
if (failures.length) {
  console.log(`SUITE FAIL — ${failures.length} failure(s), ${files.length} module(s) checked`);
  process.exitCode = 1;
} else {
  console.log(`SUITE PASS — ${files.length} modules imported cleanly; spawn, scoring, round, best, config, and enemy invariants proven`);
}
