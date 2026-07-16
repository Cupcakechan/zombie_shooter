// render/pickups.js — the ammo drop (pass 17b): a thing the dead leave behind
// that you have to go and stand on.
//
// WHY THIS IS A WORLD OBJECT AND NOT A NUMBER THAT GOES UP. An instant grant
// on kill would deliver scarcity perfectly well — a rate below the burn rate
// still teaches conservation — and it would cost this file. It was rejected
// because of what it teaches ALONGSIDE that: ammo appearing in your pocket
// means the safest possible play (hold a corner, kill at range) is also the
// best-resourced one. The brute (wave 6) costs a whole pass to say "camping
// dies to attrition" and the spitter (wave 8) costs another to ask "are you
// MOVING?"; a drop with no location is silent in that argument, and quietly
// rebuts it. A drop with a location is the third instrument in the same
// section: the ammo is where the horde was, so holding still starves you.
//
// It is also what 17a bought. Melee is the floor precisely so the drop rate
// can be cruel (see game/melee.js's header) — and under an instant grant that
// freedom has exactly one place to go, the rate. Give the drop a PLACE and
// scarcity gets a second axis, which is a strictly larger design space and the
// one the floor paid for.
//
// Pooled and recycled from a fixed-size array like BLOOD, CASINGS and
// PROJECTILES: no allocation during play, no GC hitches, a hard cap on scene
// cost. All visuals code-built, per the project's no-assets rule.
//
// Factory-init pattern, no module-scope side effects: safe for the Node suite
// to import.
//
// THIS FILE KNOWS NOTHING ABOUT AMMO, deliberately — same split projectiles.js
// makes with damage. It reports that the player stood on a drop; main.js owns
// the weapon and decides what that is worth. The reason is not tidiness: the
// grant has to be computed at COLLECT time from the gun in your hands, not
// baked in at the kill. Bake it at spawn and a drop from a pistol kill hands
// you 12 pistol rounds while you are holding the shotgun, and the "swap before
// you step on it" decision — the whole reason the drop feeds the ACTIVE weapon
// — silently stops existing.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

let sceneRef = null;
let onCollectCb = null;
const drops = []; // { mesh, t, active }

export function initPickups(scene, { onCollect } = {}) {
  sceneRef = scene;
  onCollectCb = onCollect || null;
  if (drops.length) return; // idempotent: re-init must not double the pool

  const P = CONFIG.PICKUPS;
  // ONE shared geometry AND one shared material — the opposite call to
  // projectiles.js, and for the reason projectiles.js states rather than in
  // spite of it. A glob carries a material each because its COLOUR is
  // per-type registry data; there is exactly one kind of drop, so nothing
  // varies per instance and a shared material is simply correct. The
  // expire-blink below is deliberately built on `visible` and not on opacity
  // for the same reason — opacity is per-instance state, and reaching for it
  // would silently make twelve materials mandatory.
  const geo = new THREE.BoxGeometry(P.SIZE, P.SIZE, P.SIZE);
  // fog:false is load-bearing, same argument as the glob's and the eyes'.
  // FOG.WAVES.FAR is 13 and this arena is 36x42 — a fogged drop across the map
  // is a drop the player cannot see, and a drop the player cannot see cannot
  // ask them anything. The whole mechanic is the pull of a thing you can see
  // and have not gone to get yet.
  const mat = new THREE.MeshBasicMaterial({ color: P.COLOR, fog: false });
  for (let i = 0; i < P.MAX; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    drops.push({ mesh, t: 0, active: false });
  }
}

// Plant a drop on the floor at a dead zombie's feet.
//
// x and z ONLY, and the y is ignored on purpose — the same call spawnPool
// makes one line away in main.js. The kill callback's `pos.y` is the corpse's
// WAIST anchor, which is ~1.16 m on a stander and ~0.39 m on a crawler: honour
// it and a proto's drop floats at chest height while a crawler's sits in the
// dirt. A pickup is a floor object; the floor is where it goes.
export function spawnPickup(x, z) {
  if (!sceneRef) return null;
  let d = drops.find((p) => !p.active);
  if (!d) {
    // Pool exhausted: reclaim the OLDEST — the opposite of spawnGlob's decline
    // and for the reason spawnGlob gives. A glob is a live hit the player is
    // physically dodging, so stealing one deletes a threat they earned. A drop
    // is loot: the oldest is the one nearest to blinking out and least likely
    // to be collected, and a FRESH kill should always leave something. Same
    // call spawnBlast and spawnPool make.
    d = drops.reduce((a, b) => (a.t >= b.t ? a : b));
  }
  d.active = true;
  d.t = 0;
  d.mesh.position.set(x, CONFIG.PICKUPS.Y, z);
  d.mesh.rotation.set(0, 0, 0);
  d.mesh.visible = true;
  return d;
}

function retire(d) {
  d.active = false;
  d.mesh.visible = false;
}

export function updatePickups(dtMs, playerPos) {
  const P = CONFIG.PICKUPS;
  const dt = dtMs / 1000;
  const blinkFrom = P.LIFE_MS - P.BLINK_MS;
  for (const d of drops) {
    if (!d.active) continue;
    d.t += dtMs;

    // Bob + spin: nothing else in this world does either, which is the point.
    // Every fog-free emissive thing out there is a pair of EYES, and the hue
    // axis is fully spent (amber/orange/acid/violet). A cyan cube that hovers
    // and turns is distinguishable on three axes at once — colour, silhouette
    // and MOTION — so it can never be misread as something looking at you.
    //
    // Safe under the elapsed-time rule: `d.t` is this drop's OWN age from 0
    // and BOB_FREQ is a constant, so this is a plain periodic signal and not a
    // blended one. The rule bites when a per-frame value multiplies TOTAL
    // elapsed time; there is no blend here to do that.
    d.mesh.position.y = P.Y + Math.sin((d.t / 1000) * P.BOB_FREQ) * P.BOB_AMP;
    d.mesh.rotation.y += P.SPIN * dt;

    // Collect: XZ ONLY, no height band. projectiles.js needs the band because
    // a glob flies and can pass over your head; a drop sits on the floor and
    // the player is a floor-standing cylinder, so there is no height at which
    // you are over it and haven't got it. Adding a band here would be copying
    // the shape of that test instead of its reason.
    const dxz = Math.hypot(playerPos.x - d.mesh.position.x, playerPos.z - d.mesh.position.z);
    if (dxz <= P.RADIUS + CONFIG.PLAYER.BODY_RADIUS) {
      // The pile may be FULL, and then this drop is worth nothing — so leave
      // it where it is. It keeps its clock and you can come back once you've
      // spent something. Retiring it regardless would delete the player's ammo
      // for them, silently, for walking in a straight line.
      if (!onCollectCb || onCollectCb()) {
        retire(d);
        continue;
      }
    }

    // Expiry. The BLINK is not decoration — it is the only warning the player
    // gets, and without it a drop simply ceases to exist between two glances.
    // Visibility rather than opacity: see initPickups.
    d.mesh.visible = d.t < blinkFrom
      || Math.floor(d.t / P.BLINK_RATE_MS) % 2 === 0;
    if (d.t >= P.LIFE_MS) retire(d);
  }
}

// Fresh round: the floor is swept. Pooled meshes just go inactive — nothing is
// disposed, the pool lives for the whole session.
export function resetPickups() {
  for (const d of drops) retire(d);
}
