// input.js — pointer lock + mouse look + fire clicks. No three.js dependency
// on purpose: this module is pure DOM events and math, which keeps it cheap
// for the Node test suite to import.

import { CONFIG } from './config.js';

const PITCH_LIMIT = (CONFIG.PITCH_CLAMP_DEG * Math.PI) / 180;

let yaw = 0;
let pitch = 0;
let locked = false;
let lockTarget = null;
let fireHeld = false; // 18: left button currently down (see mousedown below)

let onLockChangeCb = null;
let onLockErrorCb = null;
const fireHandlers = [];
const interactHandlers = [];
const reloadHandlers = [];
const swapHandlers = [];
const meleeHandlers = [];

// Movement key state, tracked by e.code so WASD works on any keyboard
// layout (AZERTY 'Z' still reports code 'KeyW').
const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };

function clearKeys() {
  keys.KeyW = false;
  keys.KeyA = false;
  keys.KeyS = false;
  keys.KeyD = false;
}

export function initInput({ onLockChange, onLockError } = {}) {
  onLockChangeCb = onLockChange || null;
  onLockErrorCb = onLockError || null;

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement != null;
    // Stuck-key guard: hold W, hit ESC, release W — without this, the
    // keyup lands outside the lock and the player glides forever on resume.
    if (!locked) { clearKeys(); fireHeld = false; }
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

  document.addEventListener('keydown', (e) => {
    if (!locked) return;
    if (e.code in keys) keys[e.code] = true;
    // Reload hook (pass 9): same pattern as fire — subscribers attach via
    // onReload without touching this file. Locked-only, like everything else.
    if (e.code === 'KeyR') reloadHandlers.forEach((fn) => fn());
    // Weapon swap hook (pass 17): 1 and 2 pick a hotbar SLOT, Q asks for the
    // next one. The slot number goes out raw and null means "cycle" — this
    // file doesn't know the roster, so it can't be the thing that has to
    // change when pass 18 adds a third gun.
    //
    // That claim was FALSE when pass 17 wrote it, and pass 18 is what found
    // out: `Digit1` and `Digit2` sat hardcoded directly under it, so a third
    // gun was unreachable by slot key and this file was exactly the thing that
    // had to change. The comment fused a REQUIREMENT ("doesn't know the
    // roster" — true, it sends slot NUMBERS, never ids) with an ACCIDENT
    // ("can't be the thing that changes" — false), which is why nothing ever
    // falsified it. It is true NOW, and structurally rather than by promise:
    // any digit goes out raw, and the roster decides what it means.
    //
    // Out-of-range needs no guard here because two already exist and always
    // did — ammo.js's weaponIdForSlot returns null past the end of the roster,
    // and main.js's swap handler returns on a null id. Digit9 with two guns is
    // silence. The plumbing for this was built in 17; only the tap was missing.
    const slot = e.code.match(/^Digit([1-9])$/);
    if (slot) swapHandlers.forEach((fn) => fn(Number(slot[1])));
    if (e.code === 'KeyQ') swapHandlers.forEach((fn) => fn(null));
    // Melee hook (17a): V, the COD default. Same locked-only, hook-out shape
    // as fire/reload/swap — this file stays ignorant of what a bash costs or
    // whether the current mode even has one. Note there is no keyup pair and
    // no auto-repeat guard: a held V repeats keydown, and melee.js's cooldown
    // is what swallows the repeats — the same division as the fire button,
    // where the trigger's clock lives in shooting.js and not in here.
    if (e.code === 'KeyV') meleeHandlers.forEach((fn) => fn());
  });
  document.addEventListener('keyup', (e) => {
    // Accept keyups even unlocked — releasing outside the lock must never
    // leave a key stuck on.
    if (e.code in keys) keys[e.code] = false;
  });

  // Fire hook exists now so the shooting pass can subscribe without touching
  // Fire: LEFT BUTTON, and it is now STATE as well as an event (18) — the
  // same split WASD already makes above. The mousedown broadcast stays for
  // click responsiveness and for everything that is legitimately per-CLICK
  // (the empty-mag auto-reload in main.js listens here on purpose: a held
  // trigger running dry must NOT auto-reload, because 17b made reloading a
  // spend decision — you get a dead trigger and the EMPTY pill, and you
  // decide). The held flag is what shooting.js polls per frame to auto-fire
  // weapons whose registry entry says AUTO — the roster decides which, never
  // this file. Only left button, and only while locked — clicks on overlay
  // screens must never register as shots.
  document.addEventListener('mousedown', (e) => {
    if (!locked || e.button !== 0) return;
    fireHeld = true;
    fireHandlers.forEach((fn) => fn());
  });
  // Accept the release even unlocked — the same rule as keyup below, and for
  // the same reason: Esc while holding the trigger otherwise leaves fireHeld
  // stuck true, and the gun opens up into the pause screen on resume.
  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    fireHeld = false;
  });

  // Interact (19): E goes out as "interact", nothing more — this file knows
  // there are things in the world you can use, not what they are or cost.
  // Same division as the slot keys: the signal is generic, the world decides.
  document.addEventListener('keydown', (e) => {
    if (!locked || e.code !== 'KeyE' || e.repeat) return;
    interactHandlers.forEach((fn) => fn());
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

// Is the trigger down RIGHT NOW? Polled per frame by shooting.js for AUTO
// weapons. State, not an event — the same division as getMoveAxes vs the
// key handlers.
export function isFireHeld() {
  return fireHeld;
}

export function onInteract(fn) {
  interactHandlers.push(fn);
}

export function onFire(fn) {
  fireHandlers.push(fn);
}

export function onSwapWeapon(fn) {
  swapHandlers.push(fn);
}

export function onReload(fn) {
  reloadHandlers.push(fn);
}

export function onMelee(fn) {
  meleeHandlers.push(fn);
}

// Move axes for the frame loop: x = strafe (−1 left … +1 right),
// z = forward (−1 back … +1 forward). Raw; movement.js normalizes.
export function getMoveAxes() {
  return {
    x: (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
    z: (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0),
  };
}

export function getLook() {
  return { yaw, pitch };
}

export function isLocked() {
  return locked;
}
