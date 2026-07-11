// input.js — pointer lock + mouse look + fire clicks. No three.js dependency
// on purpose: this module is pure DOM events and math, which keeps it cheap
// for the Node test suite to import.

import { CONFIG } from './config.js';

const PITCH_LIMIT = (CONFIG.PITCH_CLAMP_DEG * Math.PI) / 180;

let yaw = 0;
let pitch = 0;
let locked = false;
let lockTarget = null;

let onLockChangeCb = null;
let onLockErrorCb = null;
const fireHandlers = [];

export function initInput({ onLockChange, onLockError } = {}) {
  onLockChangeCb = onLockChange || null;
  onLockErrorCb = onLockError || null;

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement != null;
    if (onLockChangeCb) onLockChangeCb(locked);
  });

  // Firefox/Safari signal a blocked lock request here (no promise returned).
  document.addEventListener('pointerlockerror', () => {
    if (onLockErrorCb) onLockErrorCb();
  });

  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    yaw -= e.movementX * CONFIG.MOUSE_SENSITIVITY;
    pitch -= e.movementY * CONFIG.MOUSE_SENSITIVITY;
    // Clamp so the camera can't flip over backwards.
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  });

  // Fire hook exists now so the shooting pass can subscribe without touching
  // this file. Only left button, and only while locked — clicks on overlay
  // screens must never register as shots.
  document.addEventListener('mousedown', (e) => {
    if (!locked || e.button !== 0) return;
    fireHandlers.forEach((fn) => fn());
  });
}

export function requestLock(el) {
  lockTarget = el;
  try {
    const p = el.requestPointerLock();
    // Chrome returns a promise and REJECTS it when the browser's ~1.3s
    // re-lock cooldown (after ESC) hasn't elapsed. Firefox returns undefined
    // and reports failure via 'pointerlockerror' instead — handle both paths.
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        if (onLockErrorCb) onLockErrorCb();
      });
    }
  } catch (err) {
    if (onLockErrorCb) onLockErrorCb();
  }
}

export function onFire(fn) {
  fireHandlers.push(fn);
}

export function getLook() {
  return { yaw, pitch };
}

export function isLocked() {
  return locked;
}
