// ui/hud.js — the DOM layer: screen overlays, crosshair, HUD bar (score,
// multiplier pill, live timer), the countdown numeral, and the results
// screen. Pure DOM, no three.js, no game logic: main.js pushes values in
// via the setters.

import { States } from '../state.js';

const els = {};
let hintTimer = null;
let lastTimerText = null;
const defaultHints = {};

export function initHud({ onStartClick, onResumeClick, onPlayAgainClick } = {}) {
  const ids = {
    screenStart: 'screen-start',
    screenPause: 'screen-pause',
    screenResults: 'screen-results',
    crosshair: 'crosshair',
    countdown: 'countdown',
    btnStart: 'btn-start',
    btnAgain: 'btn-again',
    startHint: 'start-hint',
    pauseHint: 'pause-hint',
    hudBar: 'hud',
    hudScore: 'hud-score',
    hudMult: 'hud-mult',
    hudTimer: 'hud-timer',
    resultScore: 'result-score',
    resultAccuracy: 'result-accuracy',
    resultStreak: 'result-streak',
    resultBest: 'result-best',
    resultsNewbest: 'results-newbest',
  };

  const missing = [];
  for (const [key, id] of Object.entries(ids)) {
    els[key] = document.getElementById(id);
    if (!els[key]) missing.push(id);
  }
  // A missing overlay id is a build defect, not a runtime condition —
  // fail loudly in dev instead of half-rendering.
  if (missing.length) {
    throw new Error(`hud.js: missing element id(s): ${missing.join(', ')}`);
  }

  defaultHints.start = els.startHint.textContent;
  defaultHints.pause = els.pauseHint.textContent;

  if (onStartClick) els.btnStart.addEventListener('click', onStartClick);
  if (onPlayAgainClick) els.btnAgain.addEventListener('click', onPlayAgainClick);
  // The whole pause overlay is the resume button — biggest possible target.
  if (onResumeClick) els.screenPause.addEventListener('click', onResumeClick);
}

function setVisible(el, visible) {
  el.classList.toggle('hidden', !visible);
}

export function showForState(state) {
  setVisible(els.screenStart, state === States.START);
  setVisible(els.screenPause, state === States.PAUSED);
  setVisible(els.screenResults, state === States.RESULTS);
  setVisible(els.countdown, state === States.COUNTDOWN);
  setVisible(els.crosshair, state === States.PLAYING);
  setVisible(els.hudBar, state === States.PLAYING);
}

export function setScore(score) {
  els.hudScore.textContent = `SCORE ${score}`;
}

// The pill only exists while a multiplier is active — ×1 is silence.
export function setMultiplier(mult) {
  if (mult > 1) {
    els.hudMult.textContent = `\u00d7${mult}`;
    setVisible(els.hudMult, true);
  } else {
    setVisible(els.hudMult, false);
  }
}

export function setCountdown(n) {
  els.countdown.textContent = String(n);
}

// m:ss, updated only when the text actually changes so a per-frame call
// doesn't churn the DOM sixty times a second.
export function setTimer(seconds) {
  const s = Math.max(0, seconds);
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (text === lastTimerText) return;
  lastTimerText = text;
  els.hudTimer.textContent = text;
}

function formatAccuracy(accuracy) {
  // null = no shots fired — "—" is the honest display, never "0%" or "100%".
  return accuracy === null ? '\u2014' : `${Math.round(accuracy * 100)}%`;
}

export function showResults({ score, accuracy, bestStreak, best, isNew }) {
  els.resultScore.textContent = String(score);
  els.resultAccuracy.textContent = formatAccuracy(accuracy);
  els.resultStreak.textContent = String(bestStreak);
  els.resultBest.textContent = best === null
    ? '\u2014'
    : `${best.score} (${formatAccuracy(best.accuracy)})`;
  setVisible(els.resultsNewbest, isNew);
}

// Shown when the browser refuses a pointer lock request — Chrome enforces a
// ~1.3s cooldown after ESC, and a click inside that window is denied. Without
// this hint the denial looks like a dead button.
export function flashLockHint() {
  const msg = 'Pointer lock was blocked — wait a second, then click again.';
  els.startHint.textContent = msg;
  els.pauseHint.textContent = msg;
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    els.startHint.textContent = defaultHints.start;
    els.pauseHint.textContent = defaultHints.pause;
  }, 1600);
}
