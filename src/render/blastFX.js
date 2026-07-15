// render/blastFX.js — the Exploder's blast, DRAWN (pass 14c). Pass 14 shipped
// the archetype with a tell (the eye pulse) but never an answer: the blast
// itself was a fountain of red gore identical to every other kill, so the
// 3.5 m the game punishes you for was a number you could only learn by dying
// repeatedly and guessing at it. This module draws that number.
//
// Two pooled effects, one job each:
//   • a full-bright additive FLASH at the body's own anchor, sized to
//     EXPLODE.CORE_RADIUS — the 2-heart band;
//   • a ground shockwave RING whose OUTER EDGE expands to land exactly on
//     EXPLODE.RADIUS — the 1-heart band, and the boundary of safety.
// Together they are blastDamage() drawn in the world at the instant it fires.
// Every radius is READ from the type's EXPLODE block and never duplicated
// here, so a registry tune moves the picture with it — the FX cannot drift
// out of agreement with the damage the way a hand-copied 3.5 would.
//
// Pooled and recycled from a fixed-size array like BLOOD, CASINGS and
// PROJECTILES: no allocation during play, no GC hitches, a hard cap on scene
// cost. All visuals code-built, per the project's no-assets rule.
//
// Factory-init pattern, no module-scope side effects: safe for the Node
// suite to import.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

// ————— Pure math (suite-tested) —————

// The ring's outer radius at time t: a decelerating expansion that lands on
// `radius` EXACTLY at t = growMs, then holds there.
//
// The ease-out-quadratic is chosen for a reason that outlives taste: at
// u = 1 it is 1 - (1-1)² = 1 - 0 = 1 in exact float arithmetic, so
// `radius * eased` returns the radius BIT-FOR-BIT rather than 3.4999999999.
// The whole pass rests on the ring's edge being the damage boundary, and a
// curve that only approximately arrives would make that claim only
// approximately true. A sine ease would look near-identical and would not
// carry that guarantee.
//
// The HOLD past growMs is the second half of the design. A ring that faded
// while it expanded would be at its dimmest exactly when it was at its most
// informative — the lesson is the final frame, so the final frame is the one
// that stays. It rests at full extent and fades from there (see ringOpacity).
export function ringRadius(t, growMs, radius) {
  // Guard: growMs = 0 divides to NaN at t = 0 and would scale a mesh to
  // nothing-in-particular. A zero-length growth means it is already done.
  const u = growMs > 0 ? Math.min(1, Math.max(0, t / growMs)) : 1;
  const eased = 1 - (1 - u) * (1 - u);
  return radius * eased;
}

// The ring's opacity: solid for the whole expansion, then a linear fade from
// full extent. Same shape as bloodFX's poolPhase (solid → fading → gone) and
// deliberately NOT that function: a shockwave and a blood stain share a curve
// today and have no reason to stay married to one.
export function ringOpacity(t, growMs, fadeMs) {
  if (t < growMs) return 1; // full-bright while it is still teaching
  if (!(fadeMs > 0)) return 0; // guard: /0 — no fade time means gone on arrival
  const f = (t - growMs) / fadeMs;
  return f >= 1 ? 0 : 1 - f;
}

// The flash's opacity: a linear fall to exactly 0 at t = flashMs. Linear, not
// eased — a blast flash is a discharge, and anything with a soft shoulder
// reads as a glow rather than a detonation.
export function flashOpacity(t, flashMs) {
  if (!(flashMs > 0)) return 0; // guard: /0, same reasoning as above
  const u = Math.min(1, Math.max(0, t / flashMs));
  return 1 - u;
}

// Total life of one blast. The ring outlives the flash by design, so this is
// the ring's clock — the flash simply finishes early and hides itself.
export function blastLifeMs(flashMs, growMs, fadeMs) {
  return Math.max(flashMs, growMs + fadeMs);
}

// ————— Stateful pooled FX —————

let sceneRef = null;
const blasts = []; // { flash, ring, t, radius, active }

