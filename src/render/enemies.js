// render/enemies.js — enemy lifecycle: build the blocky proto-zombie, steer
// it toward the player, drive the procedural shamble, take damage, die
// (fall over), fight back with a telegraphed swipe — and, pass 6, coexist:
// spawn positions come from the wave manager and living zombies push apart
// so a wave arrives as a group, not a merged clump.

import * as THREE from '../../lib/three.module.js';
import { ENEMY_TYPES } from '../data/enemyTypes.js';
import { WAVES } from '../data/waveTable.js';
import { buildBody } from './enemyBody.js';

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

  const { group, parts, materials } = buildBody(type);
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
    // Leg-swing blend (pass 7a follow-up): eases 1 when walking, 0 when
    // rooted (attack/stagger/arrived) so legs PLANT instead of freezing
    // mid-stride during the attack telegraph.
    legBlend: 0,
    elbowFactor: 1, // scales the elbow droop; attack phases drive it (7a.2)
    // Idle sway phase is ACCUMULATED, never scaled (7a.7 fix): multiplying
    // the raw elapsed time by a changing blend swept the phase through
    // dozens of radians whenever legBlend moved — the whole-body shake on
    // every shot and strike. An integral can't jump.
    idlePhase: 0,
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
  // Position rides along so FX can place a floor pool under the kill —
  // an extra arg, so existing id-only listeners are unaffected.
  if (onEnemyKilledCb) {
    onEnemyKilledCb(rec.type.id, {
      x: rec.group.position.x,
      z: rec.group.position.z,
    });
  }
}

function setFlash(rec, intensity) {
  for (const m of rec.materials) {
    // The unlit eye material has no .emissive — skip it, so eyes glow their
    // own color through a flinch instead of crashing the first hit.
    if (!m.emissive) continue;
    if (intensity > 0) m.emissive.setHex(0xff2222);
    m.emissiveIntensity = intensity;
  }
}

function setArms(rec, rotX) {
  rec.parts.armL.rotation.x = rotX;
  rec.parts.armR.rotation.x = rotX;
}

// Pure lookup, exported for the suite: which damage a part deals for a type.
// Untagged meshes and missing tables fall back to torso-tier 1 — a tagging
// slip must never zero the gun.
export function partDamage(type, part) {
  const HB = type.HITBOX;
  if (part === 'head') return HB?.HEAD ?? 1;
  if (part === 'limb') return HB?.LIMB ?? 1;
  return HB?.TORSO ?? 1;
}

