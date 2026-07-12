// ui/hud.js — the DOM layer: screen overlays, crosshair, the Range HUD bar
// (score, pill, timer), the Waves HUD (hearts, wave, kills), the wave
// banner, countdown numeral, damage vignette, results, and game over.
// Pure DOM: main.js pushes values and the current mode in via setters.

import { States } from '../state.js';

const els = {};
let hintTimer = null;
let bannerTimer = null;
let lastTimerText = null;
let lastHearts = -1;
let heartsMax = 0;
const defaultHints = {};

function fmtTime(seconds) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function initHud({
  onRangeClick, onWavesClick, onResumeClick, onPlayAgainClick,
  onRetryClick, onQuitClick,
} = {}) {
  const ids = {
    screenStart: 'screen-start',
    screenPause: 'screen-pause',
    screenResults: 'screen-results',
    screenGameover: 'screen-gameover',
    crosshair: 'crosshair',
    countdown: 'countdown',
    waveBanner: 'wave-banner',
    vignette: 'damage-vignette',
    splatter: 'blood-splatter',
    btnRange: 'btn-range',
    btnWaves: 'btn-waves',
    btnAgain: 'btn-again',
    btnRetry: 'btn-retry',
    btnQuit: 'btn-quit',
    btnGoQuit: 'btn-go-quit',
    startHint: 'start-hint',
    pauseHint: 'pause-hint',
    hudBar: 'hud',
    hudScore: 'hud-score',
    hudMult: 'hud-mult',
    hudTimer: 'hud-timer',
    hudWaves: 'hud-waves',
    hudHearts: 'hud-hearts',
    hudWave: 'hud-wave',
    hudKills: 'hud-kills',
    goKills: 'go-kills',
    goWave: 'go-wave',
    goTime: 'go-time',
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

  if (onRangeClick) els.btnRange.addEventListener('click', onRangeClick);
  if (onWavesClick) els.btnWaves.addEventListener('click', onWavesClick);
  if (onPlayAgainClick) els.btnAgain.addEventListener('click', onPlayAgainClick);
  if (onRetryClick) els.btnRetry.addEventListener('click', onRetryClick);
  // The whole pause overlay is the resume button — biggest possible target.
  // The quit button must NOT bubble into that overlay click, or quitting
  // would also request a pointer lock.
  if (onResumeClick) els.screenPause.addEventListener('click', onResumeClick);
  if (onQuitClick) {
    els.btnQuit.addEventListener('click', (e) => {
      e.stopPropagation();
      onQuitClick();
    });
    els.btnGoQuit.addEventListener('click', onQuitClick);
  }
}

function setVisible(el, visible) {
  el.classList.toggle('hidden', !visible);
}

export function showForState(state, mode) {
  setVisible(els.screenStart, state === States.START);
  setVisible(els.screenPause, state === States.PAUSED);
  setVisible(els.screenResults, state === States.RESULTS);
  setVisible(els.screenGameover, state === States.GAMEOVER);
  setVisible(els.countdown, state === States.COUNTDOWN);
  setVisible(els.crosshair, state === States.PLAYING);
  setVisible(els.hudBar, state === States.PLAYING && mode === 'range');
  setVisible(els.hudWaves, state === States.PLAYING && mode === 'waves');
  // Leaving PLAYING always retires the banner (e.g. dying mid-intermission).
  if (state !== States.PLAYING) setVisible(els.waveBanner, false);
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
  const text = fmtTime(seconds);
  if (text === lastTimerText) return;
  lastTimerText = text;
  els.hudTimer.textContent = text;
}

// Hearts as pips: built once per max, then only the .lost class toggles.
export function setHearts(current, max) {
  if (max !== heartsMax) {
    heartsMax = max;
    els.hudHearts.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      els.hudHearts.appendChild(pip);
    }
    lastHearts = -1;
  }
  if (current === lastHearts) return;
  lastHearts = current;
  const pips = els.hudHearts.children;
  for (let i = 0; i < pips.length; i++) {
    pips[i].classList.toggle('lost', i >= current);
  }
}

export function setWave(n) {
  els.hudWave.textContent = `WAVE ${n}`;
}

export function setKills(n) {
  els.hudKills.textContent = `KILLS ${n}`;
}

// Big centre banner announcing the wave during the intermission breather.
export function showWaveBanner(n) {
  els.waveBanner.textContent = `WAVE ${n}`;
  setVisible(els.waveBanner, true);
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => setVisible(els.waveBanner, false), 1500);
}

// Red edge-flash on taking damage: restart the CSS animation by removing
// the class, forcing a reflow, and re-adding it.
export function flashDamage() {
  els.vignette.classList.remove('flash');
  void els.vignette.offsetWidth;
  els.vignette.classList.add('flash');
}

// Screen blood splatter on taking damage (pass 8.3): same restart-the-CSS-
// animation trick as the vignette; a random rotation each hit so repeated
// hits don't paint an identical pattern.
export function flashBloodSplatter() {
  els.splatter.style.transform = `rotate(${Math.floor(Math.random() * 360)}deg)`;
  els.splatter.classList.remove('flash');
  void els.splatter.offsetWidth;
  els.splatter.classList.add('flash');
}

export function showGameOver({ kills, wave, seconds }) {
  els.goKills.textContent = String(kills);
  els.goWave.textContent = String(wave);
  els.goTime.textContent = fmtTime(seconds);
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
