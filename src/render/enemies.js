// render/enemies.js — enemy lifecycle: build the blocky proto-zombie, steer
// it toward the player, drive the procedural shamble, take damage, die
// (fall over), fight back with a telegraphed swipe — and, pass 6, coexist:
// spawn positions come from the wave manager and living zombies push apart
// so a wave arrives as a group, not a merged clump.

import * as THREE from '../../lib/three.module.js';
import { ENEMY_TYPES } from '../data/enemyTypes.js';
import { WAVES } from '../data/waveTable.js';

// ————— Pure math (suite-tested) —————

// How far the enemy may close THIS frame: capped by speed, and clamped so it
// lands exactly ON the stop ring, never inside it (knockback can put it
// slightly outside; it simply walks back in).
export function advanceDistance(currentDist, speedMps, dtMs, stopDist) {
  const step = (speedMps * dtMs) / 1000;
  return Math.min(step, Math.max(0, currentDist - stopDist));
}

// The death timeline as a pure function of elapsed death-time and the
// type's DEATH timings — boundaries are relative to the registry values, so
// retuning the timings never breaks the suite.
export function deathPhase(dieT, D) {
  if (dieT < D.FALL_MS) return { phase: 'falling', k: dieT / D.FALL_MS };
  const t2 = dieT - D.FALL_MS;
  if (t2 < D.LIE_MS) return { phase: 'lying', k: t2 / D.LIE_MS };
  const t3 = t2 - D.LIE_MS;
  if (t3 < D.FADE_MS) return { phase: 'fading', k: t3 / D.FADE_MS };
  return { phase: 'done', k: 1 };
}

// ————— Stateful enemy management —————

let sceneRef = null;
let onPlayerHitCb = null;
let onEnemyKilledCb = null;
const records = []; // see spawnEnemy for the record shape
const byMesh = new Map(); // any body mesh -> record

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
  // which is what makes wobble and attack swings read as arms.
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  armGeo.translate(0, 0.3, 0); // arm extends +Y from its origin
  const armL = new THREE.Mesh(armGeo, skin);
  armL.position.set(-0.22, 1.38, 0.1);
  armL.rotation.x = Math.PI / 2; // +Y → +Z: arm points forward
  const armR = new THREE.Mesh(armGeo.clone(), skin);
  armR.position.set(0.22, 1.38, 0.1);
  armR.rotation.x = Math.PI / 2;
  group.add(armL, armR);

  return { group, parts: { armL, armR }, materials: [skin, cloth] };
}

export function initEnemies(scene, { onPlayerHit, onEnemyKilled } = {}) {
  sceneRef = scene;
  onPlayerHitCb = onPlayerHit || null;
  onEnemyKilledCb = onEnemyKilled || null;
}

export function spawnEnemy(typeId, pos, { speedMult = 1 } = {}) {
  const type = ENEMY_TYPES[typeId];
  // Graceful: an unknown id logs and skips — a registry typo must never crash.
  if (!type) {
    console.error(`enemies.js: unknown enemy type '${typeId}'`);
    return null;
  }
  if (!sceneRef) return null;
  // Graceful: a missing position falls back to back-centre rather than NaN.
  const at = pos || { x: 0, z: -28 };

  const { group, parts, materials } = buildProtoBody(type);
  group.position.set(at.x, 0, at.z);
  // Yaw (Y) applied first, then lean (X), then sway (Z) — same YXZ pattern
  // as the camera, so the three rotations compose without fighting.
  group.rotation.order = 'YXZ';
  sceneRef.add(group);

  const rec = {
    type, group, parts, materials,
    speedMult,
    meshes: [],
    hp: type.HP,
    walked: 0, t: 0,
    flashT: 0, staggerT: 0,
    attackPhase: null, attackT: 0, cooldownT: 0,
    dying: false, dieT: 0,
    // Spawn fade-in (pass 8.1): counts down to 0 = fully emerged. Guarded —
    // a type without a SPAWN block simply appears at full opacity, no crash.
    spawnFadeT: type.SPAWN?.FADE_MS ?? 0,
  };
  // Emerging from the fog bank: start invisible; the update loop fades in.
  if (rec.spawnFadeT > 0) {
    for (const m of rec.materials) {
      m.transparent = true;
      m.opacity = 0;
    }
  }
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData.kind = 'enemy';
      rec.meshes.push(child);
      byMesh.set(child, rec);
    }
  });
  records.push(rec);
  return group;
}

// Living body meshes only — a dying zombie is not a valid raycast hit, so
// shots pass through the corpse to whatever's behind it.
export function getEnemyHittables() {
  const out = [];
  for (const rec of records) {
    if (!rec.dying) out.push(...rec.meshes);
  }
  return out;
}

