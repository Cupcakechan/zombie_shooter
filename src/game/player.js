// game/player.js — the player's arcade health (Decision B: 5 hits, no
// regen). Pure counters, no DOM, no three.js: main.js wires damage in from
// the enemy attack callback and reads state out for the hearts HUD.

import { CONFIG } from '../config.js';

let hits = CONFIG.PLAYER.MAX_HITS;

export function resetPlayer() {
  hits = CONFIG.PLAYER.MAX_HITS;
}

// Clamped at 0 — overkill on the killing blow must not go negative.
export function damagePlayer(n = 1) {
  hits = Math.max(0, hits - n);
  return hits;
}

export function getHits() {
  return hits;
}

export function isDead() {
  return hits <= 0;
}
