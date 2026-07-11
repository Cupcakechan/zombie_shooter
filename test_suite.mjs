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
const MIN_EXPECTED_MODULES = 17;

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
    'COLORS.SKY': 'number', 'COLORS.FLOOR': 'number', 'COLORS.WALL': 'number',
    'COLORS.GRID_MAJOR': 'number', 'COLORS.GRID_MINOR': 'number',
    'COLORS.HEMI_SKY': 'number', 'COLORS.HEMI_GROUND': 'number', 'COLORS.SUN': 'number',
    'STORAGE_KEY': 'string',
    'PLAYER.MAX_HITS': 'number', 'PLAYER.DAMAGE_SHAKE_MS': 'number',
    'PLAYER.DAMAGE_SHAKE_AMP': 'number',
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
} catch (err) {
  failures.push({ file: 'section8', err });
  console.log(`  FAIL   section 8 threw: ${err.message}`);
}

// ————— Report —————

console.log('');
if (failures.length) {
  console.log(`SUITE FAIL — ${failures.length} failure(s), ${files.length} module(s) checked`);
  process.exitCode = 1;
} else {
  console.log(`SUITE PASS — ${files.length} modules imported cleanly; spawn, scoring, round, best, config, and enemy invariants proven`);
}