// Living zombies as solid circles for the player's movement resolve —
// corpses are walkable (stepping over the fallen is part of the fantasy).
export function getLivingPositions() {
  const out = [];
  for (const rec of records) {
    if (rec.dying) continue;
    out.push({
      x: rec.group.position.x,
      z: rec.group.position.z,
      radius: rec.type.BODY_RADIUS,
    });
  }
  return out;
}

function startDeath(rec) {
  rec.dying = true;
  rec.dieT = 0;
  rec.flashT = 0;
  rec.attackPhase = null;
  setFlash(rec, 0);
  // A zombie killed mid-emergence snaps to full opacity: the death fade
  // assumes it starts from opaque, and a half-ghost corpse reads as a bug.
  if (rec.spawnFadeT > 0) {
    rec.spawnFadeT = 0;
    for (const m of rec.materials) {
      m.transparent = false;
      m.opacity = 1;
    }
  }
  // Zero the shamble pose so the fall pivots cleanly around the feet.
  rec.group.rotation.z = 0;
  rec.group.position.y = 0;
  if (onEnemyKilledCb) onEnemyKilledCb(rec.type.id);
}

function setFlash(rec, intensity) {
  for (const m of rec.materials) {
    if (intensity > 0) m.emissive.setHex(0xff2222);
    m.emissiveIntensity = intensity;
  }
}

function setArms(rec, rotX) {
  rec.parts.armL.rotation.x = rotX;
  rec.parts.armR.rotation.x = rotX;
}

// Returns true if the hit landed on a living enemy.
export function damageEnemy(mesh) {
  const rec = byMesh.get(mesh);
  if (!rec || rec.dying) return false;

  rec.hp -= 1;
  rec.flashT = rec.type.COMBAT.FLINCH_MS;
  rec.staggerT = rec.type.COMBAT.STAGGER_MS;

  // Counterplay (pinned 5b): a hit CANCELS an in-progress attack — including
  // mid-windup — and the cooldown set at attack start keeps running, so the
  // zombie pays a full cycle for the failed attempt.
  rec.attackPhase = null;

  // Knockback straight away from the player. The body always faces the
  // player (yaw), so "away" is the facing direction reversed.
  const yaw = rec.group.rotation.y;
  rec.group.position.x -= Math.sin(yaw) * rec.type.COMBAT.KNOCKBACK;
  rec.group.position.z -= Math.cos(yaw) * rec.type.COMBAT.KNOCKBACK;

  if (rec.hp <= 0) startDeath(rec);
  return true;
}

