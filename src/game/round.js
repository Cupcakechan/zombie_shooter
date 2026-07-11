// game/round.js — the round clock. Owns the countdown phase and the running
// 60-second phase; knows nothing about DOM, targets, or scoring. main.js
// drives it with frame deltas (only while the state machine is in COUNTDOWN
// or PLAYING, which is what freezes it during pause) and reacts to its
// callbacks. Deliberately pure timing logic so the suite can prove it with
// exact-math updates.

import { CONFIG } from '../config.js';

const Phase = Object.freeze({ IDLE: 'IDLE', COUNTDOWN: 'COUNTDOWN', RUNNING: 'RUNNING' });

let phase = Phase.IDLE;
let countdownMs = 0;
let roundMs = 0;
let lastTickShown = null;

let onCountdownTick = null; // (n) => void — displayed integer changed
let onCountdownDone = null; // () => void  — 3-2-1 finished
let onRoundEnd = null;      // () => void  — round timer hit zero

export function initRound(callbacks = {}) {
  onCountdownTick = callbacks.onCountdownTick || null;
  onCountdownDone = callbacks.onCountdownDone || null;
  onRoundEnd = callbacks.onRoundEnd || null;
}

// fresh=true  → brand-new round (full ROUND_LENGTH on the clock)
// fresh=false → resume-from-pause (round time is preserved, only the 3-2-1 runs)
export function beginCountdown({ fresh } = { fresh: true }) {
  phase = Phase.COUNTDOWN;
  countdownMs = CONFIG.COUNTDOWN_S * 1000;
  if (fresh) roundMs = CONFIG.ROUND_LENGTH_S * 1000;
  lastTickShown = null;
  tickCountdown(); // show the "3" immediately, not one frame late
}

function tickCountdown() {
  const n = Math.max(1, Math.ceil(countdownMs / 1000));
  if (n !== lastTickShown) {
    lastTickShown = n;
    if (onCountdownTick) onCountdownTick(n);
  }
}

export function updateRound(dtMs) {
  if (phase === Phase.COUNTDOWN) {
    countdownMs -= dtMs;
    if (countdownMs <= 0) {
      phase = Phase.RUNNING;
      if (onCountdownDone) onCountdownDone();
    } else {
      tickCountdown();
    }
    return;
  }

  if (phase === Phase.RUNNING) {
    roundMs -= dtMs;
    if (roundMs <= 0) {
      roundMs = 0;
      phase = Phase.IDLE;
      if (onRoundEnd) onRoundEnd();
    }
  }
}

// Ceil so the display reads 1:00 at the start and 0:01 through the last
// second — a timer that shows 0:00 while you can still shoot reads as a bug.
export function getRemainingS() {
  return Math.ceil(roundMs / 1000);
}
