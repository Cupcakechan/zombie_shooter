// render/enemies.js — enemy lifecycle: build the blocky proto-zombie, steer
// it toward the player, drive the procedural shamble, take damage, die
// (fall over), fight back with a telegraphed swipe — and, pass 6, coexist:
// spawn positions come from the wave manager and living zombies push apart
// so a wave arrives as a group, not a merged clump.

import * as THREE from '../../lib/three.module.js';
import { ENEMY_TYPES } from '../data/enemyTypes.js';
import { WAVES } from '../data/waveTable.js';
import { buildBody } from './enemyBody.js';
import { resolveBodyWithReach, segmentClearOfAABBs } from '../game/movement.js';
import { createSecondOrder } from '../game/secondOrder.js';
import { worldToCell, cellToWorld } from '../game/mapGrid.js';
import { CONFIG } from '../config.js';

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

// Rate-limited turn toward a target yaw (4.3 feel fix): the flow field's
// directions are 8-way QUANTIZED, so assigning yaw directly snapped the
// body 45–90° at every cell boundary. This turns through the angle
// instead, shortest arc — atan2(sin,cos) wraps the difference into
// (−π, π] without modulo seam bugs — clamped to maxStep per call. Pure:
// suite Section 14 proves the wrap, the clamp, and exact arrival.
export function turnToward(current, target, maxStep) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-maxStep, Math.min(maxStep, diff));
}

// ————— Stateful enemy management —————

let sceneRef = null;
let mapColliders = []; // set by main per map (4.2); empty = open arena
let onPlayerHitCb = null;
let onEnemyKilledCb = null;
const records = []; // see spawnEnemy for the record shape
const byMesh = new Map(); // any body mesh -> record

export function initEnemies(scene, { onPlayerHit, onEnemyKilled } = {}) {
  sceneRef = scene;
  onPlayerHitCb = onPlayerHit || null;
  onEnemyKilledCb = onEnemyKilled || null;
}

// The map's wall colliders (4.2). Zombies can't pass walls either; with the
// flow field (4.3) they route around buildings and through doorways, and
// still press against walls only on the final beeline approach.
export function setMapColliders(boxes) {
  mapColliders = boxes || [];
}

// The flow field (4.3): { field, map, grid } from main, or null to clear
// (Range has no map; null also means "degrade to the pre-4.3 beeline", so
// a missing field can never strand a wave).
let nav = null;
export function setFlowField(navigation) {
  nav = navigation || null;
}

// Window queues (4.3b.1): each window holds at most ONE climber and ONE
// waiter. A third arrival finds the window congested and routes elsewhere
// — main rebuilds the field without congested windows (see
// getCongestedWindows). Keys are 'c,r' of the window cell.
const windowSlots = new Map(); // key -> { climber: rec|null, waiter: rec|null }

function releaseWait(rec) {
  if (!rec.waitingAt) return;
  const slot = windowSlots.get(rec.waitingAt.key);
  if (slot && slot.waiter === rec) slot.waiter = null;
  rec.waitingAt = null;
}

function releaseClimb(rec) {
  if (!rec.vault) return;
  const slot = windowSlots.get(rec.vault.key);
  if (slot && slot.climber === rec) slot.climber = null;
}

