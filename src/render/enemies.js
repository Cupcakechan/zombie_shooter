// render/enemies.js — enemy lifecycle: build the blocky proto-zombie, steer
// it toward the player, drive the procedural shamble (Option B: fixed
// arms-out pose + whole-body motion). Same module shape as targets.js:
// module-level records, spawn/update/reset. Not shootable yet — HP, hit
// reaction, and death are pass 4.

import * as THREE from '../../lib/three.module.js';
import { ENEMY_TYPES } from '../data/enemyTypes.js';

// ————— Pure movement math (suite-tested) —————

// How far the enemy may close THIS frame: capped by speed, and clamped so it
// lands exactly ON the stop ring, never inside it (and never moves backward
// if it's already inside — pass 5's attack shove can put it there).
export function advanceDistance(currentDist, speedMps, dtMs, stopDist) {
  const step = (speedMps * dtMs) / 1000;
  return Math.min(step, Math.max(0, currentDist - stopDist));
}

// ————— Stateful enemy management —————

let sceneRef = null;
const records = []; // { type, group, parts, walked, t }

function buildProtoBody(type) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: type.COLORS.SKIN, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: type.COLORS.CLOTH, roughness: 0.95 });

  // Body faces +Z. MEASURED (2026-07-11): rotation.y = atan2(dx, dz) points a
  // +Z-built body exactly at the player — don't "fix" the axis or the signs.

  // Legs: ground to 0.8
  const legGeo = new THREE.BoxGeometry(0.16, 0.8, 0.16);
  const legL = new THREE.Mesh(legGeo, cloth);
  legL.position.set(-0.12, 0.4, 0);
  const legR = new THREE.Mesh(legGeo.clone(), cloth);
  legR.position.set(0.12, 0.4, 0);
  group.add(legL, legR);

  // Torso: 0.8 to 1.5
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), cloth);
  torso.position.set(0, 1.15, 0);
  group.add(torso);

  // Head — with the classic zombie head-cock
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), skin);
  head.position.set(0, 1.66, 0);
  head.rotation.z = 0.1;
  group.add(head);

  // Arms — raised straight forward (+Z). Geometry is translated so the mesh
  // origin sits at the SHOULDER: rotation.x then pivots the whole arm there,
  // which is what makes the wobble read as an arm and not a propeller.
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  armGeo.translate(0, 0.3, 0); // arm extends +Y from its origin
  const armL = new THREE.Mesh(armGeo, skin);
  armL.position.set(-0.22, 1.38, 0.1);
  armL.rotation.x = Math.PI / 2; // +Y → +Z: arm points forward
  const armR = new THREE.Mesh(armGeo.clone(), skin);
  armR.position.set(0.22, 1.38, 0.1);
  armR.rotation.x = Math.PI / 2;
  group.add(armL, armR);

  return { group, parts: { armL, armR } };
}

export function initEnemies(scene) {
  sceneRef = scene;
}

export function spawnEnemy(typeId) {
  const type = ENEMY_TYPES[typeId];
  // Graceful: an unknown id logs and skips — a registry typo must never crash.
  if (!type) {
    console.error(`enemies.js: unknown enemy type '${typeId}'`);
    return null;
  }
  if (!sceneRef) return null;

  const { group, parts } = buildProtoBody(type);
  group.position.set(type.SPAWN.x, 0, type.SPAWN.z);
  // Yaw (Y) applied first, then lean (X), then sway (Z) — same YXZ pattern
  // as the camera, so the three rotations compose without fighting.
  group.rotation.order = 'YXZ';
  sceneRef.add(group);

  records.push({ type, group, parts, walked: 0, t: 0 });
  return group;
}

export function updateEnemies(dtMs, playerPos) {
  for (const rec of records) {
    const { type, group } = rec;
    rec.t += dtMs;

    const dx = playerPos.x - group.position.x;
    const dz = playerPos.z - group.position.z;
    const dist = Math.hypot(dx, dz);

    // Always face the player, moving or stopped (yaw only).
    group.rotation.y = Math.atan2(dx, dz);

    const step = advanceDistance(dist, type.WALK_SPEED, dtMs, type.STOP_DISTANCE);
    if (step > 0 && dist > 1e-6) {
      group.position.x += (dx / dist) * step;
      group.position.z += (dz / dist) * step;
      rec.walked += step;
    }

    // — Procedural shamble. Bob and sway are locked to distance WALKED so
    // stride stays consistent if WALK_SPEED is retuned; sway blends in a slow
    // time term so a stopped zombie still breathes instead of freezing.
    const A = type.ANIM;
    group.position.y = Math.abs(Math.sin(rec.walked * A.BOB_FREQ)) * A.BOB_AMP;
    group.rotation.z =
      Math.sin(rec.walked * A.SWAY_FREQ + rec.t * A.IDLE_SWAY_FREQ) * A.SWAY_AMP;
    group.rotation.x = A.LEAN;

    const wob =
      Math.sin(rec.walked * A.SWAY_FREQ * 1.7 + rec.t * A.IDLE_SWAY_FREQ) * A.ARM_WOBBLE;
    rec.parts.armL.rotation.x = Math.PI / 2 + wob;
    rec.parts.armR.rotation.x = Math.PI / 2 - wob;
  }
}

function disposeEnemy(group) {
  group.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose(); // double-dispose of shared materials is safe
    }
  });
  sceneRef.remove(group);
}

export function resetEnemies() {
  for (const rec of records) disposeEnemy(rec.group);
  records.length = 0;
}