export function updateEnemies(dtMs, playerPos) {
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i];
    const { type, group } = rec;

    // — Dying: run the death timeline and nothing else.
    if (rec.dying) {
      rec.dieT += dtMs;
      const { phase, k } = deathPhase(rec.dieT, type.DEATH);
      if (phase === 'falling') {
        // Accelerating fall (k²) from the walk lean to flat on the ground.
        group.rotation.x = type.ANIM.LEAN + (Math.PI / 2 - type.ANIM.LEAN) * k * k;
        group.position.y = type.DEATH.CORPSE_LIFT * k * k;
      } else if (phase === 'lying') {
        group.rotation.x = Math.PI / 2;
        group.position.y = type.DEATH.CORPSE_LIFT;
      } else if (phase === 'fading') {
        for (const m of rec.materials) {
          m.transparent = true;
          m.opacity = 1 - k;
        }
      } else {
        disposeEnemy(rec);
        records.splice(i, 1);
      }
      continue;
    }

    // — Alive —
    rec.t += dtMs;
    rec.cooldownT = Math.max(0, rec.cooldownT - dtMs);

    // Spawn fade-in: opacity tracks time since spawn. When done, transparency
    // switches OFF again — a permanently transparent body pays sort costs and
    // can draw wrongly against the fog-bank curtains.
    if (rec.spawnFadeT > 0) {
      rec.spawnFadeT = Math.max(0, rec.spawnFadeT - dtMs);
      const total = type.SPAWN?.FADE_MS ?? 1;
      const k = 1 - rec.spawnFadeT / total;
      for (const m of rec.materials) m.opacity = k;
      if (rec.spawnFadeT === 0) {
        for (const m of rec.materials) {
          m.transparent = false;
          m.opacity = 1;
        }
      }
    }

    const dx = playerPos.x - group.position.x;
    const dz = playerPos.z - group.position.z;
    const dist = Math.hypot(dx, dz);

    // Always face the player, moving or stopped (yaw only).
    group.rotation.y = Math.atan2(dx, dz);

    // Hit flash decays over FLINCH_MS.
    if (rec.flashT > 0) {
      rec.flashT = Math.max(0, rec.flashT - dtMs);
      setFlash(rec, (rec.flashT / type.COMBAT.FLINCH_MS) * 0.9);
    }

    const AT = type.ATTACK;

    // — Attack cycle: the arms belong to the attack while a phase runs.
    if (rec.attackPhase) {
      rec.attackT += dtMs;
      if (rec.attackPhase === 'windup') {
        const k = Math.min(1, rec.attackT / AT.WINDUP_MS);
        setArms(rec, Math.PI / 2 + AT.REAR_RAD * k); // the tell: arms rear back
        if (k >= 1) {
          rec.attackPhase = 'strike';
          rec.attackT = 0;
          // Damage lands at the START of the strike — the windup was the
          // player's window to cancel it (shoot) or, now that the player
          // can move, DODGE it: out of reach at this moment = a whiff.
          const inRange = dist <= type.STOP_DISTANCE + AT.RANGE_SLACK;
          if (inRange && onPlayerHitCb) onPlayerHitCb(AT.DAMAGE);
        }
      } else if (rec.attackPhase === 'strike') {
        const k = Math.min(1, rec.attackT / AT.STRIKE_MS);
        setArms(rec, Math.PI / 2 - AT.THRUST_RAD * (1 - k)); // thrust, then ease back
        if (k >= 1) {
          rec.attackPhase = 'recover';
          rec.attackT = 0;
        }
      } else { // recover
        setArms(rec, Math.PI / 2);
        if (rec.attackT >= AT.RECOVER_MS) rec.attackPhase = null;
      }
    } else {
      // Start an attack when close enough, off cooldown, and not staggered.
      const inReach = dist <= type.STOP_DISTANCE + AT.RANGE_SLACK;
      if (inReach && rec.cooldownT <= 0 && rec.staggerT <= 0) {
        rec.attackPhase = 'windup';
        rec.attackT = 0;
        rec.cooldownT = AT.COOLDOWN_MS; // start-to-start pacing
      }
    }

    // Stagger pauses movement; attacks also root the zombie in place.
    if (rec.staggerT > 0) {
      rec.staggerT -= dtMs;
    } else if (!rec.attackPhase) {
      const step = advanceDistance(
        dist, type.WALK_SPEED * rec.speedMult, dtMs, type.STOP_DISTANCE,
      );
      if (step > 0 && dist > 1e-6) {
        group.position.x += (dx / dist) * step;
        group.position.z += (dz / dist) * step;
        rec.walked += step;
      }
    }

    // — Procedural shamble. Bob and sway are locked to distance WALKED so
    // stride stays consistent if WALK_SPEED is retuned; sway blends in a slow
    // time term so a stopped zombie still breathes instead of freezing.
    const A = type.ANIM;
    group.position.y = Math.abs(Math.sin(rec.walked * A.BOB_FREQ)) * A.BOB_AMP;
    group.rotation.z =
      Math.sin(rec.walked * A.SWAY_FREQ + rec.t * A.IDLE_SWAY_FREQ) * A.SWAY_AMP;
    group.rotation.x = A.LEAN;

    // The idle arm wobble only runs when the attack doesn't own the arms.
    if (!rec.attackPhase) {
      const wob =
        Math.sin(rec.walked * A.SWAY_FREQ * 1.7 + rec.t * A.IDLE_SWAY_FREQ) * A.ARM_WOBBLE;
      rec.parts.armL.rotation.x = Math.PI / 2 + wob;
      rec.parts.armR.rotation.x = Math.PI / 2 - wob;
    }
  }

  // — Crowd separation: overlapping LIVING zombies push apart so a wave
  // arrives as a group, not a merged clump. O(n²), fine at this scale
  // (pooling/partitioning waits for a MEASURED frame drop, per the report).
  const sep = WAVES.CROWD.SEPARATION_RADIUS;
  for (let a = 0; a < records.length; a++) {
    const ra = records[a];
    if (ra.dying) continue;
    for (let b = a + 1; b < records.length; b++) {
      const rb = records[b];
      if (rb.dying) continue;
      let dx = rb.group.position.x - ra.group.position.x;
      let dz = rb.group.position.z - ra.group.position.z;
      let d = Math.hypot(dx, dz);
      if (d >= sep) continue;
      if (d < 1e-6) { dx = 1; dz = 0; d = 1; } // exact overlap: pick an axis
      const push = (sep - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      ra.group.position.x -= nx * push;
      ra.group.position.z -= nz * push;
      rb.group.position.x += nx * push;
      rb.group.position.z += nz * push;
    }
  }
}

function disposeEnemy(rec) {
  for (const mesh of rec.meshes) byMesh.delete(mesh);
  rec.group.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose(); // double-dispose of shared materials is safe
    }
  });
  sceneRef.remove(rec.group);
}

export function resetEnemies() {
  for (const rec of records) disposeEnemy(rec);
  records.length = 0;
}
