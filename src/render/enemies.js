// render/enemies.js — enemy lifecycle: build the blocky proto-zombie, steer
// it toward the player, drive the procedural shamble, take damage, die
// (fall over), fight back with a telegraphed swipe — and, pass 6, coexist:
// spawn positions come from the wave manager and living zombies push apart
// so a wave arrives as a group, not a merged clump. Pass 7c: enough LEG
// damage destroys the legs — the zombie collapses (collapsePose) and keeps
// coming prone on an arm-drag gait, with its own closer, slower claw.

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

// The climb timeline (4.3b.2), pure in k ∈ [0,1]: REACH the sill (arms
// rise to a plant), MOUNT it (body up, LEAD leg swings high over), DROP
// inside (lead plants, the TRAIL leg — the Shambler's drag leg — hauls
// over LATE, catching on the sill the way the limp promises). Returns
// every rig channel plus h, the piecewise progress along the vault's
// spatial anchors (from → sill-outer → sill-centre → landing). rest is
// { REST, ELBOW, KNEE, LEAN, sillH } so the pose starts and ends EXACTLY
// on the walk pose — the suite pins k=0/k=1 to it and the phase
// boundaries to continuity, because a pop here reads as a glitch, not a
// climb. Structural phase constants live here on purpose; promote one to
// the registry only when a feel report names it.
const CLIMB = { REACH_END: 0.25, MOUNT_END: 0.65 };
const smooth = (t) => t * t * (3 - 2 * t); // smoothstep: eases both ends
export function climbPose(k, rest) {
  const { REST, ELBOW, KNEE, LEAN, sillH } = rest;
  const PLANT = REST - 1.1; // shoulders at the sill plant, up-forward
  if (k <= CLIMB.REACH_END) {
    const t = smooth(k / CLIMB.REACH_END);
    return {
      h: 0.3 * t, y: 0, pitch: LEAN + 0.15 * t,
      shoulder: REST + (PLANT - REST) * t, elbow: ELBOW * (1 - 0.7 * t),
      hipL: 0, kneeL: KNEE, hipR: 0, kneeR: KNEE,
    };
  }
  if (k <= CLIMB.MOUNT_END) {
    const t = smooth((k - CLIMB.REACH_END) / (CLIMB.MOUNT_END - CLIMB.REACH_END));
    return {
      h: 0.3 + 0.3 * t, y: sillH * t, pitch: LEAN + 0.15 + 0.3 * t,
      shoulder: PLANT + 0.6 * t, elbow: ELBOW * 0.3, // pressing: body rises past the hands
      hipL: -1.3 * t, kneeL: KNEE + 1.2 * smooth(Math.min(1, t * 1.6)),
      hipR: 0.3 * t, kneeR: KNEE + 0.95 * t, // the drag leg hangs, deep-bent
    };
  }
  const t = smooth((k - CLIMB.MOUNT_END) / (1 - CLIMB.MOUNT_END));
  const haul = smooth(Math.min(1, t / 0.6));       // the trail leg's LATE swing
  const settle = smooth(Math.max(0, (t - 0.6) / 0.4)); // then everything lands
  return {
    h: 0.6 + 0.4 * t, y: sillH * (1 - t) * (1 - t), // accelerating drop
    pitch: LEAN + 0.45 * (1 - t),
    shoulder: (PLANT + 0.6) + (REST - (PLANT + 0.6)) * t, elbow: ELBOW * (0.3 + 0.7 * t),
    hipL: -1.3 * (1 - t), kneeL: KNEE + 1.2 * (1 - t),
    hipR: 0.3 - 1.1 * haul + 0.8 * settle, // over the sill late, then to rest (0.3−1.1+0.8 = 0)
    kneeR: KNEE + 0.95 * (1 - haul * 0.5) - 0.475 * settle, // releases as it clears
  };
}

