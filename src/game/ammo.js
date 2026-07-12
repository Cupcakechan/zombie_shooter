// game/ammo.js — magazine + reload state (pass 9, resolves DESIGN §12
// "ammo/reload"). Unlimited reserve, finite magazine, manual R reload with
// auto-reload on an empty click. Pure logic — no DOM, no three.js — so every
// rule here is provable in Node (suite section 10).
//
// The pressure design: MAG_SIZE 12 with zombie HP 3 = exactly 4 kills per
// mag, and RELOAD_MS equals the zombie attack cooldown — reloading inside
// melee range genuinely risks eating a hit. Both are single-value levers.

import { CONFIG } from './../config.js';

let mag = 0;
let reloading = false;
let reloadT = 0;

// Fresh round: full magazine, nothing in progress.
export function resetAmmo() {
  mag = CONFIG.AMMO.MAG_SIZE;
  reloading = false;
  reloadT = 0;
}

// The fire gate: no shots while reloading, no shots on empty.
export function canFire() {
  return !reloading && mag > 0;
}

// One round leaves on every REAL shot (cooldown-swallowed clicks never
// reach this — see main.js wiring).
export function consumeRound() {
  if (mag > 0) mag -= 1;
}

// Returns true only when a reload actually starts: refused while one is
// already running (no restart-cheese resetting the timer) and refused on a
// full mag (R with 12/12 must not lock the gun for nothing).
export function startReload() {
  if (reloading || mag >= CONFIG.AMMO.MAG_SIZE) return false;
  reloading = true;
  reloadT = 0;
  return true;
}

// Ticks an in-progress reload; returns true on the tick it completes so the
// caller knows to refresh the HUD.
export function updateAmmo(dtMs) {
  if (!reloading) return false;
  reloadT += dtMs;
  if (reloadT >= CONFIG.AMMO.RELOAD_MS) {
    reloading = false;
    reloadT = 0;
    mag = CONFIG.AMMO.MAG_SIZE;
    return true;
  }
  return false;
}

export function getMag() {
  return mag;
}

export function isReloading() {
  return reloading;
}

// 0..1 through the reload; 0 when idle. Drives the gun-dip telegraph.
export function reloadProgress() {
  return reloading ? Math.min(1, reloadT / CONFIG.AMMO.RELOAD_MS) : 0;
}
