// test_suite.mjs — committed headless suite. Run from the repo root:
//   node test_suite.mjs
//
// Section 0 — module health: imports EVERY src/**/*.js module under a minimal
// DOM stub, so parse errors, duplicate import bindings, and broken import
// paths fail HERE instead of in the browser. The browser must never be the
// first parser to see delivered code. Later passes append exact-math sections
// (scoring, spawn rules) below section 0.

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

// — Walk src/ —
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
// Guard-the-guard: the walker finding suspiciously few modules means the
// walker (or the tree) rotted — fail rather than pass vacuously.
const MIN_EXPECTED_MODULES = 5;

const files = walk('src').filter((p) => !EXCLUDE.has(p));
const failures = [];

console.log('— Section 0: module health —');
for (const file of files) {
  try {
    await import(pathToFileURL(file).href);
    console.log(`  ok      ${file}`);
  } catch (err) {
    failures.push({ file, err });
    console.log(`  FAIL    ${file}`);
    console.log(`          ${err.message}`);
  }
}

if (files.length < MIN_EXPECTED_MODULES) {
  failures.push({
    file: '(walker)',
    err: new Error(
      `only ${files.length} module(s) found — expected at least ${MIN_EXPECTED_MODULES}`,
    ),
  });
  console.log(`  FAIL    walker found only ${files.length} module(s)`);
}

console.log('');
if (failures.length) {
  console.log(`SUITE FAIL — ${failures.length} failure(s), ${files.length} module(s) checked`);
  process.exitCode = 1;
} else {
  console.log(`SUITE PASS — ${files.length} modules imported cleanly`);
}
