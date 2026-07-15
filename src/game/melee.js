// game/melee.js — the bash (pass 17a): subscribes to input's melee hook,
// enforces its own cooldown, and raycasts ONE short ray through the crosshair.
// It knows nothing about damage, scores or blood — main wires those in, the
// same inversion shooting.js uses.
//
// WHY THIS EXISTS BEFORE AMMO IS FINITE (17b), which is the only interesting
// thing about the ordering: drops come from kills and kills need ammo, so a
// finite reserve with no floor deadlocks — the source is gated behind the very
// act the resource pays for, and waves.js ends a wave on aliveCount <= 0 and
// nothing else. A floor fixes that, but an infinite PISTOL would be a FREE
// floor and would quietly delete the pressure 17b exists to create. A bash
// costs RISK instead: REACH 2.0 sits inside the standing claw (2.5), so the
// price of not spending a bullet is being somewhere a zombie can reach you.
// That is what lets 17b's drop rate be genuinely scarce later — the failure
// mode becomes "you are bashing wave 9 and it is terrifying" rather than "you
// have no verb and the wave cannot end".
//
// WHY IT IS NOT A WEAPON: a knife in WEAPON_ORDER would Q-cycle — you would
// have to cycle INTO your panic button and back out again — and it would need
// a MAG_SIZE and a RELOAD_MS that mean nothing, which §24's registry contract
// pins against. A bash is an ACTION you take while holding a gun.
//
// The bash is deliberately NOT a shot: no round, no casing, no muzzle flash,
// no cooldown shared with the trigger. Its clock is its own, so bashing never
// eats a shot you were about to take and firing never eats a bash.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';
import { onMelee } from '../input.js';

const raycaster = new THREE.Raycaster();
// Screen centre in normalized device coordinates — where the crosshair is.
const CENTER = new THREE.Vector2(0, 0);

// This module's OWN raycaster rather than shooting.js's, and that is a
// decision: shooting's is module-scope and its `.far` is rewritten on every
// pull precisely because a stale leash leaks between weapons (§24 pins that
// exact bug). Borrowing it would put a second writer on the same mutable
// field for no saving at all — a raycaster is a cheap object.
let lastSwingAt = -Infinity;

// ————— Pure gate (suite-tested) —————

// The cooldown as a pure predicate so the suite can drive it without a clock.
// `>=` so a swing landing exactly on the boundary is allowed: the cooldown is
// "this long between swings", and a frame that lands precisely on it has
// waited long enough.
export function swingReady(now, lastAt, cooldownMs) {
  return now - lastAt >= cooldownMs;
}

// ————— The swing —————

// Raycast one short ray through the crosshair and return the nearest thing
// inside `reach`, or null. Exported so the suite can drive a real camera at a
// real mesh — the reach boundary is the part with something to get wrong, so
// it is the part that must be reachable.
//
// `reach` is metres ALONG THE RAY, exactly the semantics of a weapon's
// MAX_RANGE, so "2 m" means the same thing here as "13 m" does on the shotgun.
export function meleeSwing(camera, reach, hittables) {
  raycaster.far = reach;
  raycaster.setFromCamera(CENTER, camera);
  // Hittables are the meshes themselves, so no recursive descent.
  const hits = raycaster.intersectObjects(hittables, false);
  if (hits.length === 0) return null;
  return { mesh: hits[0].object, point: hits[0].point };
}

export function initMelee({ camera, getHittables, onSwing, canSwing } = {}) {
  onMelee(() => {
    // State/mode gate first — main injects the predicate so this module stays
    // ignorant of the state machine AND of the fact that Range has no melee.
    // A refused swing must not consume the cooldown, same as a click during
    // COUNTDOWN must not consume the trigger's.
    if (canSwing && !canSwing()) return;

    const now = performance.now();
    if (!swingReady(now, lastSwingAt, CONFIG.MELEE.COOLDOWN_MS)) return;
    lastSwingAt = now;

    // Fires on EVERY accepted swing, hit or miss — a whiffed bash still swings
    // the gun and still spends the cooldown, because a melee you can spam for
    // free while backpedalling is not a decision.
    if (onSwing) onSwing(meleeSwing(camera, CONFIG.MELEE.REACH, getHittables()));
  });
}

// A fresh round must not inherit the last one's swing timing.
export function resetMelee() {
  lastSwingAt = -Infinity;
}
