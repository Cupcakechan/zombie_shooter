// game/scoring.js — score, streak, and accuracy state (DESIGN.md §5).
// Pure math + counters only: no DOM, no three.js. main.js wires it to the
// shooting callbacks and pushes values into the HUD.

import { CONFIG } from '../config.js';

let score = 0;
let streak = 0;
let hits = 0;
let shots = 0;

// Tier lookup — CONFIG.STREAK_TIERS is sorted highest-first (load-bearing:
// the first tier the streak reaches wins). Exported for the suite.
export function multiplierFor(streakValue) {
  for (const tier of CONFIG.STREAK_TIERS) {
    if (streakValue >= tier.streak) return tier.mult;
  }
  return 1;
}

export function registerHit() {
  shots++;
  hits++;
  streak++;
  // Semantics pinned in DESIGN.md §5: the hit that REACHES a threshold is
  // already paid at the new rate — the 10th consecutive hit is the first
  // ×2 hit. (Streak increments before the multiplier is read.)
  score += CONFIG.POINTS_PER_HIT * multiplierFor(streak);
}

export function registerMiss() {
  shots++;
  streak = 0;
}

export function getScore() {
  return score;
}

export function getStreak() {
  return streak;
}

export function getMultiplier() {
  return multiplierFor(streak);
}

// null (not 0, not 1) when no shots have been fired — "—" is the honest
// display for an accuracy that doesn't exist yet.
export function getAccuracy() {
  return shots === 0 ? null : hits / shots;
}

export function resetScoring() {
  score = 0;
  streak = 0;
  hits = 0;
  shots = 0;
}
