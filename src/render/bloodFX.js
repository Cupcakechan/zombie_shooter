// render/bloodFX.js — blood, both kinds (pass 8.3): world-space burst
// particles at bullet-hit points, and lingering floor pools under kills.
// Everything is pooled and recycled from fixed-size arrays — no allocation
// during play, no GC hitches, hard caps on scene cost. All visuals are
// code-built (boxes and circles), per the project's no-assets rule.
//
// Factory-init pattern, no module-scope side effects: safe for the Node
// suite to import. The screen-space player-hit splatter is NOT here — that
// is DOM territory and lives in ui/hud.js.
//
// Pass-7 note: burst placement uses the raycast hit point, so this works
// unchanged on any future body. COLOR could become a per-type registry
// field when designed creatures land (different creatures, different blood).

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

// ————— Pure math (suite-tested) —————

// The pool's life as a pure function of elapsed time: solid, then fading,
// then reclaimable. Boundaries are relative to the config timings, so
// retuning LINGER/FADE never breaks the suite.
export function poolPhase(t, lingerMs, fadeMs) {
  if (t < lingerMs) return { phase: 'solid', opacity: 1 };
  const f = t - lingerMs;
  if (f < fadeMs) return { phase: 'fading', opacity: 1 - f / fadeMs };
  return { phase: 'done', opacity: 0 };
}

// ————— Stateful pooled FX —————

let sceneRef = null;
const particles = []; // { mesh, vx, vy, vz, lifeT, active }
const pools = [];     // { mesh, t, active }

export function initBloodFX(scene) {
  sceneRef = scene;
  const B = CONFIG.BLOOD;

  // Burst particles: one shared geometry, and — since 14c — a material EACH.
  // They still vanish by scaling to zero rather than fading, so this is not
  // about transparency; it is about colour. The burst's colour became caller
  // data when the Exploder started throwing acid instead of blood, and with a
  // single shared material a blast would repaint every red droplet still in
  // the air from the last kill, mid-flight. 64 MeshBasicMaterials over one
  // shared geometry is a trivial cost for that not happening.
  const pGeo = new THREE.BoxGeometry(B.PARTICLE_SIZE, B.PARTICLE_SIZE, B.PARTICLE_SIZE);
  for (let i = 0; i < B.MAX_PARTICLES; i++) {
    const mesh = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: B.COLOR }));
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, vx: 0, vy: 0, vz: 0, lifeT: 0, active: false });
  }

  // Floor pools: shared geometry, but a material EACH — pools fade out via
  // opacity, and opacity lives on the material. A couple dozen materials is
  // trivial; sharing one would make every stain fade in lockstep.
  const poolGeo = new THREE.CircleGeometry(B.POOL_RADIUS, 12);
  for (let i = 0; i < B.MAX_POOLS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: B.POOL_COLOR,
      transparent: true,
      opacity: 1,
      depthWrite: false, // a flat stain must never occlude in the depth buffer
    });
    const mesh = new THREE.Mesh(poolGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    pools.push({ mesh, t: 0, active: false });
  }
}