export function initBlastFX(scene) {
  sceneRef = scene;
  if (blasts.length) return; // idempotent: re-init must not double the pool

  const BL = CONFIG.BLAST;

  // Shared geometry, a material EACH — the same trade the blood pools and the
  // globs make. Opacity animates per blast and colour is per-TYPE registry
  // data, and both live on the material: sharing one would make every blast
  // in the scene fade in lockstep and force a future second exploding type to
  // burst in the first one's colour.
  //
  // Unit shapes, scaled at spawn. The ring is built with its OUTER edge at
  // exactly 1 so that scaling by ringRadius() puts the outer edge on the
  // damage boundary with no second conversion to get wrong.
  const flashGeo = new THREE.SphereGeometry(1, 12, 8);
  const ringGeo = new THREE.RingGeometry(1 - BL.RING_THICKNESS, 1, BL.RING_SEGMENTS);

  for (let i = 0; i < BL.MAX; i++) {
    // fog:false is load-bearing, not cosmetic — the same call the eyes make
    // (enemyBody.js) and the globs make (projectiles.js). FOG.WAVES.FAR is 13
    // and a blast happens at claw range in the murk; a fogged flash would be
    // partly erased at the exact moment it is trying to teach.
    const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending, // a discharge ADDS light; it never tints
      depthWrite: false, // a transparent shell must not occlude the gore inside it
      fog: false,
    }));
    flash.visible = false;
    scene.add(flash);

    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1,
      depthWrite: false, // a flat decal must never write depth — same as spawnPool
      fog: false,
    }));
    // Matches spawnPool's proven orientation: RingGeometry is born in the XY
    // plane, and -90° about X lays it on the ground facing the camera.
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);

    blasts.push({ flash, ring, t: 0, radius: 0, active: false });
  }
}

// Fire the picture. `at` is the detonation anchor (the pass-12 live-waist
// eruption point, so a crippled exploder flashes at its corpse); `E` is the
// type's EXPLODE block, which is where every dimension comes from.
export function spawnBlast(at, E) {
  if (!sceneRef) return null;
  if (!E) return null; // guarded like blastDamage and spawnGlob: the guard IS the contract

  const BL = CONFIG.BLAST;
  if (!blasts.length) return null; // MAX 0, or init never ran: draw nothing,
  // never throw. Found by 14c's bite harness — reduce() on an empty array
  // throws rather than returning undefined, so a mistuned MAX took out the
  // whole kill callback instead of quietly skipping the decoration.
  let b = blasts.find((x) => !x.active);
  if (!b) {
    // Pool exhausted: reclaim the OLDEST. The opposite call to spawnGlob's,
    // and for the opposite reason — a glob is a live hit the player is
    // physically dodging, so stealing one would delete a threat they had
    // already beaten. A blast is a picture of damage that has ALREADY been
    // dealt; the oldest one is nearly faded and nobody is reading it.
    b = blasts.reduce((a, c) => (a.t >= c.t ? a : c));
  }

  b.active = true;
  b.t = 0;
  b.radius = E.RADIUS;

  // The flash sits at the body's anchor and is sized to the CORE band — the
  // 2-heart zone you are standing in when the screen fills with acid.
  b.flash.position.set(at.x, at.y, at.z);
  b.flash.scale.setScalar(E.CORE_RADIUS * BL.FLASH_RADIUS_MULT);
  b.flash.material.color.setHex(E.FX_COLOR);
  b.flash.material.opacity = 1;
  b.flash.visible = true;

  // The ring sits on the GROUND at the blast's XZ footprint, not at the
  // anchor's height, because the damage model is XZ — blastDamage() ignores y
  // entirely. Drawing it on the floor is the honest picture of what the code
  // actually measures.
  b.ring.position.set(at.x, BL.RING_Y, at.z);
  b.ring.scale.setScalar(0);
  b.ring.material.color.setHex(E.FX_COLOR);
  b.ring.material.opacity = 1;
  b.ring.visible = true;

  return b;
}

function retire(b) {
  b.active = false;
  b.flash.visible = false;
  b.ring.visible = false;
}

export function updateBlastFX(dtMs) {
  const BL = CONFIG.BLAST;
  const life = blastLifeMs(BL.FLASH_LIFE_MS, BL.RING_GROW_MS, BL.RING_FADE_MS);

  for (const b of blasts) {
    if (!b.active) continue;
    b.t += dtMs;
    if (b.t >= life) {
      retire(b);
      continue;
    }

    // The flash finishes first and simply stops drawing; its slot stays held
    // by the ring, which is the one still saying something.
    const fo = flashOpacity(b.t, BL.FLASH_LIFE_MS);
    b.flash.visible = fo > 0;
    b.flash.material.opacity = fo;

    // scale.setScalar on a unit ring scales the ANNULUS with it, so the band
    // thickens as it grows — which is what a real shockwave does, and which
    // keeps the outer edge exactly where the math put it either way.
    //
    // The ring passes through walls, and that is correct rather than a bug to
    // fix later: blastDamage() has no LOS check and no wall test, so a blast
    // genuinely reaches through a wall today. The ring is a picture of the
    // model, not of the light. The day the blast learns about walls, this
    // learns with it.
    b.ring.scale.setScalar(ringRadius(b.t, BL.RING_GROW_MS, b.radius));
    b.ring.material.opacity = ringOpacity(b.t, BL.RING_GROW_MS, BL.RING_FADE_MS);
  }
}

// Fresh round: every blast vanishes instantly. Pooled meshes just go inactive
// — nothing is disposed, the pool lives for the whole session.
export function resetBlastFX() {
  for (const b of blasts) retire(b);
}
