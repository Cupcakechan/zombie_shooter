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
//
// This sat at 28 from pass 14 until 14c while the walker found 29 — pass 15
// added projectiles.js and never raised the floor, so for two passes the
// guard would have shrugged at that module disappearing entirely. A floor
// that lags the truth is not a floor. 30 = 31 files under src/ minus main.js.
const MIN_EXPECTED_MODULES = 31;

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
    'PITCH_CLAMP_DEG': 'number',
    'ROUND_LENGTH_S': 'number', 'COUNTDOWN_S': 'number',
    'TARGETS_LIVE': 'number', 'TARGET_RADIUS': 'number', 'MIN_TARGET_SEPARATION': 'number',
    'SPAWN.SLOT_XS': 'numberArray', 'SPAWN.SLOT_ZS': 'numberArray',
    'SPAWN.JITTER_X': 'number', 'SPAWN.JITTER_Z': 'number',
    'SPAWN.Y_MIN': 'number', 'SPAWN.Y_MAX': 'number',
    'POINTS_PER_HIT': 'number', 'STREAK_TIERS': 'tierArray',
    'POP_MS': 'number', 'FLASH_MS': 'number', 'FLASH_INTENSITY': 'number',
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
    'BLAST.MAX': 'number', 'BLAST.FLASH_LIFE_MS': 'number',
    'BLAST.FLASH_RADIUS_MULT': 'number', 'BLAST.RING_GROW_MS': 'number',
    'BLAST.RING_FADE_MS': 'number', 'BLAST.RING_THICKNESS': 'number',
    'BLAST.RING_SEGMENTS': 'number', 'BLAST.RING_Y': 'number',
    'BLAST.BURST_SPEED': 'number',
    'CASINGS.SIZE': 'number', 'CASINGS.COLOR': 'number',
    'CASINGS.PORT_UP': 'number', 'CASINGS.PORT_FWD': 'number',
    'CASINGS.EJECT_SPEED': 'number', 'CASINGS.EJECT_UP': 'number',
    'CASINGS.JITTER': 'number', 'CASINGS.SPIN': 'number',
    'CASINGS.GRAVITY': 'number', 'CASINGS.RESTITUTION': 'number',
    'CASINGS.LINGER_MS': 'number', 'CASINGS.VANISH_MS': 'number',
    'CASINGS.MAX': 'number',
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

  // Duplicate-key scan. A schema check reads the CONFIG OBJECT, and by then
  // JS has already collapsed any duplicate key — last one wins, the rest
  // vanish silently. So a runtime guard physically CANNOT see this class of
  // bug, and config.js carried `RECOIL_MS` and `RECOIL_KICK_DEG` twice each
  // for nine passes with a full schema watching. Tuning the first copy of a
  // doubled key does nothing, and nothing tells you.
  //
  // Text-level, because that is the only level where the duplicate still
  // exists. It exists because config.js is delivered as PASTE-INS, and a
  // paste that lands one block low doubles lines with nothing to catch it
  // (it did exactly that in 14c — see LESSONS).
  {
    const cfgText = readFileSync(join('src', 'config.js'), 'utf8');
    // Same leaf name under two different blocks is legal and common
    // (BLOOD.COLOR / CASINGS.COLOR, PROJECTILES.MAX / BLAST.MAX), so a raw
    // count can't be the test — scope each key to its enclosing block.
    const perBlock = new Map(); // block -> Map(key -> count)
    let block = '(root)';
    for (const line of cfgText.split('\n')) {
      const open = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*:\s*\{\s*$/);
      const close = line.match(/^\s{2}\},?\s*$/);
      const leaf = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*:\s*[^{\s]/);
      if (open) { block = open[1]; perBlock.set(block, new Map()); continue; }
      if (close) { block = '(root)'; continue; }
      if (leaf) {
        if (!perBlock.has(block)) perBlock.set(block, new Map());
        const m = perBlock.get(block);
        m.set(leaf[1], (m.get(leaf[1]) || 0) + 1);
      }
    }
    const dups = [];
    for (const [b, m] of perBlock) {
      for (const [k, n] of m) if (n > 1) dups.push(`${b}.${k} x${n}`);
    }
    assertTrue('section5',
      `config.js declares no key twice${dups.length ? ' — FOUND: ' + dups.join(', ') : ''}`,
      dups.length === 0);
    // Guard-the-guard: a rotted regex finding nothing must fail, not pass.
    assertTrue('section5',
      `dup scan actually parsed config.js (${perBlock.size} blocks seen)`,
      perBlock.size >= 5);
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
  const { WEAPON_TYPES: WEAPON_TYPES_5 } =
    await import(pathToFileURL(join('src', 'data', 'weaponTypes.js')).href);
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
  // Weapons earn the same finite-leaf guarantee the day they become data
  // (pass 17). A NaN in PARTS would build a gun with an invalid geometry and
  // three.js would take it without complaint.
  sweepRegistry(WEAPON_TYPES_5, 'WEAPON_TYPES');
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
    'SCORE.KILL',
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

  // CRAWL block schema (7c): OPTIONAL per type — no block simply means the
  // type never crawls (guarded at every read site). But when the block IS
  // present, every field the crawl logic reads unguarded must be a finite
  // number — the same silent-NaN class as the main schema. Negative-tested
  // by name below, per the section-5 rule.
  const CRAWL_REQUIRED = [
    'LEG_HP', 'FALL_MS', 'SPEED_MULT', 'RING_FRACTION',
    'ATTACK.RANGE_SLACK', 'ATTACK.WINDUP_MS', 'ATTACK.STRIKE_MS',
    'ATTACK.RECOVER_MS', 'ATTACK.COOLDOWN_MS', 'ATTACK.DAMAGE',
    'ATTACK.REAR_RAD', 'ATTACK.THRUST_RAD',
    'WALL.REACH', 'WALL.RADIUS',
  ];
  const missingCrawlKeys = (type) => (!type.CRAWL ? [] : CRAWL_REQUIRED
    .filter((fp) => {
      const v = resolvePath(type.CRAWL, fp);
      return typeof v !== 'number' || !Number.isFinite(v);
    })
    .map((fp) => `CRAWL.${fp}`));
  for (const [typeId, type] of Object.entries(ENEMY_TYPES)) {
    const missing = missingCrawlKeys(type);
    assertTrue('section5',
      `${typeId}: CRAWL schema ${type.CRAWL ? `complete (${CRAWL_REQUIRED.length} keys)` : 'absent — allowed'}`,
      missing.length === 0);
    if (missing.length) console.log(`         missing: ${missing.join(', ')}`);
  }
  {
    // Negative: the checker must NAME a deleted key, never pass silently.
    const broken = structuredClone(ENEMY_TYPES.proto_zombie);
    delete broken.CRAWL.FALL_MS;
    const named = missingCrawlKeys(broken);
    assertTrue('section5', 'CRAWL schema names a missing key (negative test)',
      named.length === 1 && named[0] === 'CRAWL.FALL_MS');
  }

  // EXPLODE block schema (pass 14): OPTIONAL, exactly like CRAWL — no block
  // means the type never blasts, and blastDamage() returns 0 for it. But a
  // block that's PRESENT and half-filled is the RING_FRACTION incident all
  // over again: it parses, it imports, it greps clean, and the game quietly
  // runs a NaN radius that no comparison ever wins. Every field the blast
  // path reads unguarded is named here.
  const EXPLODE_REQUIRED = [
    'RADIUS', 'CORE_RADIUS', 'DAMAGE', 'CORE_DAMAGE',
    'PARTICLES', 'PULSE_HZ', 'PULSE_COLOR',
  ];
  const missingExplodeKeys = (type) => (!type.EXPLODE ? [] : EXPLODE_REQUIRED
    .filter((fp) => {
      const v = resolvePath(type.EXPLODE, fp);
      return typeof v !== 'number' || !Number.isFinite(v);
    })
    .map((fp) => `EXPLODE.${fp}`));
  for (const [typeId, type] of Object.entries(ENEMY_TYPES)) {
    const missing = missingExplodeKeys(type);
    assertTrue('section5',
      `${typeId}: EXPLODE schema ${type.EXPLODE ? `complete (${EXPLODE_REQUIRED.length} keys)` : 'absent — allowed'}`,
      missing.length === 0);
    if (missing.length) console.log(`         missing: ${missing.join(', ')}`);
  }
  {
    // Negative: the checker must NAME a deleted key, never pass silently.
    const broken = structuredClone(ENEMY_TYPES.exploder);
    delete broken.EXPLODE.RADIUS;
    const named = missingExplodeKeys(broken);
    assertTrue('section5', 'EXPLODE schema names a missing key (negative test)',
      named.length === 1 && named[0] === 'EXPLODE.RADIUS');
  }

  // RANGED block schema (pass 15): OPTIONAL, the third of the same family
  // (CRAWL, EXPLODE, RANGED). Present-and-half-filled is the silent-NaN
  // class one more time, and this one is especially quiet: a NaN GLOB_SPEED
  // divides into a NaN flight time, arcVelocity returns a NaN velocity, and
  // the glob is spawned at NaN — invisible, harmless, and reported nowhere.
  const RANGED_REQUIRED = [
    'GLOB_SPEED', 'GRAVITY', 'GLOB_RADIUS', 'DAMAGE', 'LIFE_MS', 'COLOR',
  ];
  const missingRangedKeys = (type) => (!type.RANGED ? [] : RANGED_REQUIRED
    .filter((fp) => {
      const v = resolvePath(type.RANGED, fp);
      return typeof v !== 'number' || !Number.isFinite(v);
    })
    .map((fp) => `RANGED.${fp}`));
  for (const [typeId, type] of Object.entries(ENEMY_TYPES)) {
    const missing = missingRangedKeys(type);
    assertTrue('section5',
      `${typeId}: RANGED schema ${type.RANGED ? `complete (${RANGED_REQUIRED.length} keys)` : 'absent — allowed'}`,
      missing.length === 0);
    if (missing.length) console.log(`         missing: ${missing.join(', ')}`);
  }
  {
    // Negative: the checker must NAME a deleted key, never pass silently.
    const broken = structuredClone(ENEMY_TYPES.spitter);
    delete broken.RANGED.GLOB_SPEED;
    const named = missingRangedKeys(broken);
    assertTrue('section5', 'RANGED schema names a missing key (negative test)',
      named.length === 1 && named[0] === 'RANGED.GLOB_SPEED');
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
  const { WEAPON_TYPES: WT } =
    await import(pathToFileURL(join('src', 'data', 'weaponTypes.js')).href);
  // Pass 17: the magazine is a property of the WEAPON. Derived from the
  // registry, never typed in — a pin holding its own copy of MAG_SIZE would
  // pass forever while the gun disagreed with it.
  const M = WT.pistol.MAG_SIZE;
  const R = WT.pistol.RELOAD_MS;

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

  // — Pass 17: the magazines are INDEPENDENT and they PERSIST across swaps —
  // The block that would have caught a shared-magazine implementation, which
  // reads identically at a glance and turns every swap into a free reload.
  {
    A.resetAmmo();
    assertTrue('section10', 'a fresh round starts on slot 1',
      A.getActiveWeaponId() === 'pistol');
    A.consumeRound();
    A.consumeRound();
    const pistolLeft = A.getMag();
    assertNear('section10', 'pistol down two', pistolLeft, M - 2);

    assertTrue('section10', 'swap to a real weapon reports true',
      A.setActiveWeapon('shotgun') === true);
    assertNear('section10', "the shotgun has its OWN full tube (not the pistol's count)",
      A.getMag(), WT.shotgun.MAG_SIZE);
    assertTrue('section10', 'and the pistol still holds what it held',
      A.getMagOf('pistol') === pistolLeft);

    A.consumeRound();
    assertNear('section10', 'firing the shotgun spends the SHOTGUN',
      A.getMag(), WT.shotgun.MAG_SIZE - 1);
    assertNear('section10', '...and never touches the pistol',
      A.getMagOf('pistol'), pistolLeft);

    assertTrue('section10', 'swapping back finds the pistol as you left it',
      (A.setActiveWeapon('pistol'), A.getMag() === pistolLeft));
    assertTrue('section10', 'a no-op swap reports false (so it cannot cancel a reload)',
      A.setActiveWeapon('pistol') === false);
    assertTrue('section10', 'an unknown weapon is refused, not thrown',
      A.setActiveWeapon('railgun') === false);
  }

  // — The reload is the ACTIVE weapon's, and a swap CANCELS it —
  {
    A.resetAmmo();
    A.setActiveWeapon('shotgun');
    A.consumeRound();
    assertTrue('section10', 'shotgun reload starts', A.startReload() === true);
    // The shotgun's reload is longer than the pistol's; at the pistol's
    // RELOAD_MS it must still be running, or the timing is not per-weapon.
    A.updateAmmo(WT.pistol.RELOAD_MS);
    assertTrue('section10',
      `the shotgun reloads on ITS clock (${WT.shotgun.RELOAD_MS} ms), not the pistol's (${WT.pistol.RELOAD_MS} ms)`,
      A.isReloading());

    assertTrue('section10', 'swapping away CANCELS the reload',
      (A.setActiveWeapon('pistol'), !A.isReloading()));
    assertTrue('section10', 'and the cancelled reload banked NOTHING',
      A.getMagOf('shotgun') === WT.shotgun.MAG_SIZE - 1);
    assertNear('section10', 'a cancelled reload leaves no progress behind',
      A.reloadProgress(), 0);
  }

  // — Slot resolution + cycling: Q's whole implementation —
  {
    A.resetAmmo();
    assertTrue('section10', 'slot 1 is the pistol', A.weaponIdForSlot(1) === 'pistol');
    assertTrue('section10', 'slot 2 is the shotgun', A.weaponIdForSlot(2) === 'shotgun');
    assertTrue('section10', 'an empty slot resolves to null, never undefined-indexing',
      A.weaponIdForSlot(9) === null && A.weaponIdForSlot(0) === null);
    assertTrue('section10', 'cycle goes forward', A.nextWeaponId() === 'shotgun');
    A.setActiveWeapon('shotgun');
    assertTrue('section10', 'cycle WRAPS at the end of the roster',
      A.nextWeaponId() === 'pistol');
  }
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
  // 7c split the old 'limb' population: the ARM chain keeps 'limb' (6
  // meshes: uppers, forearms, hands), the LEG chain tags 'leg' (6 meshes:
  // thighs, shins, feet) so leg damage is countable for the crawl.
  const VALID_PARTS = new Set(['head', 'torso', 'limb', 'leg']);
  const partCounts = { head: 0, torso: 0, limb: 0, leg: 0 };
  let untagged = 0;
  group.traverse((c) => {
    if (!c.isMesh) return;
    if (VALID_PARTS.has(c.userData.part)) partCounts[c.userData.part] += 1;
    else untagged += 1;
  });
  assertNear('section11', 'every mesh carries a valid part tag (untagged)', untagged, 0);
  assertTrue('section11',
    `all four tiers present (head ${partCounts.head}, torso ${partCounts.torso}, limb ${partCounts.limb}, leg ${partCounts.leg})`,
    partCounts.head >= 2 && partCounts.torso >= 2
    && partCounts.limb >= 6 && partCounts.leg >= 6);

  // Damage tiers are exactly the registry's (pure lookup, fallback-guarded).
  const { partDamage } = await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  assertNear('section11', 'head damage matches registry', partDamage(zb, 'head'), zb.HITBOX.HEAD);
  assertNear('section11', 'torso damage matches registry', partDamage(zb, 'torso'), zb.HITBOX.TORSO);
  assertNear('section11', 'limb damage matches registry', partDamage(zb, 'limb'), zb.HITBOX.LIMB);
  assertNear('section11', 'untagged part falls back to torso tier',
    partDamage(zb, undefined), zb.HITBOX.TORSO);
  assertNear('section11', 'missing HITBOX table falls back to 1', partDamage({}, 'head'), 1);

  // The waist joint (7c.2): chest, head, and both arm chains hang off a
  // waist group pivoted at the belly/chest seam — and at rotation 0 the
  // re-parent must have moved NOTHING. Exact pins: head and shoulder
  // world positions equal the registry-derived height stack to 1e-9.
  // These are the proof that the sphinx rig is standing-neutral; a slip
  // in the pivot re-expression fails HERE, not as a shifted silhouette.
  assertTrue('section11', 'waist exists in the parts map', !!parts.waist);
  assertTrue('section11', 'head hangs off the waist', parts.head.parent === parts.waist);
  assertTrue('section11', 'both arms hang off the waist',
    parts.armL.parent === parts.waist && parts.armR.parent === parts.waist);
  assertNear('section11', 'standing waist rotation is 0 (world-identical build)',
    parts.waist.rotation.x, 0);
  const Bx = zb.BODY;
  const hipTopX = Bx.FOOT.H + Bx.LEG.LEN;
  const bellyYX = hipTopX + Bx.BELLY.H / 2 - 0.06;
  const chestYX = bellyYX + Bx.BELLY.H / 2 + Bx.CHEST.H / 2 - 0.08;
  const headYX = chestYX + (Bx.CHEST.H / 2) * Math.cos(Bx.CHEST.HUNCH)
    + Bx.HEAD.H / 2 - 0.06;
  const headWX = worldOf(parts.head);
  assertTrue('section11',
    `head world position matches the registry stack exactly (y ${headWX.y.toFixed(4)} = ${headYX.toFixed(4)}, z ${headWX.z.toFixed(4)})`,
    Math.abs(headWX.y - headYX) < 1e-9
    && Math.abs(headWX.z - (Bx.CHEST.FWD + Bx.HEAD.FWD)) < 1e-9
    && Math.abs(headWX.x) < 1e-9);
  const shL = worldOf(parts.armL);
  const shR = worldOf(parts.armR);
  assertTrue('section11',
    `shoulders sit exactly at the registry anchor (±${Bx.ARM.X}, ${Bx.ARM.Y}, ${Bx.ARM.FWD})`,
    Math.abs(shL.x + Bx.ARM.X) < 1e-9 && Math.abs(shL.y - Bx.ARM.Y) < 1e-9
    && Math.abs(shL.z - Bx.ARM.FWD) < 1e-9
    && Math.abs(shR.x - Bx.ARM.X) < 1e-9 && Math.abs(shR.y - Bx.ARM.Y) < 1e-9
    && Math.abs(shR.z - Bx.ARM.FWD) < 1e-9);

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
  assertTrue('section14', `village: every window is an entry spot (${vSpots.length}/11)`,
    vSpots.length === 11);
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
    // Non-climbers (PRONE spawns, NO_CLIMB types — pass 13) never reach
    // the vault branch: they read the ground field and the belt excludes
    // them, so the trigger/standoff ordering is vacuous for them. The
    // brute's larger standoff (2.05 > trigger 2) is legal BECAUSE it
    // can't climb — flip NO_CLIMB off and this pin fires again.
    if (t.SPAWN?.PRONE || t.NO_CLIMB) continue;
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

// ————— Section 15: the Crawler (pass 7c) —————
// Leg destruction → prone crawl. The pure pieces are proven here: leg
// damage routing and its fallbacks, the threshold arithmetic (a DESIGN
// probe — three leg hits collapse the Shambler), the collapse timeline's
// exact endpoints (the climbPose continuity rule), the prone wall reach
// vs the REGISTRY-DERIVED body extent (the VAULT_TRIGGER ordering class),
// and the ground field's by-construction window avoidance.

console.log('');
console.log('— Section 15: the Crawler (pass 7c) —');
try {
  const { partDamage: pd15, collapsePose, CRAWL_POSE, proneChainExtents } =
    await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  const { ENEMY_TYPES: ET15 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const zt = ET15.proto_zombie;
  const CR = zt.CRAWL;

  // — Leg damage routing + fallbacks (the partDamage contract): the tag
  // changes ACCOUNTING, never damage — and a registry without the new
  // entries keeps the old numbers exactly.
  assertNear('section15', 'leg hits deal the LEG tier', pd15(zt, 'leg'), zt.HITBOX.LEG);
  assertNear('section15', 'LEG tier equals LIMB tier (accounting, not damage)',
    zt.HITBOX.LEG, zt.HITBOX.LIMB);
  assertNear('section15', 'leg falls back to the LIMB tier when LEG is absent',
    pd15({ HITBOX: { LIMB: 0.5 } }, 'leg'), 0.5);
  assertNear('section15', 'leg falls back to torso-tier 1 with no table',
    pd15({}, 'leg'), 1);

  // — Threshold arithmetic (hand-computed design probe): exactly THREE leg
  // hits at the LEG tier cross LEG_HP — two must not, three must.
  assertTrue('section15',
    `3 leg hits collapse, 2 don't (LEG_HP ${CR.LEG_HP}, tier ${zt.HITBOX.LEG})`,
    2 * zt.HITBOX.LEG < CR.LEG_HP && 3 * zt.HITBOX.LEG >= CR.LEG_HP);

  // — The claw's pacing and ring, relative like the standing asserts so
  // retuning stays safe.
  assertTrue('section15', 'crawl cooldown covers windup+strike+recover',
    CR.ATTACK.COOLDOWN_MS >= CR.ATTACK.WINDUP_MS + CR.ATTACK.STRIKE_MS + CR.ATTACK.RECOVER_MS);
  // CONSCIOUS MOVE (pass 13b): the old pin — crawl stop INSIDE the
  // standing stop — encoded the origin-based ring that walked the body
  // under the player (prone, the hands lead the feet origin by ~2 m).
  // The ring now derives from the ARM chain × RING_FRACTION, so the new
  // bounds are physical: the ring must sit INSIDE the arm extent (the
  // hands can actually connect at strike range) and be a sane fraction.
  const ring15 = proneChainExtents(zt).arm * CR.RING_FRACTION;
  assertTrue('section15',
    `strike ring inside the arm extent (${ring15.toFixed(2)} <= ${proneChainExtents(zt).arm.toFixed(2)}) — hands connect`,
    ring15 <= proneChainExtents(zt).arm && ring15 > 0);
  assertTrue('section15', 'RING_FRACTION is a real fraction (0 < f <= 1)',
    CR.RING_FRACTION > 0 && CR.RING_FRACTION <= 1);
  assertTrue('section15', 'crawl is slower than the walk (0 < SPEED_MULT < 1)',
    CR.SPEED_MULT > 0 && CR.SPEED_MULT < 1);

  // — The collapse timeline: k=0 is EXACTLY the walk rest, k=1 EXACTLY the
  // crawl rest (a pop at either end reads as a glitch), and the pitch
  // never rocks back upright mid-fall.
  const rest15 = {
    REST: zt.BODY.ARM.REST_RAD, ELBOW: zt.ANIM.ELBOW_BEND,
    KNEE: zt.ANIM.KNEE_REST, LEAN: zt.ANIM.LEAN,
  };
  const c0 = collapsePose(0, rest15);
  assertTrue('section15', 'collapse k=0 is the walk rest pose',
    c0.pitch === rest15.LEAN && c0.lift === 0 && c0.shoulder === rest15.REST
    && c0.elbow === rest15.ELBOW && c0.hipL === 0 && c0.hipR === 0
    && c0.kneeL === rest15.KNEE && c0.kneeR === rest15.KNEE && c0.headUp === 0
    && c0.waist === 0);
  const c1 = collapsePose(1, rest15);
  assertTrue('section15', 'collapse k=1 is the crawl rest pose',
    Math.abs(c1.pitch - CRAWL_POSE.PITCH) < 1e-9
    && Math.abs(c1.lift - CRAWL_POSE.Y) < 1e-9
    && Math.abs(c1.shoulder - CRAWL_POSE.ARM_REST) < 1e-9
    && Math.abs(c1.elbow - CRAWL_POSE.ELBOW) < 1e-9
    && Math.abs(c1.hipL - CRAWL_POSE.HIP_TRAIL) < 1e-9
    && Math.abs(c1.hipR - CRAWL_POSE.HIP_TRAIL) < 1e-9
    && Math.abs(c1.kneeL - CRAWL_POSE.KNEE_TRAIL) < 1e-9
    && Math.abs(c1.kneeR - CRAWL_POSE.KNEE_TRAIL) < 1e-9
    && Math.abs(c1.headUp - CRAWL_POSE.HEAD_UP) < 1e-9
    && Math.abs(c1.waist - CRAWL_POSE.WAIST) < 1e-9);
  let pitchMono = true;
  let prevPitch = -Infinity;
  for (let k = 0; k <= 1.0001; k += 0.01) {
    const c = collapsePose(Math.min(1, k), rest15);
    if (c.pitch < prevPitch - 1e-9) pitchMono = false;
    prevPitch = c.pitch;
  }
  assertTrue('section15', 'collapse pitch never rocks back upright', pitchMono);

  // — Prone wall reach vs the registry-derived body extent (the ordering
  // invariant class): lying down, the forward extent from the feet origin
  // is the LONGER of the head chain and the arm chain. A reach that
  // undercovers this buries geometry in any faced wall.
  // Pass 13b: the chain formula moved into enemies.js (proneChainExtents)
  // — the SAME function the strike ring uses at runtime, so this pin now
  // tests the real thing instead of a hand-kept mirror. A retune of the
  // pose or the body re-derives both consumers at once.
  const ext15 = proneChainExtents(zt);
  const extent = Math.max(ext15.head, ext15.arm);
  assertTrue('section15',
    `prone reach covers the body extent (${(CR.WALL.REACH + CR.WALL.RADIUS).toFixed(2)} >= ${extent.toFixed(2)})`,
    CR.WALL.REACH + CR.WALL.RADIUS >= extent);
  // The formula's own sanity: MEASURED-at-HEAD proto extents (probe
  // 2026-07-13: arm 2.171 >= head 1.84) — a broken stack fails HERE by
  // name, not as a mystery undercoverage.
  assertTrue('section15',
    `proto chain sanity (arm ${ext15.arm.toFixed(2)} ~ 2.17, head ${ext15.head.toFixed(2)} ~ 1.84)`,
    Math.abs(ext15.arm - 2.171) < 0.01 && Math.abs(ext15.head - 1.84) < 0.01);

  // — Ground field (windowCost 0): NO cell's descent step lands on a
  // window, and coverage still equals the flood minus the target cell —
  // a crawler's route contains no windows BY CONSTRUCTION, with no cell
  // stranded. This is the whole fix for "can't vault, mustn't stick at
  // the glass".
  const { MAPS: GM15 } = await import(pathToFileURL(join('src', 'data', 'maps.js')).href);
  const { parseLayout: gp15, countWalkable: gc15 } =
    await import(pathToFileURL(join('src', 'game', 'mapGrid.js')).href);
  const { buildFlowField: bff15 } =
    await import(pathToFileURL(join('src', 'game', 'flowField.js')).href);
  const gGrid = gp15(GM15.village01);
  const gField = bff15(gGrid, gGrid.playerStart, { windowCost: 0 });
  let windowSteps = 0;
  let routed = 0;
  for (let r = 0; r < gGrid.rows; r++) {
    for (let c = 0; c < gGrid.cols; c++) {
      const s = gField.stepAt(c, r);
      if (!s) continue;
      routed += 1;
      if (gGrid.at(c + s.dc, r + s.dr) === 'W') windowSteps += 1;
    }
  }
  assertTrue('section15',
    `ground field: zero steps land on a window (got ${windowSteps})`,
    windowSteps === 0);
  assertTrue('section15',
    `ground field: full coverage minus the target (${routed} = ${gc15(gGrid)} - 1)`,
    routed === gc15(gGrid) - 1);
} catch (err) {
  failures.push({ file: 'section15', err });
  console.log(`  FAIL   section 15 threw: ${err.message}`);
}

// ————— Section 16: kill scoring (pass 10) —————
// scoreKill is the SINGLE write site of the waves score (pass 11 makes it
// spendable — these pins are the contract it will build on). Pins are
// RELATIVE to the registry + config values, so retunes stay safe.
console.log('');
console.log('— Section 16: kill scoring (pass 10) —');
try {
  const { scoreKill, getWavesScore, startWaves } =
    await import(pathToFileURL(join('src', 'game', 'waves.js')).href);
  const { CONFIG: cfg16 } =
    await import(pathToFileURL(join('src', 'config.js')).href);
  const { ENEMY_TYPES: types16 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const bounty = types16.proto_zombie.SCORE.KILL;
  const hsMult = cfg16.WAVES_SCORE.HEADSHOT_MULT;

  startWaves(); // known-zero accumulator
  assertTrue('section16', 'fresh waves session starts at score 0',
    getWavesScore() === 0);
  const body = scoreKill({ value: bounty, part: 'torso' });
  assertTrue('section16',
    `a body kill pays the registry bounty exactly (${body} = ${bounty})`,
    body === bounty && getWavesScore() === bounty);
  const head = scoreKill({ value: bounty, part: 'head' });
  assertTrue('section16',
    `a headshot kill pays bounty × HEADSHOT_MULT (${head} = ${bounty * hsMult})`,
    head === bounty * hsMult);
  const leg = scoreKill({ value: bounty, part: 'leg' });
  assertTrue('section16', 'a leg-shot kill pays ×1 (only the HEAD multiplies)',
    leg === bounty);
  assertTrue('section16', 'the accumulator is the sum of awards',
    getWavesScore() === bounty + bounty * hsMult + bounty);
  assertTrue('section16', 'a value-less kill pays 0, never NaN (guarded)',
    scoreKill({ part: 'head' }) === 0 && scoreKill() === 0
    && Number.isFinite(getWavesScore()));
  startWaves();
  assertTrue('section16', 'startWaves resets the score with the session',
    getWavesScore() === 0);
} catch (err) {
  failures.push({ file: 'section16', err });
  console.log(`  FAIL   section 16 threw: ${err.message}`);
}

// ————— Section 17: spawnable crawlers (pass 7d) —————
// The type dimension: shares → exact counts (largest remainder), the
// window/climber pairing repair, spec plumbing, and the crawler entry's
// structural contract. Pins are relative to the registry/table so Daniel
// can retune values freely.
console.log('');
console.log('— Section 17: spawnable crawlers (pass 7d) —');
try {
  const { typeAssignments, pairSpawns, waveSpec: spec17 } =
    await import(pathToFileURL(join('src', 'game', 'waves.js')).href);
  const { ENEMY_TYPES: types17 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const { WAVES: waves17 } =
    await import(pathToFileURL(join('src', 'data', 'waveTable.js')).href);
  const tally = (arr) => arr.reduce((m, id) => {
    m[id] = (m[id] || 0) + 1;
    return m;
  }, {});

  const a4 = tally(typeAssignments(4, { a: 0.75, b: 0.25 }, () => 0));
  assertTrue('section17', 'shares round by largest remainder (4 × 75/25 → 3+1)',
    a4.a === 3 && a4.b === 1);
  const a3 = tally(typeAssignments(3, { a: 0.85, b: 0.15 }, () => 0));
  assertTrue('section17', 'a thin share at a small count rounds to zero (3 × 85/15 → 3+0)',
    a3.a === 3 && (a3.b ?? 0) === 0);
  const a7 = tally(typeAssignments(7, { a: 0.5, b: 0.3, c: 0.2 }, Math.random));
  assertTrue('section17',
    `three-way split sums exactly (7 × 50/30/20 → 4+2+1, got ${a7.a}+${a7.b}+${a7.c})`,
    a7.a === 4 && a7.b === 2 && a7.c === 1);
  const aNone = typeAssignments(3, undefined, Math.random);
  assertTrue('section17', 'a typeless row stays all-Shambler (guarded)',
    aNone.length === 3 && aNone.every((id) => id === 'proto_zombie'));

  const canW = (id) => id !== 'crawler';
  const paired = pairSpawns(
    ['window', 'perimeter', 'window', 'perimeter'],
    ['crawler', 'proto_zombie', 'crawler', 'proto_zombie'], canW,
  );
  const windowsOk = paired.kinds.every((k, i) => k !== 'window' || canW(paired.typeIds[i]));
  assertTrue('section17', 'pairing repair: every window slot holds a climber', windowsOk);
  // Multiset equality must be key-order-blind: tally() insertion order
  // follows the (repaired) array order, so canonicalize by sorted keys.
  const canon = (m) => JSON.stringify(Object.fromEntries(Object.entries(m).sort()));
  assertTrue('section17', 'pairing repair preserves both multisets',
    canon(tally(paired.kinds))
      === canon(tally(['window', 'perimeter', 'window', 'perimeter']))
    && canon(tally(paired.typeIds))
      === canon(tally(['crawler', 'proto_zombie', 'crawler', 'proto_zombie'])));
  const demoted = pairSpawns(['window', 'window'], ['crawler', 'crawler'], canW);
  assertTrue('section17', 'an all-crawler window wave demotes to perimeter (no stranding)',
    demoted.kinds.every((k) => k === 'perimeter'));

  const lastRow = waves17.TABLE[waves17.TABLE.length - 1];
  const crawlerWave = waves17.TABLE.findIndex((r) => (r.types?.crawler ?? 0) > 0) + 1;
  assertTrue('section17',
    `the table introduces the crawler (wave ${crawlerWave})`,
    crawlerWave > 0 && (spec17(crawlerWave).types.crawler ?? 0) > 0);
  assertTrue('section17', 'EXTEND carries the last row\'s type mix forever',
    JSON.stringify(spec17(99).types) === JSON.stringify(lastRow.types));

  const cr = types17.crawler;
  assertTrue('section17', 'crawler: SPAWN.PRONE is set (spawns already down)',
    cr && cr.SPAWN.PRONE === true);
  assertTrue('section17', 'crawler: has a CRAWL block (the prone spawn depends on it)',
    !!cr.CRAWL && Number.isFinite(cr.CRAWL.LEG_HP));
  assertTrue('section17',
    `crawler: the head still one-shots (HITBOX.HEAD ${cr.HITBOX.HEAD} >= HP ${cr.HP})`,
    cr.HITBOX.HEAD >= cr.HP);
} catch (err) {
  failures.push({ file: 'section17', err });
  console.log(`  FAIL   section 17 threw: ${err.message}`);
}

// ————— Section 18: wave HP scaling (pass 12) —————
// hpMultAt is pure with injectable config; the pins are RELATIVE to the
// WAVES.HP block so retunes stay safe — except the one-shot-era pin,
// which deliberately TIES three tunables together: if RAMP_START, HP, or
// HITBOX.HEAD moves such that heads stop one-shotting inside the
// pre-ramp era, the suite flags it so the change is conscious.
console.log('');
console.log('— Section 18: wave HP scaling (pass 12) —');
try {
  const { hpMultAt, waveSpec: spec18 } =
    await import(pathToFileURL(join('src', 'game', 'waves.js')).href);
  const { WAVES: waves18 } =
    await import(pathToFileURL(join('src', 'data', 'waveTable.js')).href);
  const { ENEMY_TYPES: types18 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const HPC = waves18.HP;

  assertTrue('section18', 'wave 1 is unscaled (hpMult 1)', hpMultAt(1) === 1);
  assertTrue('section18',
    `the ramp starts AFTER RAMP_START (wave ${HPC.RAMP_START} still 1.0)`,
    hpMultAt(HPC.RAMP_START) === 1);
  assertNear('section18',
    `one wave past the ramp adds exactly STEP (${1 + HPC.STEP})`,
    hpMultAt(HPC.RAMP_START + 1), 1 + HPC.STEP);
  assertNear('section18', 'the cap engages by wave 99', hpMultAt(99), HPC.CAP);
  // null, not undefined: a default parameter substitutes on undefined,
  // which would silently re-inject the real WAVES.HP instead of testing
  // the guard branch. null passes through and hits `if (!hpCfg)`.
  assertTrue('section18', 'a table without an HP block scales nothing (guard)',
    hpMultAt(50, null) === 1);
  assertTrue('section18', 'waveSpec carries hpMult in both branches',
    spec18(1).hpMult === 1 && Math.abs(spec18(99).hpMult - HPC.CAP) < 1e-9);

  // CONSCIOUS MOVE (pass 13): the sweep now exempts HEAVY-declared types.
  // The brute is DESIGNED outside the one-shot guarantee (HEAD 3 < HP 8,
  // ~3 headshots base) — the registry flag carries that intent, and the
  // stale-flag pin below keeps the exemption honest: a HEAVY whose head
  // one-shots after a retune fails loudly, so the sweep can never shrink
  // silently.
  let oneShotEra = true;
  for (const [, t] of Object.entries(types18)) {
    if (t.HEAVY) continue;
    for (let n = 1; n <= HPC.RAMP_START; n += 1) {
      if (t.HITBOX.HEAD < t.HP * hpMultAt(n)) oneShotEra = false;
    }
  }
  assertTrue('section18',
    `heads one-shot every NON-HEAVY type through the whole pre-ramp era (waves 1–${HPC.RAMP_START})`,
    oneShotEra);
  for (const [id, t] of Object.entries(types18)) {
    if (!t.HEAVY) continue;
    assertTrue('section18',
      `${id}: HEAVY is real, not stale (HEAD ${t.HITBOX.HEAD} < HP ${t.HP})`,
      t.HITBOX.HEAD < t.HP);
  }
} catch (err) {
  failures.push({ file: 'section18', err });
  console.log(`  FAIL   section 18 threw: ${err.message}`);
}

// ————— Section 19: sprinter + brute (pass 13) —————
// The archetype expansion. scaleBody's metric/non-metric contract, each
// type's IDENTITY (relative to the Shambler, so retunes stay safe as long
// as the archetype keeps its point), the speed-cap independence that
// justifies the sprinter being a TYPE, the NO_CLIMB capability plumbing
// through typeCanWindow + pairSpawns, and the §15 prone-coverage bound
// generalized to EVERY type from its OWN dims — a scaled body must carry
// scaled reach or it buries geometry in walls.
console.log('');
console.log('— Section 19: sprinter + brute (pass 13) —');
try {
  const { ENEMY_TYPES: types19, scaleBody } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const { typeCanWindow, pairSpawns: pair19 } =
    await import(pathToFileURL(join('src', 'game', 'waves.js')).href);
  const { WAVES: waves19 } =
    await import(pathToFileURL(join('src', 'data', 'waveTable.js')).href);
  const { CONFIG: CFG19 } =
    await import(pathToFileURL(join('src', 'config.js')).href);
  const base19 = types19.proto_zombie;
  const sp = types19.sprinter;
  const br = types19.brute;

  // — scaleBody: metric fields scale, fractions/angles pass through, the
  // base is never mutated, and no key is dropped (a dropped key would
  // fail the §5 schema as NaN downstream — this names the cause).
  const snap = JSON.stringify(base19.BODY);
  const scaled = scaleBody(base19.BODY, 2);
  assertNear('section19', 'scaleBody scales a metric field (ARM.LEN ×2)',
    scaled.ARM.LEN, base19.BODY.ARM.LEN * 2);
  assertNear('section19', 'scaleBody scales a nested offset (HEAD.FWD ×2)',
    scaled.HEAD.FWD, base19.BODY.HEAD.FWD * 2);
  assertTrue('section19', 'scaleBody leaves fractions alone (KNEE_AT, ELBOW_AT)',
    scaled.LEG.KNEE_AT === base19.BODY.LEG.KNEE_AT
    && scaled.ARM.ELBOW_AT === base19.BODY.ARM.ELBOW_AT);
  assertTrue('section19', 'scaleBody leaves angles alone (HUNCH, COCK, TILT, REST_RAD)',
    scaled.CHEST.HUNCH === base19.BODY.CHEST.HUNCH
    && scaled.HEAD.COCK === base19.BODY.HEAD.COCK
    && scaled.HEAD.TILT === base19.BODY.HEAD.TILT
    && scaled.ARM.REST_RAD === base19.BODY.ARM.REST_RAD);
  assertTrue('section19', 'scaleBody never mutates the base (deep copy)',
    JSON.stringify(base19.BODY) === snap);
  const keysOf = (b) => Object.entries(b)
    .flatMap(([p, f]) => Object.keys(f).map((k) => `${p}.${k}`)).sort().join(',');
  assertTrue('section19', 'scaleBody preserves every key (no field dropped)',
    keysOf(scaled) === keysOf(base19.BODY));

  // — Archetype identity, relative to the Shambler: the sprinter is the
  // FAST-FRAGILE question, the brute the SLOW-DURABLE one. Retune values
  // freely — these fail only if a retune erases the archetype's point.
  assertTrue('section19', `sprinter is faster than the Shambler (${sp.WALK_SPEED} > ${base19.WALK_SPEED})`,
    sp.WALK_SPEED > base19.WALK_SPEED);
  assertTrue('section19', `sprinter is no tougher than the Shambler (HP ${sp.HP} <= ${base19.HP})`,
    sp.HP <= base19.HP);
  assertTrue('section19', `brute is slower than the Shambler (${br.WALK_SPEED} < ${base19.WALK_SPEED})`,
    br.WALK_SPEED < base19.WALK_SPEED);
  assertTrue('section19', `brute is tougher than the Shambler (HP ${br.HP} > ${base19.HP})`,
    br.HP > base19.HP);
  assertTrue('section19', 'brute declares HEAVY + NO_CLIMB (the flags §18 and pairing key off)',
    br.HEAVY === true && br.NO_CLIMB === true);
  assertTrue('section19', 'both archetypes carry a bounty above the Shambler\'s',
    sp.SCORE.KILL > base19.SCORE.KILL && br.SCORE.KILL > base19.SCORE.KILL);

  // — Speed-cap independence: the reason the sprinter is a TYPE and not a
  // wave multiplier. A base sprinter outruns even a CAP-maxed shambler;
  // if a retune breaks this, the type has lost its job.
  assertTrue('section19',
    `a base sprinter outruns a capped shambler (${sp.WALK_SPEED} > ${(base19.WALK_SPEED * waves19.EXTEND.SPEED_CAP).toFixed(2)})`,
    sp.WALK_SPEED > base19.WALK_SPEED * waves19.EXTEND.SPEED_CAP);

  // — Capability plumbing: typeCanWindow's truth table, and pairSpawns
  // fed the REAL predicate (not §17's stub) keeps every window slot
  // climbable with both multisets preserved.
  assertTrue('section19', 'typeCanWindow: shambler and sprinter climb',
    typeCanWindow('proto_zombie') && typeCanWindow('sprinter'));
  assertTrue('section19', 'typeCanWindow: crawler (PRONE) and brute (NO_CLIMB) don\'t',
    !typeCanWindow('crawler') && !typeCanWindow('brute'));
  assertTrue('section19', 'typeCanWindow: an unknown id keeps the legacy climbable default',
    typeCanWindow('no_such_type') === true);
  const canon19 = (arr) => JSON.stringify(Object.entries(arr.reduce((m, id) => {
    m[id] = (m[id] || 0) + 1;
    return m;
  }, {})).sort());
  const kindsIn = ['window', 'window', 'perimeter', 'perimeter'];
  const typesIn = ['brute', 'proto_zombie', 'sprinter', 'crawler'];
  const p19 = pair19(kindsIn, typesIn, typeCanWindow);
  assertTrue('section19', 'pairing with the real predicate: no brute/crawler in a window slot',
    p19.kinds.every((k, i) => k !== 'window' || typeCanWindow(p19.typeIds[i])));
  assertTrue('section19', 'pairing with the real predicate preserves both multisets',
    canon19(p19.kinds) === canon19(kindsIn) && canon19(p19.typeIds) === canon19(typesIn));

  // — Prone coverage AND strike ring for EVERY type from its OWN dims
  // (pass 13b: the chain formula lives in enemies.js — proneChainExtents,
  // the same function the runtime ring uses; a hand-kept mirror here
  // would be the LESSONS #19 class in test form). The absolute overlaps
  // (-0.06/-0.08/-0.04) do NOT scale, which is exactly why a scaled
  // type's reach is derived, never multiplied by hand (probe-confirmed
  // 2026-07-13: brute standing extent 1.156, not the naive 1.264).
  const { proneChainExtents: chains19 } =
    await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  for (const [id, t] of Object.entries(types19)) {
    if (!t.CRAWL) continue;
    const ext = chains19(t);
    const extent = Math.max(ext.head, ext.arm);
    assertTrue('section19',
      `${id}: prone reach covers ITS body extent (${(t.CRAWL.WALL.REACH + t.CRAWL.WALL.RADIUS).toFixed(2)} >= ${extent.toFixed(2)})`,
      t.CRAWL.WALL.REACH + t.CRAWL.WALL.RADIUS >= extent);
    // The strike ring must sit INSIDE the arm extent (the hands can
    // physically connect at strike range) and OUTSIDE the body's solid
    // circle (it must stop before standing inside the player).
    const ring = ext.arm * t.CRAWL.RING_FRACTION;
    assertTrue('section19',
      `${id}: strike ring inside the arms, outside the body (${t.BODY_RADIUS} < ${ring.toFixed(2)} <= ${ext.arm.toFixed(2)})`,
      ring > t.BODY_RADIUS && ring <= ext.arm);
    // THE wall bug, pinned in data (13b hardening). Against a wall behind
    // the player the anti-clip probe holds the crawler's origin at
    // (WALL.REACH + WALL.RADIUS) off the face — it MUST, or the prone arms
    // clip through — while the player stands BODY_RADIUS off it. So the
    // crawler is held at the difference, and that distance is NECESSARILY
    // greater than its stop ring (the standoff has to cover the arms; the
    // ring sits inside them by RING_FRACTION). It can never reach the ring
    // against a wall, so it never settles — it just keeps crawling. Only
    // RANGE_SLACK bridges the gap, and the margin is thin (~0.3 m). If a
    // future RING_FRACTION tune eats it, a wall-backed player silently
    // stops taking crawl damage — the exact bug that shipped in 13b, where
    // a misplaced paste dropped RING_FRACTION, the ring fell back to 1.1,
    // and the gate (1.5) could no longer reach the 1.95 standoff.
    const held = (t.CRAWL.WALL.REACH + t.CRAWL.WALL.RADIUS) - CFG19.PLAYER.BODY_RADIUS;
    const gate = ring + t.CRAWL.ATTACK.RANGE_SLACK;
    assertTrue('section19',
      `${id}: crawl attack gate reaches a wall-backed player (gate ${gate.toFixed(2)} >= held ${held.toFixed(2)}, margin ${(gate - held).toFixed(2)})`,
      gate >= held);
  }

  // — Table debut: both archetypes are reachable through the real table.
  const debutOf = (id) => waves19.TABLE.findIndex((r) => (r.types?.[id] ?? 0) > 0) + 1;
  assertTrue('section19',
    `the table introduces the sprinter (wave ${debutOf('sprinter')}) and the brute (wave ${debutOf('brute')})`,
    debutOf('sprinter') > 0 && debutOf('brute') > 0);
} catch (err) {
  failures.push({ file: 'section19', err });
  console.log(`  FAIL   section 19 threw: ${err.message}`);
}

// ————— Section 20: a wall-backed player takes crawl damage —————
//
// The pin §19 can't be. §19 asserts the GEOMETRY permits the strike; it
// passes just as happily if the gate code measures the wrong thing. This
// section drives the REAL loop — real colliders, real prone reach probe,
// real LOS, real attack gate — and asserts the effect the PLAYER feels:
// damage lands. It exists because the opposite shipped: a crawler ground
// the wall in front of a wall-backed player for a whole pass, dealing
// nothing, and a green-looking suite said everything was fine. Reproduce
// that state (ring fallen back to 1.1) and this section goes red with the
// symptom in the message: "0 hits landed".
//
// Prone coverage is REAL here: only the crawler carries SPAWN.PRONE, so the
// others are crippled the way the player does it — leg hits through
// damageEnemy until legDmg crosses CRAWL.LEG_HP. Spawning them standing and
// calling it a crawl test is how the brute got "verified" at its STANDING
// stop distance (2.00) while its true prone standoff is 2.51.

console.log('');
console.log('— Section 20: wall-backed crawl damage —');
try {
  const THREE20 = await import(pathToFileURL(join('lib', 'three.module.js')).href);
  const {
    initEnemies: init20, setMapColliders: setCol20, spawnEnemy: spawn20,
    updateEnemies: upd20, resetEnemies: reset20,
    getEnemyHittables: hittables20, damageEnemy: damage20, partDamage: partDmg20,
  } = await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  const { ENEMY_TYPES: T20 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const { resolveCircleAABBs: resolve20 } =
    await import(pathToFileURL(join('src', 'game', 'movement.js')).href);
  const { CONFIG: CFG20 } = await import(pathToFileURL(join('src', 'config.js')).href);

  // A long flat wall; the player pressed into it by the REAL resolver, so
  // the standoff isn't hand-placed — it's whatever the game would produce.
  const wall20 = { minX: -20, maxX: 20, minZ: 0, maxZ: 0.6 };
  let hits20 = 0;
  init20(new THREE20.Scene(), { onPlayerHit: () => { hits20 += 1; } });
  setCol20([wall20]);
  const pp20 = resolve20(0, -0.05, [wall20], CFG20.PLAYER.BODY_RADIUS);
  const playerPos20 = new THREE20.Vector3(pp20.x, 1.6, pp20.z);

  // Cripple a standing type through the real path. hpMult is a HARNESS, not
  // a nerf: the leg hits that trigger the crawl also cost HP, and a proto
  // would die before its legs gave out. The shot count is DERIVED from the
  // registry (LEG_HP / the leg tier), never guessed.
  const cripple = (typeId) => {
    const t = T20[typeId];
    const shots = Math.ceil(t.CRAWL.LEG_HP / partDmg20(t, 'leg'));
    const leg = hittables20().find((m) => m.userData.part === 'leg');
    for (let i = 0; i < shots; i += 1) damage20(leg);
  };

  for (const id of ['crawler', 'proto_zombie', 'sprinter', 'brute']) {
    reset20();
    hits20 = 0;
    const g = spawn20(id, { x: 0, z: -6 }, { yaw: 0, hpMult: 50 });
    if (!T20[id].SPAWN?.PRONE) cripple(id); // the crawler already spawns down
    // 25 s of 16 ms ticks: generous over the ~6 s approach, so the margin
    // covers the collapse animation and attack cooldowns, not luck.
    for (let ms = 16; ms <= 25000; ms += 16) upd20(16, playerPos20);
    const dist = Math.hypot(pp20.x - g.position.x, pp20.z - g.position.z);
    const stand = T20[id].STOP_DISTANCE;
    // Guard the harness itself: if the cripple silently failed, the body is
    // STANDING at its standing ring and this "crawl test" proves nothing.
    assertTrue('section20',
      `${id}: is actually prone (held ${dist.toFixed(2)} m, not the standing ${stand})`,
      Math.abs(dist - stand) > 0.02);
    assertTrue('section20',
      `${id}: a prone body DAMAGES a wall-backed player (${hits20} hits landed)`,
      hits20 > 0);
  }

  reset20(); // leave no bodies for a later section
} catch (err) {
  failures.push({ file: 'section20', err });
  console.log(`  FAIL   section 20 threw: ${err.message}`);
}

// ————— Section 21: the Exploder (pass 14) —————
//
// Three claims, deliberately kept apart (one probe, one claim):
//   (a) blastDamage IS the two-band model it advertises — inclusive at both
//       boundaries, zero for a type carrying no EXPLODE block;
//   (b) the radius sits in the design window the registry promises: past the
//       claw, inside the beeline. That window IS the pass — break either
//       half and the archetype is a non-event or an unfair one;
//   (c) the tell and the crippled-exploder freebie are REAL, driven through
//       the live update loop rather than asserted from the registry.
//
// (c) is why the damage model lives in enemies.js as a pure export instead
// of at its call site: main.js is DOM-coupled and unreachable from here, so
// a model written there would be certified by nothing.

console.log('');
console.log('— Section 21: the Exploder (pass 14) —');
try {
  const THREE21 = await import(pathToFileURL(join('lib', 'three.module.js')).href);
  const {
    initEnemies: init21, spawnEnemy: spawn21, updateEnemies: upd21,
    resetEnemies: reset21, getEnemyHittables: hittables21,
    damageEnemy: damage21, partDamage: partDmg21, blastDamage: blast21,
    CRAWL_POSE: POSE21,
  } = await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  const { ENEMY_TYPES: T21 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const { WAVES: W21 } =
    await import(pathToFileURL(join('src', 'data', 'waveTable.js')).href);
  const { CONFIG: CFG21 } = await import(pathToFileURL(join('src', 'config.js')).href);

  const X = T21.exploder.EXPLODE;

  // — (a) the band model, exact —
  assertNear('section21', 'blast at the epicentre = CORE_DAMAGE',
    blast21(T21.exploder, 0), X.CORE_DAMAGE);
  assertNear('section21', 'blast AT the core edge = CORE_DAMAGE (inclusive)',
    blast21(T21.exploder, X.CORE_RADIUS), X.CORE_DAMAGE);
  assertNear('section21', 'blast just past the core = DAMAGE',
    blast21(T21.exploder, X.CORE_RADIUS + 1e-6), X.DAMAGE);
  assertNear('section21', 'blast AT the outer edge = DAMAGE (inclusive)',
    blast21(T21.exploder, X.RADIUS), X.DAMAGE);
  assertNear('section21', 'blast past the outer edge = 0',
    blast21(T21.exploder, X.RADIUS + 1e-6), 0);
  // The two guards that make main.js's single call site safe BY CONSTRUCTION
  // rather than by remembering to check.
  assertNear('section21', 'a type with NO EXPLODE block never blasts (proto at 0 m)',
    blast21(T21.proto_zombie, 0), 0);
  assertNear('section21', 'blastDamage survives a missing type (undefined at 0 m)',
    blast21(undefined, 0), 0);
  // A sweep, so a future tune that inverts the bands (rim harder than core)
  // fails here rather than in a play session.
  let mono21 = true;
  let prev21 = Infinity;
  for (let d = 0; d <= X.RADIUS + 0.5; d += 0.01) {
    const v = blast21(T21.exploder, d);
    if (v > prev21 + 1e-9) mono21 = false;
    prev21 = v;
  }
  assertTrue('section21',
    'damage never RISES with distance (0 → RADIUS+0.5 sweep)', mono21);

  // — (b) the design window —
  // The exploder's threat is WHERE you kill it. That only works if BOTH
  // halves hold: inside the claw's range the blast must be unavoidable, and
  // there must always be a range at which killing it is free.
  const gate21 = T21.exploder.STOP_DISTANCE + T21.exploder.ATTACK.RANGE_SLACK;
  assertTrue('section21',
    `blast reaches PAST the claw: RADIUS ${X.RADIUS} > attack gate ${gate21}`,
    X.RADIUS > gate21);
  assertTrue('section21',
    `a safe kill range EXISTS: RADIUS ${X.RADIUS} <= NAV.BEELINE_DIST ${CFG21.NAV.BEELINE_DIST}`,
    X.RADIUS <= CFG21.NAV.BEELINE_DIST);
  assertTrue('section21',
    `the core sits INSIDE the blast: CORE_RADIUS ${X.CORE_RADIUS} < RADIUS ${X.RADIUS}`,
    X.CORE_RADIUS < X.RADIUS);
  assertTrue('section21',
    `the core BITES harder: CORE_DAMAGE ${X.CORE_DAMAGE} >= DAMAGE ${X.DAMAGE}`,
    X.CORE_DAMAGE >= X.DAMAGE);
  // The tell has to actually tick. The §5 schema only proves PULSE_HZ is
  // FINITE, and 0 is finite — a 0 Hz throb passes the schema and ships a
  // decorative constant.
  assertTrue('section21',
    `the tell actually ticks: PULSE_HZ ${X.PULSE_HZ} > 0`,
    X.PULSE_HZ > 0);
  // Survivable by construction: one blast must never erase a full-health
  // player, or the tell is decoration and the lesson never gets taught.
  assertTrue('section21',
    `one blast cannot kill from full: CORE_DAMAGE ${X.CORE_DAMAGE} < PLAYER.MAX_HITS ${CFG21.PLAYER.MAX_HITS}`,
    X.CORE_DAMAGE < CFG21.PLAYER.MAX_HITS);
  // The particle pool is a hard ceiling, and the kill burst spends from it
  // FIRST — spawnBurst degrades by spraying less, so an over-budget blast
  // would silently shrink instead of failing loudly.
  assertTrue('section21',
    `blast fits the pool: PARTICLES ${X.PARTICLES} + KILL_PARTICLES ${CFG21.BLOOD.KILL_PARTICLES} <= MAX_PARTICLES ${CFG21.BLOOD.MAX_PARTICLES}`,
    X.PARTICLES + CFG21.BLOOD.KILL_PARTICLES <= CFG21.BLOOD.MAX_PARTICLES);
  // Reachable through the REAL table (the §19 rule): a registry entry no
  // wave ever spawns is a dead letter that still passes every other pin.
  const debut21 = W21.TABLE.findIndex((r) => (r.types?.exploder ?? 0) > 0);
  assertTrue('section21',
    `exploder is reachable through the real wave table (debuts wave ${debut21 + 1})`,
    debut21 >= 0);
  // EXTEND carries the LAST row forever, so the last row must still carry it
  // — otherwise the archetype appears for exactly one wave and vanishes.
  assertTrue('section21',
    'the LAST table row carries the exploder, so EXTEND keeps it forever',
    (W21.TABLE[W21.TABLE.length - 1].types?.exploder ?? 0) > 0);

  // — (c) the tell and the freebie, driven through the LIVE loop —
  let killed21 = [];
  init21(new THREE21.Scene(), {
    onPlayerHit: () => {},
    onEnemyKilled: (id, pos) => killed21.push({ id, pos }),
  });
  const far21 = new THREE21.Vector3(0, 1.6, 200); // far away: no attacks

  // The live eye COLOUR, found by identity and never by iteration order: the
  // eyes are the only UNLIT material on a body (enemyBody.js builds them
  // MeshBasicMaterial + fog:false so they punch through the murk), and both
  // eyes share the one instance. Returns the Color, not the material — the
  // first cut of this probe returned the material and read `.r` off it,
  // which is undefined, so every comparison went NaN and the "stays on the
  // segment" assert passed on zero real samples (NaN > 1e-6 is false). A
  // probe that cannot fail certifies nothing; isFiniteColour below is the
  // guard that would have caught it.
  const eyeColourOf = (group) => {
    const found = new Set();
    group.traverse((c) => {
      if (c.isMesh && c.material && c.material.isMeshBasicMaterial) found.add(c.material);
    });
    return found.size === 1 ? [...found][0].color : null;
  };
  const isFiniteColour = (c) => !!c
    && Number.isFinite(c.r) && Number.isFinite(c.g) && Number.isFinite(c.b);

  {
    reset21();
    const g = spawn21('exploder', { x: 0, z: -30 }, { yaw: 0 });
    const col = eyeColourOf(g);
    // Guard the probe itself twice over: if a body ever grows a second unlit
    // material this returns null, and if the handle stops being a Color the
    // channels stop being finite. Either way the throb test below would
    // certify nothing, so both are named here rather than assumed.
    assertTrue('section21', 'the exploder exposes exactly ONE unlit eye material',
      col !== null);
    assertTrue('section21', 'the eye handle is a real Color (finite r/g/b)',
      isFiniteColour(col));

    const base = new THREE21.Color(T21.exploder.COLORS.EYES);
    const peak = new THREE21.Color(X.PULSE_COLOR);
    // Parametric position along base→peak, read off the widest-spread
    // channel. Both endpoints are built here exactly as enemies.js builds
    // them, so any colour-management conversion cancels out.
    const span = { r: peak.r - base.r, g: peak.g - base.g, b: peak.b - base.b };
    const axis = ['r', 'g', 'b']
      .reduce((a, c) => (Math.abs(span[c]) > Math.abs(span[a]) ? c : a), 'r');
    const kOf = () => (col[axis] - base[axis]) / span[axis];

    // PULSE_HZ is pinned > 0 above, but the sample budget is clamped anyway:
    // 1000/0 is Infinity, and `ms < Infinity` is a loop that never ends. A
    // suite that HANGS diagnoses nothing at all — strictly worse than one
    // that fails, and it costs a session to work out why. Found by bite-test,
    // which is exactly what bite-tests are for.
    const periodMs = 1000 / X.PULSE_HZ;
    const samples = Math.min(400, Math.ceil(periodMs / 4));
    let kMin = Infinity;
    let kMax = -Infinity;
    let offSegment = 0;
    for (let i = 0; i < samples; i += 1) {
      upd21(4, far21);
      const k = kOf();
      kMin = Math.min(kMin, k);
      kMax = Math.max(kMax, k);
      // ON the segment: predict every channel from k and compare. The axis
      // channel is exact by construction; the others are the real claim.
      // A non-finite sample counts as a stray, so the NaN shape above can
      // never pass this again.
      for (const c of ['r', 'g', 'b']) {
        const err = Math.abs(col[c] - (base[c] + span[c] * k));
        if (!(err <= 1e-6)) offSegment += 1;
      }
    }
    assertTrue('section21',
      `the eyes throb: k spans ${kMin.toFixed(3)} → ${kMax.toFixed(3)} across one ${periodMs.toFixed(0)} ms period`,
      kMin < 0.02 && kMax > 0.98);
    assertTrue('section21',
      `the throb stays ON the base→peak segment (${offSegment} stray samples)`,
      offSegment === 0);
  }

  {
    // The control that stops the throb test being vacuous: a type with no
    // EXPLODE block must NOT tick. Without this, a pulse that fired on every
    // zombie in the game would pass everything above.
    reset21();
    const g = spawn21('proto_zombie', { x: 0, z: -30 }, { yaw: 0 });
    const col = eyeColourOf(g);
    const before = col.getHex();
    for (let ms = 0; ms < 1000; ms += 4) upd21(4, far21);
    assertTrue('section21',
      "a non-exploder's eyes are CONSTANT (the EXPLODE guard holds)",
      col.getHex() === before);
  }

  {
    // The freebie, measured by CONTROL DIFFERENCE rather than asserted. The
    // roadmap claims leg-crippling an exploder yields a ticking crawler with
    // no extra wiring; two runs, identical but for the cripple, say whether
    // that is true of the code or only of the sentence.
    //
    // hpMult 50 is a HARNESS, as in §20: the leg hits that trigger the crawl
    // also cost HP, and an HP-2 exploder would die long before its legs gave
    // out. Shot counts are DERIVED from the registry, never guessed.
    const shots = Math.ceil(T21.exploder.CRAWL.LEG_HP / partDmg21(T21.exploder, 'leg'));
    const killWith = (part) => {
      const m = hittables21().find((h) => h.userData.part === part);
      for (let i = 0; i < 400 && killed21.length === 0; i += 1) damage21(m);
    };

    // Control: a STANDING exploder detonates at standing chest height.
    reset21();
    killed21 = [];
    spawn21('exploder', { x: 0, z: -30 }, { yaw: 0, hpMult: 50 });
    for (let ms = 0; ms < 200; ms += 16) upd21(16, far21);
    killWith('head');
    const standY = killed21[0]?.pos?.y ?? NaN;

    // Treatment: cripple it through the REAL leg path first.
    reset21();
    killed21 = [];
    const g = spawn21('exploder', { x: 0, z: -30 }, { yaw: 0, hpMult: 50 });
    const leg = hittables21().find((m) => m.userData.part === 'leg');
    for (let i = 0; i < shots; i += 1) damage21(leg);
    // Past FALL_MS, so the collapse has finished and the drag has settled.
    for (let ms = 0; ms < T21.exploder.CRAWL.FALL_MS + 400; ms += 16) upd21(16, far21);
    assertNear('section21',
      'a crippled exploder is genuinely PRONE (group pitch = CRAWL_POSE.PITCH)',
      g.rotation.x, POSE21.PITCH);
    // The tell survives the transition — checked BEFORE the kill, because a
    // dying body stops ticking (the pulse lives on the alive path).
    {
      const col = eyeColourOf(g);
      const seen = new Set();
      for (let ms = 0; ms < 1000 / X.PULSE_HZ; ms += 4) {
        upd21(4, far21);
        seen.add(col.getHex());
      }
      assertTrue('section21',
        `a PRONE exploder still ticks (${seen.size} distinct eye colours over one period)`,
        seen.size > 10);
    }
    killWith('head');
    assertTrue('section21',
      `the crippled exploder still detonates AS an exploder (id '${killed21[0]?.id}')`,
      killed21[0]?.id === 'exploder');
    const proneY = killed21[0]?.pos?.y ?? NaN;
    // The pass-12 eruption anchor is what makes this free: the blast rides
    // the LIVE waist, so a legless exploder detonates at the floor instead
    // of at the chest height of a body that isn't standing any more.
    assertTrue('section21',
      `and it detonates at its CORPSE, not standing height (prone ${proneY.toFixed(3)} m << standing ${standY.toFixed(3)} m)`,
      proneY < standY - 0.5);
  }

  reset21(); // leave no bodies for a later section
} catch (err) {
  failures.push({ file: 'section21', err });
  console.log(`  FAIL   section 21 threw: ${err.message}`);
}

// ————— Section 22: the Spitter (pass 15) —————
//
// Three claims:
//   (a) the arc math puts the glob WHERE IT AIMED — integrated through the
//       same Euler step the game runs, not the closed form it doesn't;
//   (b) the design window: it never closes, it isn't invisible, its own
//       safety cap can't eat its shot, and a MOVING player cannot be hit —
//       that last one IS the archetype, written as a number;
//   (c) the hook fires for RANGED types and only RANGED types, and legging
//       one genuinely disarms it.

console.log('');
console.log('— Section 22: the Spitter (pass 15) —');
try {
  const THREE22 = await import(pathToFileURL(join('lib', 'three.module.js')).href);
  const {
    arcVelocity, flightMsFor, initProjectiles: initP22,
    spawnGlob: glob22, updateProjectiles: updP22, resetProjectiles: resetP22,
  } = await import(pathToFileURL(join('src', 'render', 'projectiles.js')).href);
  const {
    initEnemies: init22, spawnEnemy: spawn22, updateEnemies: upd22,
    resetEnemies: reset22, getEnemyHittables: hit22,
    damageEnemy: dmg22, partDamage: part22, setMapColliders: setCol22,
  } = await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);

  // Section 20 sets a wall collider and never clears it — and mapColliders
  // is MODULE state, so every later section inherits it. §20's wall spans
  // z ∈ [0, 0.6], which is exactly where this section's player stands, so
  // every attack here whiffed on a silently-failed LOS check: the spitter
  // fired nothing AND the shambler control clawed nothing, which is what
  // gave the leak away — untouched code doesn't break for a new enemy.
  // A section that spawns enemies has to own its own world.
  setCol22([]);
  const { ENEMY_TYPES: T22 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const { WAVES: W22 } =
    await import(pathToFileURL(join('src', 'data', 'waveTable.js')).href);
  const { typeAssignments: assign22, waveSpec: spec22 } =
    await import(pathToFileURL(join('src', 'game', 'waves.js')).href);
  const { CONFIG: C22 } = await import(pathToFileURL(join('src', 'config.js')).href);

  const S = T22.spitter;
  const R = S.RANGED;

  // — (a) the arc math —
  // Integrate the launch velocity through the SAME semi-implicit Euler step
  // updateProjectiles runs. Pinning the closed form would certify physics
  // the game never executes: Euler on a constant acceleration accumulates a
  // known offset, and the honest pin is that the offset stays inside its
  // derived bound rather than that it doesn't exist.
  const integrate = (from, to, flightMs, gravity, dtMs) => {
    const v = arcVelocity(from, to, flightMs, gravity);
    const p = { x: from.x, y: from.y, z: from.z };
    let vy = v.vy;
    const dt = dtMs / 1000;
    const n = Math.round(flightMs / dtMs);
    for (let i = 0; i < n; i += 1) {
      vy -= gravity * dt;
      p.x += v.vx * dt; p.y += vy * dt; p.z += v.vz * dt;
    }
    return p;
  };
  const from22 = { x: 0, y: 1.5, z: -S.STOP_DISTANCE };
  const to22 = { x: 0, y: 1.7, z: 0 };
  const fm22 = flightMsFor(from22, to22, R.GLOB_SPEED);
  const land = integrate(from22, to22, fm22, R.GRAVITY, 16);
  // XZ carries no acceleration, so Euler is exact there — but the FLIGHT
  // truncates to a whole number of ticks, so the glob stops up to one
  // tick's travel short of its aim. The first cut of this pin demanded
  // exactness and failed by 4 cm: a 1125 ms flight is 70.3 ticks of 16 ms,
  // and the missing 0.3 of a tick at 8 m/s IS 4 cm. The probe was wrong,
  // not the arc — so the pin is now the bound that actually holds.
  const errXZ = Math.hypot(land.x - to22.x, land.z - to22.z);
  const tickTravel = R.GLOB_SPEED * 0.016;
  assertTrue('section22',
    `XZ lands within one tick's travel (${errXZ.toFixed(3)} m, one tick = ${tickTravel.toFixed(3)} m)`,
    errXZ <= tickTravel);
  // Y drifts by semi-implicit Euler's ½·g·T·dt. That drop is REAL — the
  // glob lands slightly LOW, which the floor-to-camera hit cylinder
  // absorbs. Pinned to the derived bound so a future dt or gravity change
  // can't quietly widen it into a miss.
  const bound = 0.5 * R.GRAVITY * (fm22 / 1000) * 0.016;
  const errY = Math.abs(land.y - to22.y);
  assertTrue('section22',
    `the glob arrives in Y within Euler's own drift (${errY.toFixed(3)} m, bound ${bound.toFixed(3)})`,
    errY <= bound + 1e-9);
  // And the claim the GAME cares about, which neither of the above is on
  // its own: the accumulated miss has to stay inside what the hit cylinder
  // can absorb, or a dead-on shot at a standing player sails past them.
  const err3 = Math.hypot(land.x - to22.x, land.y - to22.y, land.z - to22.z);
  const hitR22 = R.GLOB_RADIUS + C22.PLAYER.BODY_RADIUS;
  assertTrue('section22',
    `a dead-on shot lands INSIDE the hit cylinder (${err3.toFixed(3)} m vs a ${hitR22.toFixed(2)} m radius)`,
    err3 < hitR22);

  // Both /0 guards: a zero flight time and a zero speed must degrade, not
  // fling a glob to Infinity.
  assertNear('section22', 'arcVelocity survives a zero flight time (no /0)',
    arcVelocity({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, 0, 9).vx, 0);
  assertNear('section22', 'flightMsFor survives a zero glob speed (no /0)',
    flightMsFor({ x: 0, z: 0 }, { x: 5, z: 0 }, 0), 0);

  // — (b) the design window —
  assertTrue('section22',
    `it never beelines: STOP_DISTANCE ${S.STOP_DISTANCE} > NAV.BEELINE_DIST ${C22.NAV.BEELINE_DIST}`,
    S.STOP_DISTANCE > C22.NAV.BEELINE_DIST);
  const meleeStops = Object.values(T22).filter((t) => !t.RANGED).map((t) => t.STOP_DISTANCE);
  assertTrue('section22',
    `it outranges every melee type (max melee stop ${Math.max(...meleeStops)})`,
    S.STOP_DISTANCE > Math.max(...meleeStops));
  // NOT an invisible attacker: parked past the fog's FAR plane it becomes a
  // thing that shells you from a grey wall you can't shoot back at.
  assertTrue('section22',
    `visible at its post: STOP_DISTANCE ${S.STOP_DISTANCE} < FOG.WAVES.FAR ${C22.FOG.WAVES.FAR}`,
    S.STOP_DISTANCE < C22.FOG.WAVES.FAR);
  // Its own safety cap must not retire the glob MID-FLIGHT.
  const flightAtPost = (S.STOP_DISTANCE / R.GLOB_SPEED) * 1000;
  assertTrue('section22',
    `LIFE_MS ${R.LIFE_MS} outlasts the flight from its post (${flightAtPost.toFixed(0)} ms)`,
    R.LIFE_MS > flightAtPost);
  // The archetype as a number: a player who MOVES cannot be hit.
  const dodge = C22.PLAYER.MOVE_SPEED * (flightAtPost / 1000);
  const hitR = R.GLOB_RADIUS + C22.PLAYER.BODY_RADIUS;
  assertTrue('section22',
    `a moving player clears the glob: ${dodge.toFixed(2)} m travelled vs a ${hitR.toFixed(2)} m hit radius`,
    dodge > hitR * 3);
  assertTrue('section22', `the glob pool is non-empty (MAX ${C22.PROJECTILES.MAX})`,
    C22.PROJECTILES.MAX > 0);
  const debut = W22.TABLE.findIndex((r) => (r.types?.spitter ?? 0) > 0);
  assertTrue('section22',
    `spitter is reachable through the real wave table (debuts wave ${debut + 1})`,
    debut >= 0);
  assertTrue('section22',
    'the LAST table row carries the spitter, so EXTEND keeps it forever',
    (W22.TABLE[W22.TABLE.length - 1].types?.spitter ?? 0) > 0);
  // The share must actually SURVIVE largest-remainder rounding. A share
  // under 1/count floors to zero and the debut silently never happens —
  // every other pin here would still be green.
  {
    const sp = spec22(debut + 1);
    const got = assign22(sp.count, sp.types, () => 0.5).filter((x) => x === 'spitter').length;
    assertTrue('section22',
      `the debut share PRODUCES a spitter through the real rounding (${got} at wave ${debut + 1})`,
      got >= 1);
  }

  // — (c) the hit, the dodge, the hook, the disarm —
  let hits22 = 0;
  initP22(new THREE22.Scene(), { onPlayerHit: () => { hits22 += 1; } });
  const post = { x: 0, y: 1.5, z: -S.STOP_DISTANCE };
  {
    resetP22();
    hits22 = 0;
    const player = new THREE22.Vector3(0, 1.7, 0);
    glob22(S, post, { x: player.x, y: player.y, z: player.z });
    for (let ms = 0; ms < R.LIFE_MS; ms += 16) updP22(16, player);
    assertTrue('section22', `a STATIONARY player is hit (${hits22})`, hits22 === 1);
  }
  {
    // The control difference that IS the design: same shot, same ticks, the
    // only change is that the player moved one stride.
    resetP22();
    hits22 = 0;
    glob22(S, post, { x: 0, y: 1.7, z: 0 });
    const moved = new THREE22.Vector3(3, 1.7, 0);
    for (let ms = 0; ms < R.LIFE_MS; ms += 16) updP22(16, moved);
    assertTrue('section22', `a player who STEPPED ASIDE is not hit (${hits22})`, hits22 === 0);
  }
  {
    resetP22();
    hits22 = 0;
    glob22(T22.proto_zombie, post, { x: 0, y: 1.7, z: 0 });
    assertTrue('section22', 'a type with NO RANGED block cannot throw a glob',
      glob22(T22.proto_zombie, post, { x: 0, y: 1.7, z: 0 }) === null);
  }

  const playerV = new THREE22.Vector3(0, 1.7, 0);
  let fired = [];
  let clawed = 0;
  init22(new THREE22.Scene(), {
    onPlayerHit: () => { clawed += 1; },
    onRangedAttack: (id) => fired.push(id),
  });
  {
    reset22();
    fired = [];
    spawn22('spitter', { x: 0, z: -S.STOP_DISTANCE }, { yaw: 0 });
    for (let ms = 0; ms < 4000; ms += 16) upd22(16, playerV);
    assertTrue('section22', `a spitter at its post FIRES (${fired.length} globs in 4 s)`,
      fired.length > 0 && fired.every((id) => id === 'spitter'));
  }
  {
    // Control: the hook must not leak onto a clawing type.
    reset22();
    fired = [];
    clawed = 0;
    spawn22('proto_zombie', { x: 0, z: -1.5 }, { yaw: 0 });
    for (let ms = 0; ms < 4000; ms += 16) upd22(16, playerV);
    assertTrue('section22', `a SHAMBLER never fires the ranged hook (${fired.length} globs)`,
      fired.length === 0);
    assertTrue('section22', `...and still claws normally (${clawed} hits — the harness works)`,
      clawed > 0);
  }
  {
    // The disarm, by control difference: same body, same post, same ticks —
    // the ONLY change is leg damage. If legging it doesn't take the
    // artillery away, this is the pin that says so.
    reset22();
    fired = [];
    clawed = 0;
    spawn22('spitter', { x: 0, z: -3 }, { yaw: 0, hpMult: 50 });
    const shots = Math.ceil(S.CRAWL.LEG_HP / part22(S, 'leg'));
    const leg = hit22().find((m) => m.userData.part === 'leg');
    for (let i = 0; i < shots; i += 1) dmg22(leg);
    for (let ms = 0; ms < 25000; ms += 16) upd22(16, playerV);
    assertTrue('section22', `a LEGGED spitter never spits again (${fired.length} globs)`,
      fired.length === 0);
    assertTrue('section22',
      `...but it drags into claw range and still bites (${clawed} hits — proves it wasn't just inert)`,
      clawed > 0);
  }

  reset22();
  resetP22();
} catch (err) {
  failures.push({ file: 'section22', err });
  console.log(`  FAIL   section 22 threw: ${err.message}`);
}

// ————— Section 23: the blast FX (pass 14c) —————
//
// This section exists because most of 14c is render-path and therefore
// invisible to a headless suite — which is exactly the condition under which
// a pass ships a lie. What CAN be certified here is the only claim that
// matters: the picture agrees with the damage.
//
// Three claims:
//   (a) the curves land where they say — the ring's outer edge arrives on the
//       radius EXACTLY and then HOLDS, both opacities fall to exactly 0, and
//       neither divides by zero;
//   (b) the picture IS the model — the ring's rendered radius is measured
//       against blastDamage() itself rather than against a shared constant,
//       so a duplicated 3.5 that drifted out of agreement fails HERE;
//   (c) the guards hold — a type with no EXPLODE block draws nothing, and a
//       blast never leaks a pool slot.
//
// (b) is driven through the LIVE pool and read off the rendered geometry
// (mesh.scale), not off the pure function that should produce it: a probe
// that checks the maths while the mesh does something else certifies nothing.

console.log('');
console.log('— Section 23: the blast FX (pass 14c) —');
try {
  const THREE23 = await import(pathToFileURL(join('lib', 'three.module.js')).href);
  const {
    ringRadius, ringOpacity, flashOpacity, blastLifeMs,
    initBlastFX: init23, spawnBlast: blast23,
    updateBlastFX: upd23, resetBlastFX: reset23,
  } = await import(pathToFileURL(join('src', 'render', 'blastFX.js')).href);
  const { blastDamage: dmg23 } =
    await import(pathToFileURL(join('src', 'render', 'enemies.js')).href);
  const { ENEMY_TYPES: T23 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);
  const { CONFIG: CFG23 } = await import(pathToFileURL(join('src', 'config.js')).href);

  const BL = CFG23.BLAST;
  const X23 = T23.exploder.EXPLODE;

  // — (a) the curves —
  // Bit-exact, not near-enough: === rather than assertNear, because "lands on
  // the radius EXACTLY" is the claim the ease-out-quad was chosen for. A
  // tolerance here would pass the sine curve this deliberately isn't.
  assertTrue('section23',
    `the ring starts at nothing: ringRadius(0) = ${ringRadius(0, BL.RING_GROW_MS, X23.RADIUS)}`,
    ringRadius(0, BL.RING_GROW_MS, X23.RADIUS) === 0);
  assertTrue('section23',
    `the ring lands on the radius EXACTLY at RING_GROW_MS (${ringRadius(BL.RING_GROW_MS, BL.RING_GROW_MS, X23.RADIUS)} === ${X23.RADIUS})`,
    ringRadius(BL.RING_GROW_MS, BL.RING_GROW_MS, X23.RADIUS) === X23.RADIUS);
  // The HOLD. Without it the exact arrival would be unreachable in a browser:
  // frames land where they land, and a 16.7 ms step jumps 296 → 312 without
  // ever sampling 300. The clamp is what makes the arrival frame-rate-
  // independent rather than a lucky sample.
  assertTrue('section23',
    'the ring HOLDS at full extent past RING_GROW_MS (the teaching frame is the one that rests)',
    ringRadius(BL.RING_GROW_MS * 2, BL.RING_GROW_MS, X23.RADIUS) === X23.RADIUS
    && ringRadius(BL.RING_GROW_MS + 1e-6, BL.RING_GROW_MS, X23.RADIUS) === X23.RADIUS);
  // Fixed loop bound — deliberately NOT derived from the value under test,
  // which is how a bite that feeds a probe zero turns into a suite hang
  // (LESSONS 2026-07-15).
  let mono23 = true;
  let prevR23 = -Infinity;
  for (let ms = 0; ms <= 600; ms += 2) {
    const r = ringRadius(ms, BL.RING_GROW_MS, X23.RADIUS);
    if (r < prevR23 - 1e-9) mono23 = false;
    prevR23 = r;
  }
  assertTrue('section23',
    'the ring never SHRINKS across a 0 → 600 ms sweep', mono23);
  // "Full bright WHILE growing" has to be sampled while it is growing. The
  // first version of this pin only checked t === RING_GROW_MS — the one
  // instant the growth branch doesn't own (t < growMs is false at 300) — so a
  // ring that faded the entire way down to the radius passed it. Caught by
  // 14c's bite harness. Sweep the interval the claim is actually about.
  let solid23 = true;
  for (let ms = 0; ms < BL.RING_GROW_MS; ms += 5) {
    if (ringOpacity(ms, BL.RING_GROW_MS, BL.RING_FADE_MS) !== 1) solid23 = false;
  }
  assertTrue('section23',
    'the ring is FULL BRIGHT for the WHOLE expansion (it fades from rest, not while growing)',
    solid23);
  assertTrue('section23',
    'and it is still full bright at the instant it lands',
    ringOpacity(BL.RING_GROW_MS, BL.RING_GROW_MS, BL.RING_FADE_MS) === 1);
  assertTrue('section23',
    'the ring reaches exactly 0 opacity at GROW + FADE',
    ringOpacity(BL.RING_GROW_MS + BL.RING_FADE_MS, BL.RING_GROW_MS, BL.RING_FADE_MS) === 0);
  assertTrue('section23',
    `the flash starts full and ends at exactly 0 (${flashOpacity(0, BL.FLASH_LIFE_MS)} → ${flashOpacity(BL.FLASH_LIFE_MS, BL.FLASH_LIFE_MS)})`,
    flashOpacity(0, BL.FLASH_LIFE_MS) === 1
    && flashOpacity(BL.FLASH_LIFE_MS, BL.FLASH_LIFE_MS) === 0);
  let monoF23 = true;
  let prevF23 = Infinity;
  for (let ms = 0; ms <= 300; ms += 2) {
    const o = flashOpacity(ms, BL.FLASH_LIFE_MS);
    if (o > prevF23 + 1e-9) monoF23 = false;
    prevF23 = o;
  }
  assertTrue('section23', 'the flash never brightens once lit (0 → 300 ms sweep)', monoF23);
  // The /0 guards. Number.isFinite, never assertNear — NaN slips through a
  // tolerance comparison silently (LESSONS 2026-07-15), which is the exact
  // shape of the NaN-light bug that started section 5.
  assertTrue('section23',
    'ringRadius survives a zero growth time (no NaN into mesh.scale)',
    Number.isFinite(ringRadius(0, 0, X23.RADIUS)));
  // The sample matters more than the assert. t = growMs + 1 with fadeMs = 0
  // divides to Infinity, and Infinity >= 1 is TRUE, so the fade branch
  // returns a clean 0 and an unguarded function passes. The NaN only appears
  // at t === growMs exactly, where the division is 0/0 — and NaN >= 1 is
  // false, so it falls through to `1 - NaN`. Bite-caught; pin both.
  assertTrue('section23',
    'ringOpacity survives a zero fade time AT the boundary (0/0, the sample that actually NaNs)',
    Number.isFinite(ringOpacity(BL.RING_GROW_MS, BL.RING_GROW_MS, 0)));
  assertTrue('section23',
    'ringOpacity survives a zero fade time past the boundary (x/0)',
    Number.isFinite(ringOpacity(BL.RING_GROW_MS + 1, BL.RING_GROW_MS, 0)));
  assertTrue('section23',
    'flashOpacity survives a zero flash time',
    Number.isFinite(flashOpacity(0, 0)));
  assertTrue('section23',
    'the ring outlives the flash, so blastLifeMs is the ring clock',
    blastLifeMs(BL.FLASH_LIFE_MS, BL.RING_GROW_MS, BL.RING_FADE_MS)
      === BL.RING_GROW_MS + BL.RING_FADE_MS);

  // — the shape config has to hold for the picture to BE a picture —
  assertTrue('section23',
    `the flash is a POP inside the ring's sweep: FLASH_LIFE_MS ${BL.FLASH_LIFE_MS} < RING_GROW_MS ${BL.RING_GROW_MS}`,
    BL.FLASH_LIFE_MS < BL.RING_GROW_MS);
  assertTrue('section23',
    `the ring is an ANNULUS: 0 < RING_THICKNESS ${BL.RING_THICKNESS} < 1 (1 would be a filled disc, 0 invisible)`,
    BL.RING_THICKNESS > 0 && BL.RING_THICKNESS < 1);
  assertTrue('section23',
    `the ring clears the blood pools it lands among: RING_Y ${BL.RING_Y} > 0.02`,
    BL.RING_Y > 0.02);
  assertTrue('section23',
    `the ring is round: RING_SEGMENTS ${BL.RING_SEGMENTS} >= 3`, BL.RING_SEGMENTS >= 3);
  assertTrue('section23', `the blast pool is non-empty (MAX ${BL.MAX})`, BL.MAX > 0);
  assertTrue('section23',
    `a blast THROWS harder than a bullet spatters: BURST_SPEED ${BL.BURST_SPEED} > BLOOD.PARTICLE_SPEED ${CFG23.BLOOD.PARTICLE_SPEED}`,
    BL.BURST_SPEED > CFG23.BLOOD.PARTICLE_SPEED);

  // — (b) the picture IS the model, driven through the live pool —
  init23(new THREE23.Scene());
  {
    reset23();
    const b = blast23({ x: 0, y: 1.163, z: -30 }, X23);
    assertTrue('section23', 'a blast with a real EXPLODE block takes a pool slot', !!b);

    // Ragged 16.67 ms frames — the browser's steps, not a divisor of
    // RING_GROW_MS. If the exact arrival depended on landing a sample on 300
    // it would fail here, which is the whole point of testing it this way.
    let landed = -1;
    for (let f = 0; f < 24; f += 1) {
      upd23(16.67);
      if (b.ring.scale.x === X23.RADIUS && landed < 0) landed = f;
    }
    assertTrue('section23',
      `the RENDERED ring reaches exactly EXPLODE.RADIUS on ragged frames (frame ${landed})`,
      landed >= 0);

    // THE pin of the pass. The ring's rendered edge is measured against
    // blastDamage() itself: everything the ring encloses bites, and a
    // hair outside it does not. A hand-copied radius that drifted from the
    // registry fails right here rather than in a play session.
    const edge = X23.RADIUS;
    assertTrue('section23',
      'everything the ring encloses BITES (blastDamage at the drawn edge > 0)',
      dmg23(T23.exploder, edge) > 0);
    assertTrue('section23',
      'and a hair outside the drawn edge is SAFE (the ring is the boundary, not a suggestion)',
      dmg23(T23.exploder, edge + 1e-6) === 0);
  }
  {
    // The control that stops the arrival test being vacuous: half way through
    // the growth the ring must be visibly SHORT of the radius. Without this a
    // ring that snapped to full size on frame one would pass everything above.
    reset23();
    const b = blast23({ x: 0, y: 1.163, z: -30 }, X23);
    upd23(BL.RING_GROW_MS / 2);
    assertTrue('section23',
      `the ring is still SHORT at half time (${b.ring.scale.x.toFixed(3)} < ${X23.RADIUS})`,
      b.ring.scale.x < X23.RADIUS);
    assertTrue('section23',
      'the ring is drawn in the registry\'s FX_COLOR, not a constant of its own',
      b.ring.material.color.getHex() === X23.FX_COLOR);
    assertTrue('section23',
      `the flash tracks the CORE band: scale ${b.flash.scale.x} === CORE_RADIUS ${X23.CORE_RADIUS} × MULT ${BL.FLASH_RADIUS_MULT}`,
      b.flash.scale.x === X23.CORE_RADIUS * BL.FLASH_RADIUS_MULT);
  }
  {
    // — (c) the guards —
    reset23();
    assertTrue('section23',
      'a type with NO EXPLODE block draws nothing (proto)',
      blast23({ x: 0, y: 1, z: 0 }, T23.proto_zombie.EXPLODE) === null);
    assertTrue('section23',
      'spawnBlast survives a missing block entirely (undefined)',
      blast23({ x: 0, y: 1, z: 0 }, undefined) === null);
  }
  {
    // No leaked slots: a finished blast must hide itself and free its seat, or
    // MAX blasts into a round the effect silently stops appearing.
    reset23();
    const b = blast23({ x: 0, y: 1.163, z: -30 }, X23);
    const life = blastLifeMs(BL.FLASH_LIFE_MS, BL.RING_GROW_MS, BL.RING_FADE_MS);
    for (let ms = 0; ms <= life + 32; ms += 16) upd23(16);
    assertTrue('section23',
      'a spent blast retires: both meshes hidden, slot freed',
      b.active === false && b.ring.visible === false && b.flash.visible === false);
    // And the flash is gone long before that — it must not sit at opacity 0
    // still drawing for the ring's whole life.
    reset23();
    const b2 = blast23({ x: 0, y: 1.163, z: -30 }, X23);
    upd23(BL.FLASH_LIFE_MS + 1);
    assertTrue('section23',
      'the flash hides itself the instant it is spent, while the ring plays on',
      b2.flash.visible === false && b2.ring.visible === true);
  }
  {
    reset23();
    const b = blast23({ x: 0, y: 1.163, z: -30 }, X23);
    upd23(16);
    reset23();
    assertTrue('section23',
      'resetBlastFX clears a blast mid-expansion (it belongs to the round that made it)',
      b.active === false && b.ring.visible === false);
  }

  reset23();
} catch (err) {
  failures.push({ file: 'section23', err });
  console.log(`  FAIL   section 23 threw: ${err.message}`);
}

// ————— Section 24: weapons (pass 17) —————
//
// Three claims:
//   (a) the registry landed WITHOUT retuning the gun you already know — the
//       pistol's ray is bit-identical to the pre-17 path, and every number
//       that moved off config.js arrived intact;
//   (b) the spread is real maths, not a vibe: the disc is uniform by AREA,
//       it lands exactly on the rim at the edge, and it is exactly nothing
//       at zero — that last one IS (a)'s guarantee;
//   (c) one trigger pull is ONE shot however many pellets it puts in the
//       air. That is the claim the old onHit-per-ray shape got wrong for
//       free, and it is pinned by driving fireShot at a real mesh with a
//       real camera rather than by reading the loop and nodding.
//
// What is NOT here: the per-shot bookkeeping (one kick, one casing, one
// round) lives in main.js and is unreachable from Node. It is safe by
// STRUCTURE instead — shooting.js calls onShot exactly once per pull, so
// there is no loop up there to get wrong. That is the point of the split.

console.log('');
console.log('— Section 24: weapons (pass 17) —');
try {
  const THREE24 = await import(pathToFileURL(join('lib', 'three.module.js')).href);
  const { WEAPON_TYPES: W, WEAPON_ORDER: ORDER } =
    await import(pathToFileURL(join('src', 'data', 'weaponTypes.js')).href);
  const { spreadOffset, degToRad, fireShot } =
    await import(pathToFileURL(join('src', 'game', 'shooting.js')).href);
  const { createGuns, setActiveGun, getActiveGunId } =
    await import(pathToFileURL(join('src', 'render', 'gun.js')).href);
  const { CONFIG: CFG24 } = await import(pathToFileURL(join('src', 'config.js')).href);
  const { ENEMY_TYPES: ET24 } =
    await import(pathToFileURL(join('src', 'data', 'enemyTypes.js')).href);

  // — (a) the registry contract —
  // The sweep in §5 proves every field that EXISTS is finite. This names the
  // fields that MUST exist — a missing one NaNs exactly like a missing config
  // key did on 2026-07-11. Extend this list when weapons gain required fields.
  const REQUIRED = [
    'NAME', 'MAG_SIZE', 'RELOAD_MS', 'LOW_AT', 'COOLDOWN_MS',
    'PELLETS', 'SPREAD_DEG', 'RECOIL_MS', 'RECOIL_DEG', 'RECOIL_BACK',
    'COLOR', 'ROUGH', 'METAL', 'PARTS', 'MUZZLE',
  ];
  let missing24 = [];
  for (const id of ORDER) {
    if (!W[id]) { missing24.push(`${id} (not in WEAPON_TYPES at all)`); continue; }
    for (const f of REQUIRED) if (W[id][f] === undefined) missing24.push(`${id}.${f}`);
  }
  assertTrue('section24',
    `every weapon in WEAPON_ORDER is complete${missing24.length ? ' — MISSING: ' + missing24.join(', ') : ''}`,
    missing24.length === 0);
  assertTrue('section24',
    `WEAPON_ORDER is the whole roster (${ORDER.length} ordered / ${Object.keys(W).length} defined)`,
    ORDER.length === Object.keys(W).length);
  // A weapon whose id disagrees with its key is how a swap silently targets
  // the wrong gun — setActiveWeapon keys off the id, gun.js keys off the map.
  assertTrue('section24', 'every entry\'s id matches its registry key',
    Object.entries(W).every(([k, w]) => w.id === k));

  // Shapes, not just presence: PARTS drives BoxGeometry directly, and a
  // two-element size builds a gun out of NaN without three.js complaining.
  let shapeBad = [];
  for (const id of ORDER) {
    const w = W[id];
    if (!Array.isArray(w.PARTS) || w.PARTS.length === 0) shapeBad.push(`${id}.PARTS empty`);
    if (!Array.isArray(w.MUZZLE) || w.MUZZLE.length !== 3) shapeBad.push(`${id}.MUZZLE`);
    for (const [i, p] of (w.PARTS ?? []).entries()) {
      if (!Array.isArray(p.size) || p.size.length !== 3) shapeBad.push(`${id}.PARTS[${i}].size`);
      if (!Array.isArray(p.pos) || p.pos.length !== 3) shapeBad.push(`${id}.PARTS[${i}].pos`);
      if (p.rot && p.rot.length !== 3) shapeBad.push(`${id}.PARTS[${i}].rot`);
    }
  }
  assertTrue('section24',
    `every PARTS entry is a real box${shapeBad.length ? ' — BAD: ' + shapeBad.join(', ') : ''}`,
    shapeBad.length === 0);

  // — the design window —
  const P24 = W.pistol;
  const S24 = W.shotgun;
  assertTrue('section24',
    'the pistol is the BASELINE: one pellet, no spread (this is what makes its ray bit-identical to pre-17)',
    P24.PELLETS === 1 && P24.SPREAD_DEG === 0);
  assertTrue('section24',
    `the shotgun pays for its pellets with RATE: COOLDOWN ${S24.COOLDOWN_MS} > pistol ${P24.COOLDOWN_MS}`,
    S24.COOLDOWN_MS > P24.COOLDOWN_MS);
  assertTrue('section24',
    `...and with CAPACITY: MAG ${S24.MAG_SIZE} < pistol ${P24.MAG_SIZE}`,
    S24.MAG_SIZE < P24.MAG_SIZE);
  assertTrue('section24',
    `...and with RELOAD: ${S24.RELOAD_MS} ms > pistol ${P24.RELOAD_MS} ms`,
    S24.RELOAD_MS > P24.RELOAD_MS);
  assertTrue('section24',
    `the shotgun actually scatters: PELLETS ${S24.PELLETS} > 1 and SPREAD ${S24.SPREAD_DEG} > 0`,
    S24.PELLETS > 1 && S24.SPREAD_DEG > 0);
  // Guards that make every weapon safe BY CONSTRUCTION rather than by being
  // tuned carefully. A 0 cooldown is a machine gun on a mouse button; a 0
  // reload divides by zero in reloadProgress; a LOW_AT at or above the mag
  // is a warning light that is always on and therefore says nothing.
  for (const id of ORDER) {
    const w = W[id];
    assertTrue('section24', `${id}: COOLDOWN_MS ${w.COOLDOWN_MS} > 0`, w.COOLDOWN_MS > 0);
    assertTrue('section24', `${id}: RELOAD_MS ${w.RELOAD_MS} > 0 (reloadProgress divides by it)`, w.RELOAD_MS > 0);
    assertTrue('section24', `${id}: MAG_SIZE ${w.MAG_SIZE} > 0`, w.MAG_SIZE > 0);
    assertTrue('section24', `${id}: PELLETS ${w.PELLETS} >= 1`, w.PELLETS >= 1);
    assertTrue('section24',
      `${id}: the low-ammo warning can be BOTH on and off (0 < LOW_AT ${w.LOW_AT} < MAG ${w.MAG_SIZE})`,
      w.LOW_AT > 0 && w.LOW_AT < w.MAG_SIZE);
  }

  // — (b) the spread maths —
  // THE guarantee of the pass: at zero spread the offset is EXACTLY zero, so
  // the pistol takes the unperturbed ray. === not assertNear: 1e-17 is not
  // zero, and 'the registry did not retune your gun' has to be exact.
  {
    let allZero = true;
    for (let i = 0; i <= 20; i++) {
      const o = spreadOffset(0, i / 20, (20 - i) / 20);
      if (o.x !== 0 || o.y !== 0) allZero = false;
    }
    assertTrue('section24',
      'spreadOffset at ZERO spread is EXACTLY {0,0} across the whole random range',
      allZero);
  }
  const sRad = degToRad(S24.SPREAD_DEG);
  const rim = Math.tan(sRad);
  assertNear('section24', 'the rim sample lands exactly on tan(spread)',
    Math.hypot(spreadOffset(sRad, 0, 1).x, spreadOffset(sRad, 0, 1).y), rim);
  assertNear('section24', 'the centre sample is dead centre',
    Math.hypot(spreadOffset(sRad, 0.37, 0).x, spreadOffset(sRad, 0.37, 0).y), 0);
  // sqrt(u2), not u2. Linear radius sampling bunches pellets at the middle of
  // the disc and leaves the rim bare — which reads as a slug, not a scatter.
  // At u2 = 0.25 the sqrt puts the pellet at HALF the rim; linear would put
  // it at a quarter. That single number is the whole difference.
  assertNear('section24', 'the radius is sqrt-sampled (uniform by AREA, not by radius)',
    Math.hypot(spreadOffset(sRad, 0, 0.25).x, spreadOffset(sRad, 0, 0.25).y), rim * 0.5);
  {
    let inside = true;
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 40; j++) {
        const o = spreadOffset(sRad, i / 40, j / 40);
        if (Math.hypot(o.x, o.y) > rim + 1e-9) inside = false;
      }
    }
    assertTrue('section24', 'no pellet ever leaves the cone (41x41 sweep)', inside);
  }
  assertTrue('section24', 'spreadOffset survives a negative/NaN spread',
    Number.isFinite(spreadOffset(-1, 0.5, 0.5).x)
    && Number.isFinite(spreadOffset(NaN, 0.5, 0.5).x));

  // — (c) one pull, N pellets: driven for real —
  {
    const cam = new THREE24.PerspectiveCamera(75, 16 / 9, 0.1, 100);
    cam.position.set(0, 0, 0);
    cam.lookAt(0, 0, -1);
    cam.updateMatrixWorld(true);

    // A wall 2 m downrange, wide enough that the whole 4.5-degree cone lands
    // on it (tan(4.5) * 2 = 0.157 m — 4 m of plane is enormous headroom).
    const wall = new THREE24.Mesh(
      new THREE24.PlaneGeometry(4, 4),
      new THREE24.MeshBasicMaterial(),
    );
    wall.position.set(0, 0, -2);
    wall.updateMatrixWorld(true);

    const pistolHits = fireShot(cam, P24, [wall]);
    assertNear('section24', 'ONE pull of a 1-pellet weapon returns exactly 1 pellet result',
      pistolHits.length, 1);

    const shotHits = fireShot(cam, S24, [wall]);
    assertNear('section24',
      `ONE pull of the shotgun returns ${S24.PELLETS} pellet results — from ONE call`,
      shotHits.length, S24.PELLETS);

    // The pin that matters: the pellets went to DIFFERENT places. A spread
    // that silently collapsed would return 8 identical points and every count
    // assert above would still pass.
    let maxSep = 0;
    for (const a of shotHits) {
      for (const b of shotHits) maxSep = Math.max(maxSep, a.point.distanceTo(b.point));
    }
    assertTrue('section24',
      `the pellets actually SCATTER (widest pair ${maxSep.toFixed(3)} m apart at 2 m)`,
      maxSep > 0.01);
    assertTrue('section24',
      `...and the scatter respects the cone (${maxSep.toFixed(3)} m <= 2 x tan(spread) x 2 m = ${(2 * rim * 2).toFixed(3)} m)`,
      maxSep <= 2 * rim * 2 + 1e-6);

    // The control: the pistol does NOT scatter. Without this, a spread that
    // leaked onto every weapon would pass everything above.
    let pistolCentred = true;
    for (let i = 0; i < 12; i++) {
      const h = fireShot(cam, P24, [wall]);
      if (h.length !== 1 || Math.hypot(h[0].point.x, h[0].point.y) > 1e-9) pistolCentred = false;
    }
    assertTrue('section24',
      'the pistol puts every shot DEAD CENTRE across 12 pulls (the zero-spread path is untouched)',
      pistolCentred);

    // A pattern that finds nothing returns EMPTY — that empty array IS the
    // miss, and main.js reads it as one.
    assertNear('section24', 'a shot that hits nothing returns an empty array, not null',
      fireShot(cam, S24, []).length, 0);

    // — MAX_RANGE: the shotgun's leash —
    // Walls at either side of the cap. The camera sits at the origin looking
    // down -Z, so a plane at z = -d is exactly d metres away.
    const wallAt = (d) => {
      const m = new THREE24.Mesh(new THREE24.PlaneGeometry(40, 40), new THREE24.MeshBasicMaterial());
      m.position.set(0, 0, -d);
      m.updateMatrixWorld(true);
      return m;
    };
    const inside = wallAt(S24.MAX_RANGE - 0.1);
    const outside = wallAt(S24.MAX_RANGE + 0.1);
    assertTrue('section24',
      `the shotgun REACHES just inside its leash (${(S24.MAX_RANGE - 0.1).toFixed(1)} m)`,
      fireShot(cam, S24, [inside]).length > 0);
    assertNear('section24',
      `and finds NOTHING just past it (${(S24.MAX_RANGE + 0.1).toFixed(1)} m) — every pellet, not most`,
      fireShot(cam, S24, [outside]).length, 0);

    // THE pin this shape exists for. The raycaster is module scope and shared
    // by every weapon, and setFromCamera does not reset .far — so a MAX_RANGE
    // written anywhere but on every single shot LEAKS. The failure is silent
    // and permanent: fire the shotgun once and the pistol quietly inherits a
    // 13 m leash for the rest of the session, with nothing in the game saying
    // so. Fire the capped weapon FIRST, then check the uncapped one still
    // reaches — that ORDER is the whole test.
    const far30 = wallAt(30);
    fireShot(cam, S24, [far30]); // the shotgun, capped, fires first
    assertTrue('section24',
      'an UNCAPPED weapon still reaches 30 m right after a capped one fired (no .far leak)',
      fireShot(cam, P24, [far30]).length === 1);
    assertTrue('section24',
      'the pistol carries no MAX_RANGE at all — no field means no limit',
      P24.MAX_RANGE === undefined);
  }

  // — where the leash is allowed to sit —
  // Two edges, and the design lives between them. Inequalities, not equality:
  // the cap is 13 BECAUSE the fog is 13, but if the fog ever grows the shotgun
  // should not silently grow with it.
  assertTrue('section24',
    `the shotgun never outranges your EYES: MAX_RANGE ${S24.MAX_RANGE} <= FOG.WAVES.FAR ${CFG24.FOG.WAVES.FAR}`,
    S24.MAX_RANGE <= CFG24.FOG.WAVES.FAR);
  assertTrue('section24',
    `...and it can still answer the spitter at its post: MAX_RANGE ${S24.MAX_RANGE} > STOP_DISTANCE ${ET24.spitter.STOP_DISTANCE}`,
    S24.MAX_RANGE > ET24.spitter.STOP_DISTANCE);
  // The shotgun must remain a CLOSE weapon: its leash cannot reach past the
  // point where a scatter gun stops being one. If a future tune pushes this
  // out, the archetype has quietly become a rifle.
  assertTrue('section24',
    `the 100% zone sits inside the exploder's blast: that is the DECISION this weapon poses (EXPLODE.RADIUS ${ET24.exploder.EXPLODE.RADIUS} m)`,
    ET24.exploder.EXPLODE.RADIUS > 3);

  // — the viewmodels: built once, swapped by visibility —
  {
    const root = createGuns();
    assertNear('section24',
      `every weapon is built AT INIT (${root.children.length} viewmodels for ${ORDER.length} weapons)`,
      root.children.length, ORDER.length);
    // The design IS data: the mesh count has to follow PARTS, or gun.js is
    // drawing something it invented.
    for (const [i, id] of ORDER.entries()) {
      const meshes = root.children[i].children.filter((c) => c.isMesh && c.geometry.type === 'BoxGeometry');
      assertNear('section24', `${id} draws exactly its PARTS (${W[id].PARTS.length} boxes)`,
        meshes.length, W[id].PARTS.length);
    }
    assertTrue('section24', 'exactly ONE viewmodel is visible at a time',
      root.children.filter((c) => c.visible).length === 1);
    assertTrue('section24', 'and it starts on slot 1', getActiveGunId() === ORDER[0]);
    assertTrue('section24', 'swapping draws the other one',
      (setActiveGun('shotgun'), getActiveGunId() === 'shotgun'));
    assertTrue('section24', 'still exactly one visible after a swap',
      root.children.filter((c) => c.visible).length === 1);
    assertTrue('section24', 'an unknown weapon is refused, not thrown',
      setActiveGun('railgun') === false && getActiveGunId() === 'shotgun');
    setActiveGun(ORDER[0]);
  }
} catch (err) {
  failures.push({ file: 'section24', err });
  console.log(`  FAIL   section 24 threw: ${err.message}`);
}

// ————— Report —————

console.log('');
if (failures.length) {
  console.log(`SUITE FAIL — ${failures.length} failure(s), ${files.length} module(s) checked`);
  process.exitCode = 1;
} else {
  console.log(`SUITE PASS — ${files.length} modules imported cleanly; spawn, scoring, round, best, config, and enemy invariants proven`);
}