// Windows whose queue is full — main prices these OUT of the flow field
// so everyone not already committed reroutes ("find a different route").
export function getCongestedWindows() {
  const out = [];
  for (const [key, slot] of windowSlots) {
    if (slot.climber && slot.waiter) out.push(key);
  }
  return out;
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
    // Unit vector toward the player, cached each update (4.3): knockback
    // needs "away from the player" and can no longer derive it from yaw
    // once navigation faces a zombie along its PATH. Zero until the first
    // update — a hit landing that same frame simply skips the knockback.
    towardPlayer: { x: 0, z: 0 },
    // The in-flight window climb (4.3b): null, or the committed script
    // { t, ms, fromX, fromZ, toX, toZ, peakY, yaw, key }.
    vault: null,
    // Queued at a window (4.3b.1): null, or { key, wc, wr, dc, dr } —
    // holding the sill while the window's climber is mid-flight.
    waitingAt: null,
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
    // Hit-flinch squash spring (7c): kicked in damageEnemy, applied to the
    // group scale each frame. Guarded params — a type without them gets a
    // sane spring that's simply never kicked.
    squash: createSecondOrder(
      type.COMBAT.SQUASH_F ?? 5, type.COMBAT.SQUASH_ZETA ?? 0.4, 1, 0,
    ),
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
// corpses are walkable (stepping over the fallen is part of the fantasy),
// and a vaulting body is inside the wall plane, not on the floor (4.3b).
export function getLivingPositions() {
  const out = [];
  for (const rec of records) {
    if (rec.dying || rec.vault) continue;
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
  // Shot off the sill (4.3b): a climber falls back OUTSIDE — its vault
  // start point — so the corpse never lies inside the wall plane. The
  // counterplay payoff for shooting the free-hit window. Either way the
  // window slots free up (4.3b.1) so the queue advances past a corpse.
  releaseWait(rec);
  if (rec.vault) {
    releaseClimb(rec);
    rec.group.position.x = rec.vault.fromX;
    rec.group.position.z = rec.vault.fromZ;
    rec.vault = null;
  }
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
  rec.group.scale.set(1, 1, 1); // the flinch dies with it — corpses fall un-squashed
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
  rec.squash.kick(rec.type.COMBAT.SQUASH_KICK ?? 0); // the physical flinch

  // Counterplay (pinned 5b): a hit CANCELS an in-progress attack — including
  // mid-windup — and the cooldown set at attack start keeps running, so the
  // zombie pays a full cycle for the failed attempt.
  rec.attackPhase = null;

  // Knockback straight away from the player, from the normal CACHED by the
  // update loop — yaw stopped meaning "faces the player" when navigation
  // (4.3) started facing zombies along their path. Same numbers as the old
  // yaw form whenever the zombie IS facing the player (sin/cos of that yaw
  // are exactly dx/dist, dz/dist).
  rec.group.position.x -= rec.towardPlayer.x * rec.type.COMBAT.KNOCKBACK;
  rec.group.position.z -= rec.towardPlayer.z * rec.type.COMBAT.KNOCKBACK;

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
    if (dist > 1e-6) {
      rec.towardPlayer.x = dx / dist;
      rec.towardPlayer.z = dz / dist;
    }

    // — Vaulting (4.3b): a COMMITTED scripted climb through a window. The
    // vault owns the frame: no attacks, no steering, no separation, no
    // wall resolve (the body is legitimately inside the wall plane) — but
    // it stays HITTABLE, and hits kick the squash spring as usual; that
    // free-hit window is the price of window entry. Hits do not interrupt
    // the climb. Killed mid-vault → startDeath drops it back OUTSIDE.
    if (rec.vault) {
      const v = rec.vault;
      v.t += dtMs;
      const k = Math.min(1, v.t / v.ms);
      group.position.x = v.fromX + (v.toX - v.fromX) * k;
      group.position.z = v.fromZ + (v.toZ - v.fromZ) * k;
      // Feet arc over the sill; pitch forward at the top of the haul.
      group.position.y = Math.sin(Math.PI * k) * v.peakY;
      group.rotation.x = type.ANIM.LEAN + 0.35 * Math.sin(Math.PI * k);
      group.rotation.y = turnToward(
        group.rotation.y, v.yaw, (CONFIG.NAV.TURN_RATE * dtMs) / 1000,
      );
      // Flash decay and the squash spring keep running so a shot climber
      // still flinches (frozen springs pop on landing otherwise).
      if (rec.flashT > 0) {
        rec.flashT = Math.max(0, rec.flashT - dtMs);
        setFlash(rec, (rec.flashT / type.COMBAT.FLINCH_MS) * 0.9);
      }
      const vsq = Math.max(-0.2, Math.min(0.5, rec.squash.update(0, dtMs / 1000)));
      group.scale.set(1 + vsq * 0.5, 1 - vsq, 1 + vsq * 0.5);
      if (k >= 1) {
        group.position.y = 0;
        releaseClimb(rec); // the queue advances: the waiter promotes next frame
        rec.vault = null;  // landed inside; normal logic resumes next frame
      }
      continue;
    }

    // Line of sight (4.3 LOS fix): every proximity decision below — the
    // beeline switch, the stop ring, attack start, damage landing — gates
    // on actually SEEING the player. Straight-line distance through a wall
    // froze zombies mid-beeline (a face-on pushout has no tangential
    // component to slide on) and let swipes land across wall corners.
    // No colliders (Range) = always true, so Range is untouched.
    const los = mapColliders.length === 0
      || segmentClearOfAABBs(
        group.position.x, group.position.z, playerPos.x, playerPos.z, mapColliders,
      );

    // Facing is a TARGET now, applied through turnToward below — never
    // assigned directly (the snap Daniel reported). Default target: the
    // player; a field-following step overrides it with the walk direction.
    let targetYaw = Math.atan2(dx, dz);

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
          // player's window to cancel it (shoot), DODGE out of reach, or
          // (4.3) break line of sight around a corner: no LOS = a whiff.
          const inRange = los && dist <= type.STOP_DISTANCE + AT.RANGE_SLACK;
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
      // Start an attack when close enough, VISIBLE (4.3 — no swipes
      // through wall corners), off cooldown, and not staggered.
      const inReach = los && dist <= type.STOP_DISTANCE + AT.RANGE_SLACK;
      if (inReach && rec.cooldownT <= 0 && rec.staggerT <= 0) {
        releaseWait(rec); // a flanked waiter fights — the line moves on
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
      // The stop ring only exists when the player is VISIBLE (4.3): a
      // zombie must never "arrive" at a player it can't reach through a
      // wall — without LOS it keeps navigating.
      const step = advanceDistance(
        dist, type.WALK_SPEED * rec.speedMult, dtMs,
        los ? type.STOP_DISTANCE : 0,
      );
      if (step > 0 && dist > 1e-6) {
        let hold = false;
        // — Queued at a window (4.3b.1): hold the sill while this window's
        // climber is mid-flight. The wait releases the MOMENT the climber
        // slot frees — the trigger check just below then re-runs with the
        // CURRENT field, so promotion and abandonment are the same code
        // path: field still wants the window → claim it and climb; field
        // moved on → walk away. Drifting off the sill (knockback) also
        // releases, with slack so a single shove doesn't churn the queue.
        if (rec.waitingAt) {
          const w = rec.waitingAt;
          const slot = windowSlots.get(w.key);
          const climberBusy = !!(slot && slot.climber);
          let near = false;
          if (nav && climberBusy) {
            const wC = cellToWorld(nav.map, nav.grid, w.wc, w.wr);
            near = Math.hypot(wC.x - group.position.x, wC.z - group.position.z)
              <= CONFIG.NAV.VAULT_TRIGGER + 0.5;
          }
          if (!nav || !climberBusy || !near) {
            releaseWait(rec);
          } else {
            targetYaw = Math.atan2(w.dc, w.dr); // face the sill: the queue telegraph
            hold = true;
          }
        }
        // Direction (4.3): descend the flow field when far OR when the
        // player isn't visible — the beeline is only trusted with a clear
        // line (its face-on wall pushout has no slide component, the
        // corner-tuck freeze). Inside NAV.BEELINE_DIST with LOS, beeline
        // (the final approach). No field / no answer for this cell —
        // graceful: the pre-4.3 behavior. Separation and the wall resolve
        // below then blend/clamp the step exactly as before.
        let mx = dx / dist;
        let mz = dz / dist;
        if (!hold && nav && (!los || dist > CONFIG.NAV.BEELINE_DIST)) {
          const cell = worldToCell(
            nav.map, nav.grid, group.position.x, group.position.z,
          );
          const s = nav.field.stepAt(cell.c, cell.r);
          const dir = nav.field.dirAt(cell.c, cell.r);
          // Vault trigger (4.3b): the path's next cell is a WINDOW, the
          // cell beyond it is open, this type can climb, and we've pressed
          // to the sill (VAULT_TRIGGER sits just past the reach-probe
          // standoff — the suite asserts that ordering, because a trigger
          // INSIDE the standoff would freeze zombies at every window, the
          // 4.3a corner-freeze class all over again).
          if (s && (type.VAULT?.MS ?? 0) > 0
            && nav.grid.at(cell.c + s.dc, cell.r + s.dr) === 'W'
            && nav.grid.walkable(cell.c + 2 * s.dc, cell.r + 2 * s.dr)) {
            const wc = cell.c + s.dc;
            const wr = cell.r + s.dr;
            const wC = cellToWorld(nav.map, nav.grid, wc, wr);
            const wDist = Math.hypot(wC.x - group.position.x, wC.z - group.position.z);
            if (wDist <= CONFIG.NAV.VAULT_TRIGGER) {
              // The latch (4.3b.1): one climber, one waiter, per window.
              const key = `${wc},${wr}`;
              let slot = windowSlots.get(key);
              if (!slot) {
                slot = { climber: null, waiter: null };
                windowSlots.set(key, slot);
              }
              if (!slot.climber) {
                slot.climber = rec;
                if (slot.waiter === rec) slot.waiter = null;
                rec.waitingAt = null;
                const far = cellToWorld(
                  nav.map, nav.grid, cell.c + 2 * s.dc, cell.r + 2 * s.dr,
                );
                rec.vault = {
                  t: 0,
                  ms: type.VAULT.MS,
                  fromX: group.position.x,
                  fromZ: group.position.z,
                  toX: far.x,
                  toZ: far.z,
                  // Feet clear the sill by a boot's height (structural).
                  peakY: (nav.map.WINDOW_SILL_H ?? 1.0) + 0.25,
                  yaw: Math.atan2(s.dc, s.dr),
                  key,
                };
                continue; // the vault owns the body from the next frame
              }
              if (!slot.waiter || slot.waiter === rec) {
                slot.waiter = rec;
                rec.waitingAt = { key, wc, wr, dc: s.dc, dr: s.dr };
                targetYaw = Math.atan2(s.dc, s.dr);
                hold = true;
              }
              // Both slots busy: CONGESTED. Walk the field as-is this
              // frame — main sees the congestion (getCongestedWindows)
              // and rebuilds the field WITHOUT this window, so the route
              // changes underfoot within a frame or two.
            }
          }
          if (!hold && dir) {
            mx = dir.x;
            mz = dir.z;
            targetYaw = Math.atan2(mx, mz); // face the path
          }
        }
        if (!hold) {
          group.position.x += mx * step;
          group.position.z += mz * step;
          rec.walked += step;
          walking = true;
        }
      }
    }
    // Legs blend in while walking and plant when rooted; the ~8/s rate
    // settles in ~0.15 s — fast enough that the attack stance reads planted
    // before the windup tell finishes.
    const legTarget = walking ? 1 : 0;
    rec.legBlend += (legTarget - rec.legBlend) * Math.min(1, dtMs * 0.008);

    // Turn the body toward its target heading at a shambler's pace —
    // movement direction is already correct this frame; only the FACING
    // eases, so path-following never lags the field. A 45° field step
    // resolves in ~0.15 s at the default rate; the brief lean reads as
    // the body carrying its weight through the turn.
    group.rotation.y = turnToward(
      group.rotation.y, targetYaw, (CONFIG.NAV.TURN_RATE * dtMs) / 1000,
    );

    // — Procedural shamble. Bob and sway are locked to distance WALKED so
    // stride stays consistent if WALK_SPEED is retuned; sway blends in a slow
    // time term so a stopped zombie still breathes instead of freezing.
    const A = type.ANIM;
    const limp = A.LIMP ?? 0;
    // Hit-flinch squash (7c): the spring compresses the body toward the
    // feet (group origin) and rebounds with a slight stretch. Clamped so a
    // rapid mag-dump can never scale through zero; width compensates half
    // the compression for a volume-ish read.
    const sq = Math.max(-0.2, Math.min(0.5, rec.squash.update(0, dtMs / 1000)));
    group.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
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
    if (ra.dying || ra.vault) continue; // a climber is scripted — no shoves
    for (let b = a + 1; b < records.length; b++) {
      const rb = records[b];
      if (rb.dying || rb.vault) continue;
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

  // — Map collision LAST (4.2): walls win over steering and separation, so
  // neither a step nor a crowd shove can push a body through a building.
  // The reach probe (4.3 clip fix) keeps the FRONT of the body — arms and
  // head, ~1.0 m past the feet circle — out of walls the zombie faces.
  // Guarded: a type without a WALL block resolves exactly as before.
  if (mapColliders.length > 0) {
    for (const rec of records) {
      if (rec.dying || rec.vault) continue; // the vault script owns the body
      const solved = resolveBodyWithReach(
        rec.group.position.x, rec.group.position.z,
        rec.group.rotation.y, mapColliders, rec.type.BODY_RADIUS,
        rec.type.WALL?.REACH ?? 0, rec.type.WALL?.RADIUS ?? 0,
      );
      rec.group.position.x = solved.x;
      rec.group.position.z = solved.z;
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
  windowSlots.clear(); // no stale queue claims across rounds (4.3b.1)
}
