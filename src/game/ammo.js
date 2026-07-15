// game/ammo.js — magazine + reload state, PER WEAPON (pass 9, widened by
// pass 17). Finite magazine, manual R reload with auto-reload on an empty
// click. Pure logic — no DOM, no three.js — so every rule here is provable in
// Node (suite section 10).
//
// RESERVE IS STILL CONJURED: a completed reload sets the mag back to full out
// of nothing. That is pass 17b's whole job, and it is deliberately NOT
// half-built here — a RESERVE field with no source to refill it and no HUD to
// show it is machinery without a consumer, and running dry with no way to
// resupply is a softlock rather than a difficulty.
//
// The pass-17 change is that every rule below now asks WHICH weapon. The
// magazines are independent and persist across swaps: holstering a pistol with
// 3 rounds and coming back to it finds 3 rounds. If a swap silently refilled,
// swapping would be a free instant reload and the reload timer would be
// decorative.

import { WEAPON_TYPES, WEAPON_ORDER } from '../data/weaponTypes.js';

const mags = {};              // weapon id -> rounds currently in ITS magazine
let activeId = WEAPON_ORDER[0];
let reloading = false;
let reloadT = 0;

// Fresh round: every weapon starts loaded, holding slot 1, nothing in
// progress. Every weapon and not just the active one — you should not be able
// to bank a spent shotgun across a death.
export function resetAmmo() {
  for (const id of WEAPON_ORDER) mags[id] = WEAPON_TYPES[id].MAG_SIZE;
  activeId = WEAPON_ORDER[0];
  reloading = false;
  reloadT = 0;
}

export function getActiveWeaponId() {
  return activeId;
}

export function getActiveWeapon() {
  return WEAPON_TYPES[activeId];
}

// Swap. Returns true only when the weapon actually changed, so the caller
// knows whether to move the viewmodel and repaint the HUD.
//
// A swap CANCELS an in-progress reload, and that is a design decision rather
// than an implementation detail. It makes the swap the real answer to an empty
// shotgun in melee — faster than the 2.2 s reload, at the cost of the progress
// you'd already paid for. Without the cancel you could start the shotgun's
// reload, fight with the pistol, and collect a free full tube: the slow reload
// that pays for eight pellets would cost nothing at all.
export function setActiveWeapon(id) {
  if (!WEAPON_TYPES[id]) return false; // unknown weapon: refuse, never throw
  if (id === activeId) return false;   // already holding it — not a swap
  activeId = id;
  reloading = false;
  reloadT = 0;
  return true;
}

// Resolve a hotbar slot (1-based) to a weapon id; null for an out-of-range
// slot so a future keybind can't index off the end of the roster.
export function weaponIdForSlot(slot) {
  return WEAPON_ORDER[slot - 1] ?? null;
}

// The next weapon in the roster, wrapping. Q's whole implementation.
export function nextWeaponId() {
  const i = WEAPON_ORDER.indexOf(activeId);
  return WEAPON_ORDER[(i + 1) % WEAPON_ORDER.length];
}

// The fire gate: no shots while reloading, no shots on empty.
export function canFire() {
  return !reloading && (mags[activeId] ?? 0) > 0;
}

// One round leaves on every REAL shot — ONE, no matter how many pellets that
// shot puts in the air. Cooldown-swallowed clicks never reach this (see
// main.js wiring), and neither does a pellet: shooting.js reports a SHOT, and
// the pellets are an implementation detail underneath it. That distinction is
// the reason this function did not need a pellet-aware rewrite in 17.
export function consumeRound() {
  if ((mags[activeId] ?? 0) > 0) mags[activeId] -= 1;
}

// Returns true only when a reload actually starts: refused while one is
// already running (no restart-cheese resetting the timer) and refused on a
// full mag (R at 12/12 must not lock the gun for nothing).
export function startReload() {
  if (reloading) return false;
  if ((mags[activeId] ?? 0) >= WEAPON_TYPES[activeId].MAG_SIZE) return false;
  reloading = true;
  reloadT = 0;
  return true;
}

// Ticks an in-progress reload; returns true on the tick it completes so the
// caller knows to refresh the HUD. Fills the ACTIVE weapon only — the one
// you're holding is the one your hands are working on.
export function updateAmmo(dtMs) {
  if (!reloading) return false;
  reloadT += dtMs;
  if (reloadT >= WEAPON_TYPES[activeId].RELOAD_MS) {
    reloading = false;
    reloadT = 0;
    mags[activeId] = WEAPON_TYPES[activeId].MAG_SIZE;
    return true;
  }
  return false;
}

export function getMag() {
  return mags[activeId] ?? 0;
}

// Rounds in a weapon you are NOT holding. The HUD doesn't want this yet; the
// suite does, because "the pistol kept its 3 rounds" is unprovable without it.
export function getMagOf(id) {
  return mags[id] ?? 0;
}

export function isReloading() {
  return reloading;
}

// 0..1 through the reload; 0 when idle. Drives the gun-dip telegraph. Reads
// the ACTIVE weapon's timing, so the shotgun's longer dip is free.
export function reloadProgress() {
  if (!reloading) return 0;
  const ms = WEAPON_TYPES[activeId].RELOAD_MS;
  if (!(ms > 0)) return 0; // guard: /0 on a mistuned registry entry
  return Math.min(1, reloadT / ms);
}
