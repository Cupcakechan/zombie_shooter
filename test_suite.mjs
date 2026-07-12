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
const MIN_EXPECTED_MODULES = 27;

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

  // Fog-bank coverage (pass 8.1): every spawn point must sit INSIDE a bank
  // volume, or that zombie pops into view instead of walking out of the murk.
  // Back bank covers z <= BACK_Z + DEPTH.BACK; side banks cover
  // |x| >= WIDTH/2 - DEPTH.SIDE. Retuning spawn points or bank depths without
  // keeping them consistent fails HERE, not in the game.
  const { CONFIG: CFG } = await import(pathToFileURL(join('src', 'config.js')).href);
  const bank = CFG.FOG.BANK;
  const inBack = (p) => p.z <= CFG.RANGE.BACK_Z + bank.DEPTH.BACK;
  const inSide = (p) => Math.abs(p.x) >= CFG.RANGE.WIDTH / 2 - bank.DEPTH.SIDE;
  const uncovered = WAVES.SPAWN_POINTS.filter((p) => !inBack(p) && !inSide(p));
  assertTrue('section8',
    `all ${WAVES.SPAWN_POINTS.length} spawn points sit inside the fog bank (uncovered: ${uncovered.length})`,
    uncovered.length === 0);
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

    const grid = parseLayout(map); // throws on ragged rows / duplicate P
    assertTrue('section13', `${id}: layout parsed (${grid.cols}×${grid.rows})`, true);
    assertTrue('section13', `${id}: exactly one player start`, !!grid.playerStart);

    // Perimeter fully enclosed by walls or windows.
    let leaks = 0;
    for (let c = 0; c < grid.cols; c++) {
      if (!'#W'.includes(grid.at(c, 0))) leaks += 1;
      if (!'#W'.includes(grid.at(c, grid.rows - 1))) leaks += 1;
    }
    for (let r = 0; r < grid.rows; r++) {
      if (!'#W'.includes(grid.at(0, r))) leaks += 1;
      if (!'#W'.includes(grid.at(grid.cols - 1, r))) leaks += 1;
    }
    assertNear('section13', `${id}: perimeter fully enclosed (leaks)`, leaks, 0);

    // Windows sit on the perimeter only (v1 rule).
    const interiorWindows = grid.windows.filter(({ c, r }) =>
      c !== 0 && r !== 0 && c !== grid.cols - 1 && r !== grid.rows - 1);
    assertNear('section13', `${id}: windows on the perimeter only`,
      interiorWindows.length, 0);
    assertTrue('section13', `${id}: has spawn windows (${grid.windows.length})`,
      grid.windows.length >= 1);

    // Every walkable cell reachable from P — sealed rooms cannot ship.
    const reached = floodReachable(grid).size;
    const total = countWalkable(grid);
    assertNear('section13', `${id}: flood from P covers every walkable cell`,
      reached, total);

    // World mapping: the player start lands exactly at the origin.
    const start = cellToWorld(map, grid, grid.playerStart.c, grid.playerStart.r);
    assertNear('section13', `${id}: player start maps to world x 0`, start.x, 0);
    assertNear('section13', `${id}: player start maps to world z 0`, start.z, 0);
  }
} catch (err) {
  failures.push({ file: 'section13', err });
  console.log(`  FAIL   section 13 threw: ${err.message}`);
}

// ————— Report —————

console.log('');
if (failures.length) {
  console.log(`SUITE FAIL — ${failures.length} failure(s), ${files.length} module(s) checked`);
  process.exitCode = 1;
} else {
  console.log(`SUITE PASS — ${files.length} modules imported cleanly; spawn, scoring, round, best, config, and enemy invariants proven`);
}
