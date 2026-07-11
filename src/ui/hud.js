// ui/hud.js — the DOM layer: screen overlays + crosshair. Pure DOM, no
// three.js, no game logic. main.js orchestrates; this module only shows,
// hides, and forwards button clicks. Grows a real HUD (score/streak/timer)
// in the scoring pass.

import { States } from '../state.js';

const els = {};
let hintTimer = null;
const defaultHints = {};

export function initHud({ onStartClick, onResumeClick } = {}) {
  const ids = {
    screenStart: 'screen-start',
    screenPause: 'screen-pause',
    crosshair: 'crosshair',
    btnStart: 'btn-start',
    startHint: 'start-hint',
    pauseHint: 'pause-hint',
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
  // The whole pause overlay is the resume button — biggest possible target.
  if (onResumeClick) els.screenPause.addEventListener('click', onResumeClick);
}

function setVisible(el, visible) {
  el.classList.toggle('hidden', !visible);
}

export function showForState(state) {
  setVisible(els.screenStart, state === States.START);
  setVisible(els.screenPause, state === States.PAUSED);
  setVisible(els.crosshair, state === States.PLAYING);
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
