// render/casings.js — ejected brass (pass 8.4): every real shot flings a
// small casing out of the gun's ejection port to the player's right; it
// tumbles in flight, bounces once off the floor, rests a few seconds, then
// shrinks away. Pooled and hard-capped like bloodFX — no allocation during
// play, fixed worst-case cost, all code-built geometry.
//
// Factory-init pattern, no module-scope side effects: suite-import safe.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

// ————— Pure math (suite-tested) —————

// The landed casing's life as a pure function of time on the ground: resting
// at full scale, then shrinking, then reclaimable. Boundaries are relative to
// the config timings, so retuning LINGER/VANISH never breaks the suite.
export function landedScale(t, lingerMs, vanishMs) {
  if (t < lingerMs) return { phase: 'resting', scale: 1 };
  const v = t - lingerMs;
  if (v < vanishMs) return { phase: 'vanishing', scale: 1 - v / vanishMs };
  return { phase: 'done', scale: 0 };
}

// ————— Stateful pooled casings —————

let sceneRef = null;
const casings = []; // { mesh, vx, vy, vz, wx, wy, wz, bounced, landed, landedT, active }

export function initCasings(scene) {
  sceneRef = scene;
  const C = CONFIG.CASINGS;
  // A slightly elongated box reads as a shell; one shared geometry + one
  // shared material for the whole pool (they vanish by scaling, not fading —
  // no transparency, no per-casing material).
  const geo = new THREE.BoxGeometry(C.SIZE * 0.5, C.SIZE * 0.5, C.SIZE);
  const mat = new THREE.MeshBasicMaterial({ color: C.COLOR });
  for (let i = 0; i < C.MAX; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    casings.push({
      mesh, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0,
      bounced: false, landed: false, landedT: 0, active: false,
    });
  }
}

// Eject from a world-space port position, flung to the PLAYER'S right.
// Right vector from yaw is the MEASURED formula (see PROJECT_HANDOFF §9):
// right = (cos yaw, −sin yaw) as (dx, dz) — verified against r185.
export function spawnCasing(pos, yaw) {
  if (!sceneRef) return;
  const C = CONFIG.CASINGS;
  let slot = casings.find((c) => !c.active);
  if (!slot) {
    // Pool exhausted: reclaim the one that's been on the ground longest —
    // it was closest to vanishing anyway.
    slot = casings.reduce((a, b) => (a.landedT >= b.landedT ? a : b));
  }
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const j = () => (Math.random() - 0.5) * C.JITTER;
  slot.active = true;
  slot.bounced = false;
  slot.landed = false;
  slot.landedT = 0;
  slot.mesh.visible = true;
  slot.mesh.position.copy(pos);
  slot.mesh.scale.setScalar(1);
  slot.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  slot.vx = rx * C.EJECT_SPEED + j();
  slot.vy = C.EJECT_UP + j();
  slot.vz = rz * C.EJECT_SPEED + j();
  slot.wx = (Math.random() - 0.5) * 2 * C.SPIN;
  slot.wy = (Math.random() - 0.5) * 2 * C.SPIN;
  slot.wz = (Math.random() - 0.5) * 2 * C.SPIN;
}

export function updateCasings(dtMs) {
  const C = CONFIG.CASINGS;
  const dt = dtMs / 1000;
  const restY = C.SIZE / 2;

  for (const c of casings) {
    if (!c.active) continue;

    if (c.landed) {
      c.landedT += dtMs;
      const { phase, scale } = landedScale(c.landedT, C.LINGER_MS, C.VANISH_MS);
      if (phase === 'done') {
        c.active = false;
        c.mesh.visible = false;
      } else {
        c.mesh.scale.setScalar(scale);
      }
      continue;
    }

    // Airborne: gravity + tumble.
    c.vy -= C.GRAVITY * dt;
    c.mesh.position.x += c.vx * dt;
    c.mesh.position.y += c.vy * dt;
    c.mesh.position.z += c.vz * dt;
    c.mesh.rotation.x += c.wx * dt;
    c.mesh.rotation.y += c.wy * dt;
    c.mesh.rotation.z += c.wz * dt;

    if (c.mesh.position.y <= restY && c.vy < 0) {
      if (!c.bounced) {
        // The single bounce: most of the energy dies, the hop is what sells
        // "brass hitting the ground". Horizontal damps too so it doesn't skate.
        c.bounced = true;
        c.mesh.position.y = restY;
        c.vy = -c.vy * C.RESTITUTION;
        c.vx *= 0.5;
        c.vz *= 0.5;
      } else {
        c.landed = true;
        c.landedT = 0;
        c.mesh.position.y = restY;
      }
    }
  }
}

// Fresh round: brass belongs to the round that fired it.
export function resetCasings() {
  for (const c of casings) {
    c.active = false;
    c.mesh.visible = false;
  }
}
