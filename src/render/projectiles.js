// render/projectiles.js — the Spitter's glob (pass 15): pooled ballistic
// projectiles on an arc. The game's first thing that TRAVELS — every other
// threat is a hitscan raycast (shooting.js) or a melee phase (enemies.js),
// which is why distance has always meant safety. This is what breaks that.
//
// Pooled and recycled from a fixed-size array like BLOOD and CASINGS: no
// allocation during play, no GC hitches, a hard cap on scene cost. All
// visuals code-built, per the project's no-assets rule.
//
// Factory-init pattern, no module-scope side effects: safe for the Node
// suite to import.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

// ————— Pure math (suite-tested) —————

// The launch velocity carrying a glob from `from` to `to` in exactly
// flightMs under `gravity`.
//
// Solving for a flight TIME rather than a launch SPEED is the whole reason
// this is total. The speed-based form (pick v, solve for the angle) has TWO
// solutions, and — worse — no real solution at all when the target is out
// of range, so a spitter would silently decline to fire and you'd find that
// in a play session rather than here. Time-based always has exactly one
// answer, and it's the answer whose lever the player can actually read.
export function arcVelocity(from, to, flightMs, gravity) {
  const T = flightMs / 1000;
  // Guard: T = 0 divides to Infinity and would fling a glob to nowhere. A
  // zero-length flight means the target IS the muzzle — drop it in place.
  if (!(T > 0)) return { vx: 0, vy: 0, vz: 0 };
  return {
    vx: (to.x - from.x) / T,
    // The +½gT² term is what makes this an ARC and not a laser: it pre-pays
    // the drop the glob will suffer over the whole flight.
    vy: (to.y - from.y) / T + 0.5 * gravity * T,
    vz: (to.z - from.z) / T,
  };
}

// Flight time for a shot: horizontal distance at a fixed horizontal speed.
// This is THE tuning lever — flight time IS the dodge window, and deriving
// it from range makes the arc behave the way an eye expects: a long lob
// hangs and can be strolled out of, a point-blank spit snaps flat and can't.
// A fixed flight time would do the opposite, lobbing a comic mortar shell
// at a target two metres away.
export function flightMsFor(from, to, globSpeed) {
  if (!(globSpeed > 0)) return 0; // guard: /0, same reasoning as above
  return (Math.hypot(to.x - from.x, to.z - from.z) / globSpeed) * 1000;
}

// ————— Stateful pooled projectiles —————

let sceneRef = null;
let onPlayerHitCb = null;
const globs = []; // { mesh, vx, vy, vz, t, life, damage, radius, gravity, active }

export function initProjectiles(scene, { onPlayerHit } = {}) {
  sceneRef = scene;
  onPlayerHitCb = onPlayerHit || null;
  if (globs.length) return; // idempotent: re-init must not double the pool

  // One shared geometry; a material EACH. Same trade the blood pools make:
  // colour is per-TYPE registry data, so a shared material would force every
  // future ranged enemy to spit the same hue. A dozen materials is trivial.
  //
  // fog:false is not cosmetic — it is load-bearing. FOG.WAVES.FAR is 13 and
  // a spitter parks at 9, so a fogged glob would launch already ~60% erased
  // and fade to nothing mid-flight. The tell has to survive the murk, which
  // is the same reason the eyes are unlit (enemyBody.js).
  const geo = new THREE.SphereGeometry(1, 8, 6); // unit sphere; scaled per type
  for (let i = 0; i < CONFIG.PROJECTILES.MAX; i++) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ fog: false }));
    mesh.visible = false;
    scene.add(mesh);
    globs.push({
      mesh, vx: 0, vy: 0, vz: 0, t: 0,
      life: 0, damage: 0, radius: 0, gravity: 0, active: false,
    });
  }
}

// Launch a glob from `from` to `to`. Everything about the shot is read from
// the type's RANGED block — a type without one can't reach here, because the
// only caller is gated on it.
export function spawnGlob(type, from, to) {
  if (!sceneRef) return null;
  const R = type?.RANGED;
  if (!R) return null; // guarded like blastDamage: the guard IS the contract
  const g = globs.find((p) => !p.active);
  // Pool exhausted: DECLINE the shot. The graceful degrade for a projectile
  // has to be silence, not recycling the oldest — stealing a glob mid-flight
  // would delete a hit the player already dodged around.
  if (!g) return null;

  const flight = flightMsFor(from, to, R.GLOB_SPEED);
  const v = arcVelocity(from, to, flight, R.GRAVITY);
  g.active = true;
  g.t = 0;
  g.vx = v.vx; g.vy = v.vy; g.vz = v.vz;
  g.life = R.LIFE_MS;
  g.damage = R.DAMAGE;
  g.radius = R.GLOB_RADIUS;
  g.gravity = R.GRAVITY;
  g.mesh.position.set(from.x, from.y, from.z);
  g.mesh.scale.setScalar(R.GLOB_RADIUS);
  g.mesh.material.color.setHex(R.COLOR);
  g.mesh.visible = true;
  return g;
}

function retire(g) {
  g.active = false;
  g.mesh.visible = false;
}

export function updateProjectiles(dtMs, playerPos) {
  const dt = dtMs / 1000;
  for (const g of globs) {
    if (!g.active) continue;
    g.t += dtMs;
    g.vy -= g.gravity * dt;
    g.mesh.position.x += g.vx * dt;
    g.mesh.position.y += g.vy * dt;
    g.mesh.position.z += g.vz * dt;

    // Player hit: a CYLINDER from the floor up to the camera, radius
    // PLAYER.BODY_RADIUS. The column's top is playerPos.y — the camera's own
    // height — rather than a new PLAYER.HEIGHT constant, because there isn't
    // one and inventing a tunable that must silently agree with the camera
    // is how two sources of truth start disagreeing. XZ + a height band is
    // how this project measures every other range.
    const dxz = Math.hypot(playerPos.x - g.mesh.position.x, playerPos.z - g.mesh.position.z);
    const y = g.mesh.position.y;
    if (dxz <= g.radius + CONFIG.PLAYER.BODY_RADIUS && y >= 0 && y <= playerPos.y) {
      if (onPlayerHitCb) onPlayerHitCb(g.damage);
      retire(g);
      continue;
    }
    // Spent on the ground. Pass 15b hooks the acid pool exactly here.
    if (y <= g.radius) { retire(g); continue; }
    // Safety cap: a glob that somehow never lands must not leak a pool slot
    // for the rest of the round.
    if (g.t >= g.life) retire(g);
  }
}

// Fresh round: everything in flight vanishes. Pooled meshes just go
// inactive — nothing is disposed, the pool lives for the whole session.
export function resetProjectiles() {
  for (const g of globs) retire(g);
}
