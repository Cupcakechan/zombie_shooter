// test_suite.mjs — committed headless suite. Run from the repo root:
//   node test_suite.mjs
//
// Section 0 — module health: imports EVERY src/**/*.js module under a minimal
// DOM stub, so parse errors, duplicate import bindings, and broken import
// paths fail HERE instead of in the browser. The browser must never be the
// first parser to see delivered code.
// Section 1 — spawn placement invariants: exact-math proof of the jittered
// grid's guarantees (hand-computed expected values, DESIGN.md §5/§8).
// Section 2 — scoring exact math: hand-computed score/streak/accuracy
// scenarios, proving the multiplier tiers actually change the numbers.

import { readdirSync, statSync } from 'node:fs';
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
const MIN_EXPECTED_MODULES = 10;

const files = walk('src').filter((p) => !EXCLUDE.has(p));

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
    getScore, getStreak, getMultiplier, getAccuracy, resetScoring,
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
  assertNear('section2', 'multiplier after 25 straight hits', getMultiplier(), 3);
  assertNear('section2', 'accuracy after 25/25', getAccuracy(), 1);

  // Miss resets the streak but keeps the score:
  // 12 hits = 9×100 + 3×200 = 1500; miss; next hit back at ×1 → 1600.
  resetScoring();
  for (let i = 0; i < 12; i++) registerHit();
  assertNear('section2', 'score after 12 straight hits', getScore(), 1500);
  registerMiss();
  assertNear('section2', 'streak resets on miss', getStreak(), 0);
  assertNear('section2', 'multiplier back to 1 on miss', getMultiplier(), 1);
  registerHit();
  assertNear('section2', 'hit after miss pays x1 (total)', getScore(), 1600);
  assertNear('section2', 'accuracy 13 hits / 14 shots', getAccuracy(), 13 / 14);

  // Reset zeroes everything
  resetScoring();
  assertNear('section2', 'reset: score 0', getScore(), 0);
  assertNear('section2', 'reset: streak 0', getStreak(), 0);
  assertTrue('section2', 'reset: accuracy null again', getAccuracy() === null);
} catch (err) {
  failures.push({ file: 'section2', err });
  console.log(`  FAIL   section 2 threw: ${err.message}`);
}

// ————— Report —————

console.log('');
if (failures.length) {
  console.log(`SUITE FAIL — ${failures.length} failure(s), ${files.length} module(s) checked`);
  process.exitCode = 1;
} else {
  console.log(`SUITE PASS — ${files.length} modules imported cleanly, spawn + scoring invariants proven`);
}