// Returns null on a dead/unknown mesh; on a landed hit returns
// { part, killed } — truthy, so old boolean-style callers keep working.
export function damageEnemy(mesh) {
  const rec = byMesh.get(mesh);
  if (!rec || rec.dying) return null;

  const part = mesh.userData.part || 'torso';
  rec.hp -= partDamage(rec.type, part);
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

  const killed = rec.hp <= 0;
  if (killed) startDeath(rec);
  return { part, killed };
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
    // Arm rest pose comes from the body registry (guarded: a type without a
    // BODY block falls back to the old straight-forward π/2). Every arm
    // animation anchors HERE so the rest pose is one data value.
    const REST = type.BODY?.ARM?.REST_RAD ?? Math.PI / 2;

    // — Attack cycle: the arms belong to the attack while a phase runs.
    if (rec.attackPhase) {
      rec.attackT += dtMs;
      if (rec.attackPhase === 'windup') {
        const k = Math.min(1, rec.attackT / AT.WINDUP_MS);
        setArms(rec, REST - AT.REAR_RAD * k); // the tell: arms RAISE overhead (7a.3)
        rec.elbowFactor = 1 + 0.4 * k; // elbows cock deeper with the rear-back
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
        setArms(rec, REST + AT.THRUST_RAD * (1 - k)); // slam DOWN, then ease back up
        rec.elbowFactor = 1 - k; // elbows EXTEND — the swipe becomes a lunge
        if (k >= 1) {
          rec.attackPhase = 'recover';
          rec.attackT = 0;
        }
      } else { // recover
        setArms(rec, REST);
        rec.elbowFactor = Math.min(1, rec.attackT / AT.RECOVER_MS); // droop returns
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
    let walking = false;
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
        walking = true;
      }
    }
    // Legs blend in while walking and plant when rooted; the ~8/s rate
    // settles in ~0.15 s — fast enough that the attack stance reads planted
    // before the windup tell finishes.
    const legTarget = walking ? 1 : 0;
    rec.legBlend += (legTarget - rec.legBlend) * Math.min(1, dtMs * 0.008);

    // — Procedural shamble. Bob and sway are locked to distance WALKED so
    // stride stays consistent if WALK_SPEED is retuned; sway blends in a slow
    // time term so a stopped zombie still breathes instead of freezing.
    const A = type.ANIM;
    const limp = A.LIMP ?? 0;
    // Stride phase drives everything below (legs, knees, the dip) so the
    // gait stays coherent under any retune.
    const p = rec.walked * A.BOB_FREQ;
    // The limp dip (7a.6): the old symmetric |sin| bob VAULTED the body over
    // each step — at slow cadence that read as skipping. An injured walk
    // does the opposite: the body stays level and DROPS once per stride as
    // weight lands on the bad right leg (= while the good left leg swings).
    // BOB_AMP is the dip depth; legBlend keeps a standing zombie at 0.
    group.position.y =
      -A.BOB_AMP * Math.max(0, Math.sin(p - Math.PI / 2)) * rec.legBlend;
    // Sway is stride-locked while walking; the idle breathing advances as an
    // INTEGRATED phase (rate scaled by stillness) — continuous by
    // construction, so blend transitions can never kick the body (7a.7).
    rec.idlePhase += dtMs * A.IDLE_SWAY_FREQ * (1 - rec.legBlend);
    // Weight lives on the GOOD left leg (7a.8): a constant roll bias on top
    // of the sway — positive rotation.z tips the top toward −X, the good
    // side. 0.16 rad at LIMP 1 is structural; LIMP scales it.
    group.rotation.z =
      Math.sin(rec.walked * A.SWAY_FREQ + rec.idlePhase) * A.SWAY_AMP
      + limp * 0.16 * rec.legBlend;
    group.rotation.x = A.LEAN;

    // Leg swing (pass 7a follow-up): alternating hip swing at BOB_FREQ so
    // each step lands on a bob peak — stride-locked like everything else.
    // Knees (7a.2): a bend pulse lagged a QUARTER STRIDE behind the thigh
    // (structural constant, like the YXZ order — the knee bends mid-swing
    // and straightens at the plant), riding on the permanent KNEE_REST
    // shuffle-crouch. max(0,·) keeps knees from ever bending forward.
    // Guarded: an old parts map without legs/shins simply keeps them still.
    if (rec.parts.legL && rec.parts.legR) {
      const swing = Math.sin(p) * (A.LEG_SWING ?? 0) * rec.legBlend;
      rec.parts.legL.rotation.x = swing;
      // LITERAL drag (7a.8): the bad leg never steps — no swing component at
      // all. It PINS at a backward trail and gets pulled along by the body.
      rec.parts.legR.rotation.x = limp > 0
        ? limp * 0.4 * rec.legBlend
        : -swing;
      if (rec.parts.shinL && rec.parts.shinR) {
        const KNEE_LAG = Math.PI / 2;
        const pulse = (A.KNEE_BEND ?? 0) * rec.legBlend;
        rec.parts.shinL.rotation.x =
          (A.KNEE_REST ?? 0) + pulse * Math.max(0, Math.sin(p - KNEE_LAG));
        // The dragging shin (7a.8): locked at a deep backward cock — with
        // the pinned thigh above, the toe points down and scrapes the
        // ground as the body pulls the whole leg. 0.8 rad at LIMP 1.
        rec.parts.shinR.rotation.x =
          (A.KNEE_REST ?? 0) + limp * 0.8 * rec.legBlend;
      }
    }

    // The idle arm wobble only runs when the attack doesn't own the arms.
    if (!rec.attackPhase) {
      const wob =
        Math.sin(rec.walked * A.SWAY_FREQ * 1.7 + rec.t * A.IDLE_SWAY_FREQ) * A.ARM_WOBBLE;
      rec.parts.armL.rotation.x = REST + wob;
      rec.parts.armR.rotation.x = REST - wob;
      rec.elbowFactor = 1;
    }
    // Elbow droop rides whatever the arms are doing (attack phases scale the
    // factor: cock on windup, straighten through the strike). Guarded for an
    // old parts map without forearms.
    if (rec.parts.foreL && rec.parts.foreR) {
      const elbow = (A.ELBOW_BEND ?? 0) * rec.elbowFactor;
      rec.parts.foreL.rotation.x = elbow;
      rec.parts.foreR.rotation.x = elbow;
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
