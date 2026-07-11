// game/round.js — the round clock. Owns the countdown phase and the running
// phase; knows nothing about DOM, targets, or scoring. main.js drives it
// with frame deltas (only while the state machine is in COUNTDOWN or
// PLAYING, which is what freezes it during pause) and reacts to its
// callbacks. Waves mode runs UNTIMED: the 3-2-1 still plays, but the round
// clock never decrements and onRoundEnd never fires.

import { CONFIG } from '../config.js';

const Phase = Object.freeze({ IDLE: 'IDLE', COUNTDOWN: 'COUNTDOWN', RUNNING: 'RUNNING' });

let phase = Phase.IDLE;
let countdownMs = 0;
let roundMs = 0;
let timed = true;
let lastTickShown = null;

let onCountdownTick = null; // (n) => void — displayed integer changed
let onCountdownDone = null; // () => void  — 3-2-1 finished
let onRoundEnd = null;      // () => void  — round timer hit zero (timed only)

export function initRound(callbacks = {}) {
  onCountdownTick = callbacks.onCountdownTick || null;
  onCountdownDone = callbacks.onCountdownDone || null;
  onRoundEnd = callbacks.onRoundEnd || null;
}

// fresh=true  → brand-new round (full ROUND_LENGTH on the clock; `timed`
//               decides whether that clock ever runs — Range yes, Waves no)
// fresh=false → resume-from-pause (round time AND timed-ness are preserved,
//               only the 3-2-1 runs; `timed` is ignored here)
export function beginCountdown({ fresh, timed: timedFlag } = { fresh: true }) {
  phase = Phase.COUNTDOWN;
  countdownMs = CONFIG.COUNTDOWN_S * 1000;
  if (fresh) {
    roundMs = CONFIG.ROUND_LENGTH_S * 1000;
    timed = timedFlag !== false; // default: timed (Range behaviour)
  }
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

  if (phase === Phase.RUNNING && timed) {
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