// Burst at a world point, sprayed away from the bullet's travel direction
// (i.e. out of the "exit" side) with an upward bias, then gravity takes over.
//
// `opts` (14c) is entirely optional and every field falls back to the pass-8.3
// constants, so the existing three-argument call sites are unchanged BY
// CONSTRUCTION rather than by anyone remembering to pass nothing:
//   color  — hex; a blast throws its type's FX_COLOR, a bullet throws blood
//   speed  — m/s; a detonation throws harder than a hit
//   radial — true for a THROW (every direction at once) instead of a cone
export function spawnBurst(point, rayDir, count, opts = {}) {
  if (!sceneRef) return;
  const B = CONFIG.BLOOD;
  const color = opts.color ?? B.COLOR;
  const s = opts.speed ?? B.PARTICLE_SPEED;
  const radial = opts.radial ?? false;
  let spawned = 0;
  for (const p of particles) {
    if (spawned >= count) break;
    if (p.active) continue;
    p.active = true;
    p.lifeT = 0;
    p.mesh.visible = true;
    p.mesh.position.copy(point);
    p.mesh.scale.setScalar(1);
    p.mesh.material.color.setHex(color);
    if (radial) {
      // A detonation has no exit side — it throws in every direction at once.
      // Uniform sphere directions (the y-then-ring construction, which is the
      // one that doesn't bunch at the poles), biased upward so nothing is
      // fired straight into the floor it would stop against on frame one.
      const theta = Math.random() * Math.PI * 2;
      const y = Math.random() * 2 - 1;
      const r = Math.sqrt(Math.max(0, 1 - y * y)); // max(0,…): float noise at |y| = 1
      p.vx = Math.cos(theta) * r * s;
      p.vy = (y * 0.5 + 0.6) * s; // 0.1…1.1 × s — always some lift, never a face-plant
      p.vz = Math.sin(theta) * r * s;
    } else {
      // Random cone around the reversed ray direction; rayDir may be absent
      // (defensive) — then the spray is a plain upward fountain.
      const back = rayDir ? { x: -rayDir.x, y: -rayDir.y, z: -rayDir.z } : { x: 0, y: 0, z: 0 };
      p.vx = (back.x * 0.6 + (Math.random() - 0.5)) * s;
      p.vy = (back.y * 0.3 + 0.5 + Math.random() * 0.7) * s; // upward bias
      p.vz = (back.z * 0.6 + (Math.random() - 0.5)) * s;
    }
    spawned++;
  }
  // Pool exhausted mid-frenzy: the oldest bursts are already near-invisible,
  // so silently spawning fewer is the graceful degrade — never a crash.
}

// A lingering stain on the floor under a kill. Slight random scale/offset so
// overlapping deaths don't produce identical concentric circles.
export function spawnPool(x, z) {
  if (!sceneRef) return;
  const B = CONFIG.BLOOD;
  let slot = pools.find((p) => !p.active);
  if (!slot) {
    // All stains in use: reclaim the OLDEST — it was closest to fading anyway.
    slot = pools.reduce((a, b) => (a.t >= b.t ? a : b));
  }
  slot.active = true;
  slot.t = 0;
  slot.mesh.visible = true;
  slot.mesh.material.opacity = 1;
  slot.mesh.position.set(
    x + (Math.random() - 0.5) * 0.2,
    0.02, // above the floor plane AND the grid helper (y 0.01): no z-fighting
    z + (Math.random() - 0.5) * 0.2,
  );
  slot.mesh.scale.setScalar(0.8 + Math.random() * 0.5);
}

export function updateBloodFX(dtMs) {
  const B = CONFIG.BLOOD;
  const dt = dtMs / 1000;

  for (const p of particles) {
    if (!p.active) continue;
    p.lifeT += dtMs;
    if (p.lifeT >= B.PARTICLE_LIFE_MS) {
      p.active = false;
      p.mesh.visible = false;
      continue;
    }
    p.vy -= B.GRAVITY * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    // Floor stop: droplets settle instead of tunnelling through the ground.
    if (p.mesh.position.y < B.PARTICLE_SIZE / 2) {
      p.mesh.position.y = B.PARTICLE_SIZE / 2;
      p.vx = 0; p.vy = 0; p.vz = 0;
    }
    // Shrink over the whole life — reaching zero IS the disappearance.
    p.mesh.scale.setScalar(1 - p.lifeT / B.PARTICLE_LIFE_MS);
  }

  for (const pool of pools) {
    if (!pool.active) continue;
    pool.t += dtMs;
    const { phase, opacity } = poolPhase(pool.t, B.POOL_LINGER_MS, B.POOL_FADE_MS);
    if (phase === 'done') {
      pool.active = false;
      pool.mesh.visible = false;
    } else {
      pool.mesh.material.opacity = opacity;
    }
  }
}

// Fresh round: every effect vanishes instantly (pooled objects just go
// inactive — nothing is disposed, the pools live for the whole session).
export function resetBloodFX() {
  for (const p of particles) {
    p.active = false;
    p.mesh.visible = false;
  }
  for (const pool of pools) {
    pool.active = false;
    pool.mesh.visible = false;
  }
}
