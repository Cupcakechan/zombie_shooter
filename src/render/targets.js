// render/targets.js — target lifecycle: jittered-grid spawning, meshes,
// pop animation, respawn. The placement math is pure and exported (randoms
// injected as arguments) so the suite can prove the band + separation
// invariants with exact values instead of hoping.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';
import { TARGET_TYPES } from '../data/targetTypes.js';

// ————— Pure placement math (suite-tested) —————

export function computeSlots() {
  const slots = [];
  for (const z of CONFIG.SPAWN.SLOT_ZS) {
    for (const x of CONFIG.SPAWN.SLOT_XS) {
      slots.push({ x, z });
    }
  }
  return slots;
}

// rx / rz / ry are 0..1 randoms injected by the caller — the suite feeds the
// extremes (0 and 1) to assert worst-case positions.
export function jitterFromSlot(slot, rx, rz, ry) {
  const { JITTER_X, JITTER_Z, Y_MIN, Y_MAX } = CONFIG.SPAWN;
  return {
    x: slot.x + (rx * 2 - 1) * JITTER_X,
    z: slot.z + (rz * 2 - 1) * JITTER_Z,
    y: Y_MIN + ry * (Y_MAX - Y_MIN),
  };
}

// ————— Stateful target management —————

const SLOTS = computeSlots();
const records = [];              // { type, group, sphere, slotIndex, popping, popT, baseIntensity }
const bySphere = new Map();      // sphere mesh -> record
let sceneRef = null;

function pickFreeSlot(excludeIndex) {
  const occupied = new Set(
    records.filter((r) => !r.popping).map((r) => r.slotIndex),
  );
  let free = [];
  for (let i = 0; i < SLOTS.length; i++) {
    if (!occupied.has(i) && i !== excludeIndex) free.push(i);
  }
  // Can't actually happen (20 slots vs 3 targets), but a spawn must never
  // crash: fall back to any unoccupied slot rather than throwing.
  if (free.length === 0) {
    free = [...Array(SLOTS.length).keys()].filter((i) => !occupied.has(i));
  }
  return free[Math.floor(Math.random() * free.length)];
}

function spawn(slotIndex, type) {
  const pos = jitterFromSlot(SLOTS[slotIndex], Math.random(), Math.random(), Math.random());

  const group = new THREE.Group();
  group.position.set(pos.x, 0, pos.z);

  const sphereMat = new THREE.MeshStandardMaterial({
    color: type.color,
    emissive: type.emissive,
    emissiveIntensity: type.emissiveIntensity,
  });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(type.radius, 20, 14),
    sphereMat,
  );
  sphere.position.y = pos.y;
  group.add(sphere);

  // Stand reaches from the ground to the sphere's underside. Guarded so a
  // future low Y_MIN can never produce a zero/negative-height cylinder.
  const standH = Math.max(0.05, pos.y - type.radius);
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, standH, 8),
    new THREE.MeshStandardMaterial({ color: type.standColor }),
  );
  stand.position.y = standH / 2;
  group.add(stand);

  sceneRef.add(group);

  const rec = {
    type,
    group,
    sphere,
    slotIndex,
    popping: false,
    popT: 0,
    baseIntensity: type.emissiveIntensity,
  };
  records.push(rec);
  bySphere.set(sphere, rec);
}

export function initTargets(scene) {
  sceneRef = scene;
  const type = TARGET_TYPES.range_orb;

  // Distinct starting slots via Fisher–Yates shuffle.
  const indices = [...Array(SLOTS.length).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let n = 0; n < CONFIG.TARGETS_LIVE; n++) {
    spawn(indices[n], type);
  }
}

// Only living targets are shootable — a popping target can't be double-hit.
export function getHittables() {
  return records.filter((r) => !r.popping).map((r) => r.sphere);
}

export function hitTarget(sphere) {
  const rec = bySphere.get(sphere);
  if (!rec || rec.popping) return false;

  rec.popping = true;
  rec.popT = 0;

  // Gridshot rule: the replacement appears IMMEDIATELY (no pause in the
  // flow), somewhere that is neither occupied nor the spot just vacated —
  // a respawn on the same slot reads as "nothing happened".
  spawn(pickFreeSlot(rec.slotIndex), rec.type);
  return true;
}

export function updateTargets(dtMs) {
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i];
    if (!rec.popping) continue;

    rec.popT += dtMs;
    const k = Math.min(1, rec.popT / CONFIG.POP_MS);
    rec.sphere.scale.setScalar(1 + 0.6 * k);
    rec.sphere.material.emissiveIntensity = rec.baseIntensity * (1 + 2 * k);

    if (k >= 1) {
      sceneRef.remove(rec.group);
      // Placeholder meshes are created per-spawn — dispose so a long session
      // doesn't leak GPU resources.
      rec.sphere.geometry.dispose();
      rec.sphere.material.dispose();
      rec.group.children.forEach((child) => {
        if (child !== rec.sphere) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
      bySphere.delete(rec.sphere);
      records.splice(i, 1);
    }
  }
}