// The crawl stance (pass 7c) — structural pose constants, same policy as
// CLIMB above: they live here until a feel report names one for the
// registry. Exported so the suite pins collapsePose's landing against
// them and derives the prone body extent for the wall-reach invariant.
export const CRAWL_POSE = {
  // The sphinx rig (7c.2) — every spatial value below is MEASURED (probe,
  // 2026-07-12, grid-searched world-space minima; LESSONS #19): pelvis flat
  // on the ground (belly bottom +0.047, toes flat), chest and head raised
  // off the waist counter-bend (head clearance +0.125 in every stance),
  // hands planted (+0.045 at rest; the deepest gait pull kisses -0.008).
  PITCH: 1.35,       // rad off vertical — the pelvis lies nearly flat
  WAIST: -0.8,       // waist counter-bend: chest/head/arms rise off the
                     //   flattened pelvis (negative X tips the top BACK
                     //   up) — the sphinx silhouette. Upper trunk sits at
                     //   PITCH + WAIST = 0.55 rad from vertical
  Y: 0.02,           // feet-origin lift — barely off the floor now that
                     //   the counter-bend carries the head clearance
  ARM_REST: 1.125,   // prone shoulder angle: upper arm out level, forearm
                     //   angled down — the propping foreleg plant
  ELBOW: 0.5,        // prone elbow bend — propped, never locked straight
  REACH_AMP: 0.5,    // rad of ONE-SIDED forward arm reach (7c.3): each arm
                     //   alternately lifts up-forward and re-plants; the
                     //   swing is lift-only (max(0, sin)), so the planted
                     //   arm never digs — which is what capped the old
                     //   symmetric PULL_AMP at 0.075 and read as a slither
  STRIDE_FREQ: 5.2,  // rad per metre CRAWLED — the crawl's own stride
                     //   phase (the standing BOB_FREQ 2.6 gave one arm
                     //   cycle per 2.4 m: arms near-frozen at 0.54 m/s).
                     //   5.2 plants a hand every ~0.6 m, ~1.1 s apart
  ROLL: 0.08,        // rad of shoulder roll, one per pull pair (SWAY_FREQ rule)
  HIP_TRAIL: 0.15,   // dead legs trail nearly straight behind
  KNEE_TRAIL: 0.25,  // slight knee cock — toes up, the drag read
  DRAG_WIGGLE: 0.06, // rad of passive leg sway as the body hauls itself
  HEAD_UP: -0.1,     // head pitch off the build TILT; with the raised trunk
                     //   the face angle lands at the browser-approved 0.30
                     //   rad from vertical (PITCH + WAIST + TILT + HEAD_UP)
  WINDUP_COCK: 2.2,  // extra elbowFactor gain in the PRONE windup: the arm
                     //   rears up-back (REAR_RAD swings it past vertical-ish)
                     //   while the elbow folds to ~1.6 rad — a coiled claw,
                     //   not a straight stiff reach (feel report 2026-07-12)
  TURN_MULT: 0.125,  // fraction of NAV.TURN_RATE while prone. The read is
                     //   the lever ARM, not the angular rate (7c.3): prone,
                     //   the head end rides ~2 m from the feet pivot, vs
                     //   ~0.25 m for standing shoulders — 0.125 matches the
                     //   head-end sweep speed (~1.25 m/s) to the standing
                     //   read that already feels right at full rate
};

// The collapse timeline (7c), pure in k ∈ [0,1]: the legs give out. Arms
// shoot forward EARLY (bracing — the body falls onto them), the trunk
// accelerates into the fall (k², the death fall's read), the legs give
// way and trail out. k=0 is EXACTLY the walk rest and k=1 EXACTLY the
// crawl rest — the suite pins both ends, because a pop at either reads
// as a glitch, not a collapse (the climbPose rule).
export function collapsePose(k, rest) {
  const brace = smooth(Math.min(1, k * 1.8)); // arms lead the fall
  const drop = k * k;                          // the trunk accelerates down
  const settle = smooth(k);                    // legs slacken into the trail
  return {
    pitch: rest.LEAN + (CRAWL_POSE.PITCH - rest.LEAN) * drop,
    // The waist counter-bend rides the SAME k² as the pitch, so the chest
    // rises exactly as the trunk falls — the sphinx arrives in one motion.
    waist: CRAWL_POSE.WAIST * drop,
    lift: CRAWL_POSE.Y * drop,
    shoulder: rest.REST + (CRAWL_POSE.ARM_REST - rest.REST) * brace,
    elbow: rest.ELBOW + (CRAWL_POSE.ELBOW - rest.ELBOW) * brace,
    hipL: CRAWL_POSE.HIP_TRAIL * settle,
    hipR: CRAWL_POSE.HIP_TRAIL * settle,
    kneeL: rest.KNEE + (CRAWL_POSE.KNEE_TRAIL - rest.KNEE) * settle,
    kneeR: rest.KNEE + (CRAWL_POSE.KNEE_TRAIL - rest.KNEE) * settle,
    headUp: CRAWL_POSE.HEAD_UP * settle,
  };
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

export function spawnEnemy(typeId, pos, { speedMult = 1, holdMs = 0, yaw = null } = {}) {
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
  // Spawn facing (4.3c): window entries materialize FACING the glass —
  // a spawn-time set, so no snap concern (turnToward owns yaw after).
  if (yaw !== null) group.rotation.y = yaw;
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
    // The dread beat (4.3c): ms left standing at the glass before moving.
    // Wakes early on pain (damageEnemy) or on seeing the player up close.
    holdT: holdMs,
    // The Crawler (7c): accumulated LEG-tag damage; crossing CRAWL.LEG_HP
    // collapses the zombie. crawlState: null | 'falling' | 'prone'.
    // crawlPending defers a mid-vault collapse to the landing — falling
    // inside the wall plane would strand the body.
    legDmg: 0,
    crawlState: null,
    crawlT: 0,
    crawlPending: false,
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
    rec.group.position.y = 0; // back on the ground outside, as before (7c:
    rec.vault = null;         //   the pose capture below must not keep the
  }                           //   climb height on a teleported body)
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
  // Zero the roll so the fall pivots cleanly around the feet; pitch and
  // height are CAPTURED instead of reset (7c) — a crawler dies from prone
  // (~1.35 rad), and snapping it upright to fall over again read as a
  // resurrection. A standing death captures LEAN and the bob dip, so the
  // old numbers fall out of the same interpolation.
  rec.dieFromPitch = rec.group.rotation.x;
  rec.dieFromY = rec.group.position.y;
  // The waist is captured too (7c.2): a sphinx dying from prone relaxes
  // its counter-bend to 0 through the fall, settling FLAT — a standing
  // death captures 0, so the old behavior falls out of the same formula.
  rec.dieFromWaist = rec.parts.waist ? rec.parts.waist.rotation.x : 0;
  rec.group.rotation.z = 0;
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

// The crawl transition (7c): the legs are destroyed. The `instant` flag
// is the 7d hook — a future spawn-as-crawler starts prone, no fall.
function beginCrawl(rec, instant = false) {
  releaseWait(rec); // a crawler abandons any window queue — it can't climb
  // A committed climber finishes the haul first: collapsing mid-vault
  // would strand the body inside the wall plane. Land, THEN fall.
  if (rec.vault) {
    rec.crawlPending = true;
    return;
  }
  rec.crawlPending = false;
  rec.attackPhase = null; // the collapse cancels any swing in progress
  rec.crawlState = instant ? 'prone' : 'falling';
  rec.crawlT = 0;
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
  // Legs (7c): their own tag so the crawl threshold can count them, at
  // the LIMB tier by default — a type without a LEG entry keeps exactly
  // the old damage numbers.
  if (part === 'leg') return HB?.LEG ?? HB?.LIMB ?? 1;
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
  rec.holdT = 0; // pain wakes a loitering window entry (4.3c)

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

  // The Crawler (7c): LEG damage accumulates separately from HP; crossing
  // CRAWL.LEG_HP destroys the legs and the zombie collapses into the
  // crawl. Guarded — a type without a CRAWL block never crawls, and a
  // zombie already down can't lose its legs twice.
  let legsOut = false;
  if (part === 'leg' && !rec.crawlState && rec.type.CRAWL) {
    rec.legDmg += partDamage(rec.type, part);
    if (rec.legDmg >= rec.type.CRAWL.LEG_HP) legsOut = true;
  }

  const killed = rec.hp <= 0;
  if (killed) startDeath(rec); // an outright kill wins over the transition
  else if (legsOut) beginCrawl(rec);
  // legsOut rides the result so main can size the blood burst — the
  // transform has to READ (the headshot double-spray rule). The bounty
  // (pass 10) rides it too: main scores at the shot site, where the PART
  // context lives. Guarded — a registry entry without a SCORE block is
  // worth 0, never NaN.
  return {
    part, killed, legsOut: legsOut && !killed,
    value: killed ? (rec.type.SCORE?.KILL ?? 0) : 0,
  };
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
        // Accelerating fall (k²) from the CAPTURED death pose to flat on
        // the ground — LEAN and ~0 when standing (the old numbers fall
        // out of the same formula), the prone pitch when a crawler dies
        // (7c: it settles flat, never snaps upright to fall again).
        const fp = rec.dieFromPitch ?? type.ANIM.LEAN;
        const fy = rec.dieFromY ?? 0;
        group.rotation.x = fp + (Math.PI / 2 - fp) * k * k;
        group.position.y = fy + (type.DEATH.CORPSE_LIFT - fy) * k * k;
        if (rec.parts.waist) {
          rec.parts.waist.rotation.x = (rec.dieFromWaist ?? 0) * (1 - k * k);
        }
      } else if (phase === 'lying') {
        group.rotation.x = Math.PI / 2;
        group.position.y = type.DEATH.CORPSE_LIFT;
        if (rec.parts.waist) rec.parts.waist.rotation.x = 0; // corpses lie FLAT
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
    // 4.3b.2: the float became a CLIMB — climbPose drives the whole rig
    // through reach/mount/drop, and the body travels piecewise through
    // the vault's spatial anchors (from → sill-outer → sill-centre →
    // landing) instead of one straight lerp.
    if (rec.vault) {
      const v = rec.vault;
      v.t += dtMs;
      const k = Math.min(1, v.t / v.ms);
      const pose = climbPose(k, v.rest);
      // h ∈ [0,1] runs through three equal-length segments of the anchor
      // chain: [from→sill-outer], [sill-outer→sill-centre], [sill-centre→
      // landing] at h 0–0.3–0.6–1.0 (climbPose emits those breakpoints).
      let ax; let az; let bx; let bz; let seg;
      if (pose.h <= 0.3) {
        ax = v.fromX; az = v.fromZ; bx = v.sillX; bz = v.sillZ; seg = pose.h / 0.3;
      } else if (pose.h <= 0.6) {
        ax = v.sillX; az = v.sillZ; bx = v.midX; bz = v.midZ; seg = (pose.h - 0.3) / 0.3;
      } else {
        ax = v.midX; az = v.midZ; bx = v.toX; bz = v.toZ; seg = (pose.h - 0.6) / 0.4;
      }
      group.position.x = ax + (bx - ax) * seg;
      group.position.z = az + (bz - az) * seg;
      group.position.y = pose.y;
      group.rotation.x = pose.pitch;
      group.rotation.y = turnToward(
        group.rotation.y, v.yaw, (CONFIG.NAV.TURN_RATE * dtMs) / 1000,
      );
      // Drive the rig (guarded per part — an old parts map just holds).
      rec.parts.armL.rotation.x = pose.shoulder;
      rec.parts.armR.rotation.x = pose.shoulder;
      if (rec.parts.foreL && rec.parts.foreR) {
        rec.parts.foreL.rotation.x = pose.elbow;
        rec.parts.foreR.rotation.x = pose.elbow;
      }
      if (rec.parts.legL && rec.parts.legR) {
        rec.parts.legL.rotation.x = pose.hipL;
        rec.parts.legR.rotation.x = pose.hipR;
        if (rec.parts.shinL && rec.parts.shinR) {
          rec.parts.shinL.rotation.x = pose.kneeL;
          rec.parts.shinR.rotation.x = pose.kneeR;
        }
      }
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
        group.rotation.x = type.ANIM.LEAN;
        releaseClimb(rec); // the queue advances: the waiter promotes next frame
        rec.vault = null;  // landed inside; normal logic resumes next frame
        // Legs shot out mid-climb (7c): the collapse was deferred to the
        // landing — it fires now, just inside the window.
        if (rec.crawlPending) beginCrawl(rec);
      }
      continue;
    }

    // — Collapsing (7c): the legs just gave out. The fall owns the frame
    // the way the vault does — rooted, no attacks, no steering — and the
    // body stays HITTABLE; flash decay and the squash spring keep running
    // so hits still read. collapsePose is pure and suite-pinned at both
    // ends: it starts EXACTLY on the walk rest and lands EXACTLY on the
    // crawl rest.
    if (rec.crawlState === 'falling') {
      rec.crawlT += dtMs;
      const k = Math.min(1, rec.crawlT / type.CRAWL.FALL_MS);
      const pose = collapsePose(k, {
        REST: type.BODY?.ARM?.REST_RAD ?? Math.PI / 2,
        ELBOW: type.ANIM.ELBOW_BEND ?? 0,
        KNEE: type.ANIM.KNEE_REST ?? 0,
        LEAN: type.ANIM.LEAN,
      });
      group.rotation.x = pose.pitch;
      group.position.y = pose.lift;
      group.rotation.z *= Math.max(0, 1 - dtMs / 150); // walk roll bleeds out
      if (rec.parts.waist) rec.parts.waist.rotation.x = pose.waist;
      rec.parts.armL.rotation.x = pose.shoulder;
      rec.parts.armR.rotation.x = pose.shoulder;
      if (rec.parts.foreL && rec.parts.foreR) {
        rec.parts.foreL.rotation.x = pose.elbow;
        rec.parts.foreR.rotation.x = pose.elbow;
      }
      if (rec.parts.legL && rec.parts.legR) {
        rec.parts.legL.rotation.x = pose.hipL;
        rec.parts.legR.rotation.x = pose.hipR;
        if (rec.parts.shinL && rec.parts.shinR) {
          rec.parts.shinL.rotation.x = pose.kneeL;
          rec.parts.shinR.rotation.x = pose.kneeR;
        }
      }
      if (rec.parts.head) {
        rec.parts.head.rotation.x = (type.BODY?.HEAD?.TILT ?? 0) + pose.headUp;
      }
      if (rec.flashT > 0) {
        rec.flashT = Math.max(0, rec.flashT - dtMs);
        setFlash(rec, (rec.flashT / type.COMBAT.FLINCH_MS) * 0.9);
      }
      const fsq = Math.max(-0.2, Math.min(0.5, rec.squash.update(0, dtMs / 1000)));
      group.scale.set(1 + fsq * 0.5, 1 - fsq, 1 + fsq * 0.5);
      if (k >= 1) rec.crawlState = 'prone'; // down — the drag begins next frame
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

    // The dread beat (4.3c): a window-entry zombie stands at the glass
    // until its loiter runs out — or wakes early if the player comes to
    // IT in the open (LOS + close). Staring at each other THROUGH the
    // window does not wake it: window cells block feet-level LOS, which
    // is exactly the shape-at-the-glass moment. Pain also wakes it
    // (damageEnemy zeroes holdT).
    if (rec.holdT > 0) {
      if (los && dist <= CONFIG.NAV.BEELINE_DIST) rec.holdT = 0;
      else rec.holdT -= dtMs;
    }

    // Facing is a TARGET now, applied through turnToward below — never
    // assigned directly (the snap Daniel reported). Default target: the
    // player; a field-following step overrides it with the walk direction.
    let targetYaw = Math.atan2(dx, dz);

    // Hit flash decays over FLINCH_MS.
    if (rec.flashT > 0) {
      rec.flashT = Math.max(0, rec.flashT - dtMs);
      setFlash(rec, (rec.flashT / type.COMBAT.FLINCH_MS) * 0.9);
    }

    // The Crawler (7c): a prone zombie runs the SAME attack and movement
    // machinery with its CRAWL numbers — closer stop ring, slower claw,
    // arms anchored on the prone rest. The rear-back/thrust formulas carry
    // over unchanged: from the prone rest, REST − REAR_RAD lifts the arm
    // up off the ground (the cocked claw) and REST + THRUST_RAD slams it
    // down past the plant.
    const crawling = rec.crawlState === 'prone';
    const CR = type.CRAWL;
    const AT = crawling ? CR.ATTACK : type.ATTACK;
    const stopDist = crawling ? CR.STOP_DISTANCE : type.STOP_DISTANCE;
    // Arm rest pose comes from the body registry (guarded: a type without a
    // BODY block falls back to the old straight-forward π/2). Every arm
    // animation anchors HERE so the rest pose is one data value.
    const REST = crawling
      ? CRAWL_POSE.ARM_REST
      : (type.BODY?.ARM?.REST_RAD ?? Math.PI / 2);

    // — Attack cycle: the arms belong to the attack while a phase runs.
    if (rec.attackPhase) {
      rec.attackT += dtMs;
      if (rec.attackPhase === 'windup') {
        const k = Math.min(1, rec.attackT / AT.WINDUP_MS);
        setArms(rec, REST - AT.REAR_RAD * k); // the tell: arms RAISE overhead (7a.3)
        // Prone, the rear-back cocks a coiled claw (feel 2026-07-12): the
        // upper arm swings up-back past the shoulder while the elbow folds
        // deep — WINDUP_COCK drives the fold. Standing keeps the old 0.4.
        rec.elbowFactor = 1 + (crawling ? CRAWL_POSE.WINDUP_COCK : 0.4) * k;
        if (k >= 1) {
          rec.attackPhase = 'strike';
          rec.attackT = 0;
          // Damage lands at the START of the strike — the windup was the
          // player's window to cancel it (shoot), DODGE out of reach, or
          // (4.3) break line of sight around a corner: no LOS = a whiff.
          const inRange = los && dist <= stopDist + AT.RANGE_SLACK;
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
      const inReach = los && dist <= stopDist + AT.RANGE_SLACK;
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
    } else if (!rec.attackPhase && rec.holdT <= 0) {
      // The stop ring only exists when the player is VISIBLE (4.3): a
      // zombie must never "arrive" at a player it can't reach through a
      // wall — without LOS it keeps navigating.
      const step = advanceDistance(
        dist,
        type.WALK_SPEED * rec.speedMult * (crawling ? CR.SPEED_MULT : 1),
        dtMs,
        los ? stopDist : 0,
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
          // Field per capability (7c): a crawler reads the GROUND field —
          // windowCost 0, windows not traversable — so its route contains
          // no windows BY CONSTRUCTION and it can never strand at glass it
          // can't climb. Guarded: a nav without a groundField (an old
          // caller) degrades to the shared field.
          const fld = crawling ? (nav.groundField ?? nav.field) : nav.field;
          const cell = worldToCell(
            nav.map, nav.grid, group.position.x, group.position.z,
          );
          const s = fld.stepAt(cell.c, cell.r);
          const dir = fld.dirAt(cell.c, cell.r);
          // Vault trigger (4.3b): the path's next cell is a WINDOW, the
          // cell beyond it is open, this type can climb, and we've pressed
          // to the sill (VAULT_TRIGGER sits just past the reach-probe
          // standoff — the suite asserts that ordering, because a trigger
          // INSIDE the standoff would freeze zombies at every window, the
          // 4.3a corner-freeze class all over again).
          // !crawling is a BELT here — the ground field never steps into a
          // window, so a crawler can't reach this branch off its own field;
          // the check documents the rule and survives a degraded-field
          // fallback.
          if (s && !crawling && (type.VAULT?.MS ?? 0) > 0
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
                // Spatial anchors (4.3b.2): reach the sill's outer face,
                // mount its centre, drop just inside the far face — a
                // climb THROUGH the window, not a leap to the far cell.
                const half = nav.map.CELL / 2;
                const landIn = half + type.BODY_RADIUS + 0.15;
                rec.vault = {
                  t: 0,
                  ms: type.VAULT.MS,
                  fromX: group.position.x,
                  fromZ: group.position.z,
                  sillX: wC.x - s.dc * half * 0.9,
                  sillZ: wC.z - s.dr * half * 0.9,
                  midX: wC.x,
                  midZ: wC.z,
                  toX: wC.x + s.dc * landIn,
                  toZ: wC.z + s.dr * landIn,
                  yaw: Math.atan2(s.dc, s.dr),
                  key,
                  // The pose's rest bundle: the climb starts and ends
                  // EXACTLY on the walk pose (suite-pinned continuity).
                  rest: {
                    REST: type.BODY?.ARM?.REST_RAD ?? Math.PI / 2,
                    ELBOW: type.ANIM.ELBOW_BEND ?? 0,
                    KNEE: type.ANIM.KNEE_REST ?? 0,
                    LEAN: type.ANIM.LEAN,
                    sillH: nav.map.WINDOW_SILL_H ?? 1.0,
                  },
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
    // the body carrying its weight through the turn. Prone (7c.2), the
    // rate scales by TURN_MULT: a body hauling itself on its arms pivots
    // like dead weight, never a swivel — and the slower turn is readable
    // counterplay (circling a downed crawler outpaces its facing).
    group.rotation.y = turnToward(
      group.rotation.y, targetYaw,
      (CONFIG.NAV.TURN_RATE * (crawling ? CRAWL_POSE.TURN_MULT : 1) * dtMs) / 1000,
    );

    // — Procedural pose. The hit-flinch squash rides BOTH stances: the
    // spring compresses the body toward the feet (group origin) and
    // rebounds with a slight stretch. Clamped so a rapid mag-dump can
    // never scale through zero; width compensates half the compression
    // for a volume-ish read. Stride phase p is locked to distance WALKED
    // in both gaits, so cadence tracks any speed retune for free.
    const A = type.ANIM;
    const sq = Math.max(-0.2, Math.min(0.5, rec.squash.update(0, dtMs / 1000)));
    group.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    const p = rec.walked * A.BOB_FREQ;

    if (crawling) {
      // — The drag gait (7c): prone at a fixed pitch, hauling itself on
      // alternating arm pulls. The legs are dead weight — a static trail
      // with a passive wiggle as the body drags them. The attack owns the
      // arms while a phase runs, exactly like the shamble's rule.
      group.position.y = CRAWL_POSE.Y;
      group.rotation.x = CRAWL_POSE.PITCH;
      // The counter-bend that makes the sphinx (7c.2) — guarded like every
      // part write, so an old parts map without a waist simply lies flat.
      if (rec.parts.waist) rec.parts.waist.rotation.x = CRAWL_POSE.WAIST;
      // One shoulder roll per pull pair — the SWAY = stride/2 rule, on the
      // crawl's OWN stride phase (7c.3) — with the same integrated
      // idle-breathing phase as the walk (7a.7).
      rec.idlePhase += dtMs * A.IDLE_SWAY_FREQ * (1 - rec.legBlend);
      const p2 = rec.walked * CRAWL_POSE.STRIDE_FREQ;
      group.rotation.z =
        Math.sin(p2 / 2 + rec.idlePhase) * CRAWL_POSE.ROLL;
      if (!rec.attackPhase) {
        // The reach-and-pull cycle (7c.3): each arm's swing is ONE-SIDED —
        // it lifts up-forward (the reach), re-plants, then HOLDS the plant
        // for its half-stride while the body hauls past it (the pull; a
        // stationary planted hand under a moving body IS the pulling
        // read). Opposite phases: exactly one arm reaches at a time, so
        // the gait's floor minimum equals the rest plant by construction.
        const liftL = Math.max(0, Math.sin(p2)) * CRAWL_POSE.REACH_AMP * rec.legBlend;
        const liftR = Math.max(0, -Math.sin(p2)) * CRAWL_POSE.REACH_AMP * rec.legBlend;
        rec.parts.armL.rotation.x = CRAWL_POSE.ARM_REST - liftL;
        rec.parts.armR.rotation.x = CRAWL_POSE.ARM_REST - liftR;
        rec.elbowFactor = 1;
      }
      if (rec.parts.legL && rec.parts.legR) {
        const wiggle = Math.sin(p2) * CRAWL_POSE.DRAG_WIGGLE * rec.legBlend;
        rec.parts.legL.rotation.x = CRAWL_POSE.HIP_TRAIL + wiggle;
        rec.parts.legR.rotation.x = CRAWL_POSE.HIP_TRAIL - wiggle;
        if (rec.parts.shinL && rec.parts.shinR) {
          rec.parts.shinL.rotation.x = CRAWL_POSE.KNEE_TRAIL;
          rec.parts.shinR.rotation.x = CRAWL_POSE.KNEE_TRAIL;
        }
      }
      if (rec.parts.head) {
        // Face up off the ground toward the player (negative X pitches the
        // +Z face upward — the build convention).
        rec.parts.head.rotation.x = (type.BODY?.HEAD?.TILT ?? 0) + CRAWL_POSE.HEAD_UP;
      }
      // Prone elbow anchor — the attack's elbowFactor scales it exactly
      // like the standing droop.
      if (rec.parts.foreL && rec.parts.foreR) {
        const elbow = CRAWL_POSE.ELBOW * rec.elbowFactor;
        rec.parts.foreL.rotation.x = elbow;
        rec.parts.foreR.rotation.x = elbow;
      }
    } else {
      // — Procedural shamble. Bob and sway are locked to distance WALKED so
      // stride stays consistent if WALK_SPEED is retuned; sway blends in a
      // slow time term so a stopped zombie still breathes instead of
      // freezing.
      const limp = A.LIMP ?? 0;
      // The limp dip (7a.6): the old symmetric |sin| bob VAULTED the body
      // over each step — at slow cadence that read as skipping. An injured
      // walk does the opposite: the body stays level and DROPS once per
      // stride as weight lands on the bad right leg (= while the good left
      // leg swings). BOB_AMP is the dip depth; legBlend keeps a standing
      // zombie at 0.
      group.position.y =
        -A.BOB_AMP * Math.max(0, Math.sin(p - Math.PI / 2)) * rec.legBlend;
      // Sway is stride-locked while walking; the idle breathing advances as
      // an INTEGRATED phase (rate scaled by stillness) — continuous by
      // construction, so blend transitions can never kick the body (7a.7).
      rec.idlePhase += dtMs * A.IDLE_SWAY_FREQ * (1 - rec.legBlend);
      // Weight lives on the GOOD left leg (7a.8): a constant roll bias on
      // top of the sway — positive rotation.z tips the top toward −X, the
      // good side. 0.16 rad at LIMP 1 is structural; LIMP scales it.
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
        // LITERAL drag (7a.8): the bad leg never steps — no swing component
        // at all. It PINS at a backward trail and gets pulled along by the
        // body.
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
      // Elbow droop rides whatever the arms are doing (attack phases scale
      // the factor: cock on windup, straighten through the strike). Guarded
      // for an old parts map without forearms.
      if (rec.parts.foreL && rec.parts.foreR) {
        const elbow = (A.ELBOW_BEND ?? 0) * rec.elbowFactor;
        rec.parts.foreL.rotation.x = elbow;
        rec.parts.foreR.rotation.x = elbow;
      }
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
      // Prone bodies reach much further forward than standing ones (7c):
      // lying down, the head and the pulling arms extend up to ~2.2 m past
      // the feet origin, so crawl states use CRAWL.WALL — the suite pins
      // its reach against the registry-derived extent. 'falling' counts
      // too: the collapse pitches through those extents. Guarded exactly
      // like the standing block.
      const W = rec.crawlState
        ? (rec.type.CRAWL?.WALL ?? rec.type.WALL)
        : rec.type.WALL;
      const solved = resolveBodyWithReach(
        rec.group.position.x, rec.group.position.z,
        rec.group.rotation.y, mapColliders, rec.type.BODY_RADIUS,
        W?.REACH ?? 0, W?.RADIUS ?? 0,
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