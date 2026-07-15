// render/gun.js — the viewmodels plus their feel: recoil kick and muzzle
// flash. Same pattern as targets.js: module-level instances, a factory that
// builds them, kick() to trigger, updateGun(dt) driven from the frame loop.
// main.js calls kick() on every REAL shot — cooldown-ignored clicks never
// kick, because the gun didn't fire, and a shotgun's eight pellets kick ONCE
// because eight pellets are one shot (see shooting.js).
//
// Pass 17: every gun in WEAPON_ORDER is built AT INIT and swapping only
// toggles visibility. Building on swap would compile a MeshStandardMaterial
// mid-round — a guaranteed hitch the first time you press 2 with a horde on
// you, and the hitch would land at the exact moment you most needed the frame.
// It is the same reasoning as the pooled FX modules: pay the cost once, at a
// moment nobody is being chased.
//
// The gun's SHAPE is data now (weaponTypes.js PARTS). This file knows how to
// draw boxes and how recoil feels; it does not know what a shotgun is.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';
import { WEAPON_TYPES, WEAPON_ORDER } from '../data/weaponTypes.js';

// The group parented to the camera; every weapon hangs off it. One shared
// anchor on purpose — both guns are held by the same hands, so the offset is
// a property of the player, not of the weapon. A per-weapon offset would be a
// field with no proven need, and 18 can add one the day a gun actually needs it.
let root = null;
const models = {}; // id -> { group, flash, light, weapon }
let active = null; // the { group, flash, light, weapon } currently drawn

// Infinity = animation inactive; 0..MS = animating.
let recoilT = Infinity;
let flashT = Infinity;

export function createGuns() {
  root = new THREE.Group();

  for (const id of WEAPON_ORDER) {
    const w = WEAPON_TYPES[id];
    const group = new THREE.Group();

    // A material PER PART, not one per gun: the shotgun's wood furniture is
    // what makes a code-built gun read AS a shotgun at viewmodel distance —
    // the silhouette alone is just a long pistol. Every override is optional
    // and falls back to the weapon's defaults, so the pistol's three boxes
    // still share one look with no per-part fields at all.
    for (const p of w.PARTS) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]),
        new THREE.MeshStandardMaterial({
          color: p.color ?? w.COLOR,
          roughness: p.rough ?? w.ROUGH,
          metalness: p.metal ?? w.METAL,
        }),
      );
      mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      group.add(mesh);
    }

    // — Muzzle flash: an additive quad at the barrel tip. depthWrite off so a
    // transparent quad this close to the camera can't punch a hole in the
    // depth buffer.
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.12),
      new THREE.MeshBasicMaterial({
        color: 0xffd27a,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    flash.position.set(w.MUZZLE[0], w.MUZZLE[1], w.MUZZLE[2]);
    flash.visible = false;
    group.add(flash);

    // — Muzzle light: what makes nearby walls catch the pop. Intensity 0 when
    // idle; distance keeps the cost local.
    const light = new THREE.PointLight(0xffc060, 0, 10, 2);
    light.position.set(w.MUZZLE[0], w.MUZZLE[1], w.MUZZLE[2]);
    group.add(light);

    group.visible = false;
    root.add(group);
    models[id] = { group, flash, light, weapon: w };
  }

  const { GUN } = CONFIG;
  root.position.set(GUN.OFFSET_X, GUN.OFFSET_Y, GUN.OFFSET_Z);
  setActiveGun(WEAPON_ORDER[0]);
  return root;
}

// Draw a different weapon. Returns false for an unknown id rather than
// throwing — the caller is a keypress.
export function setActiveGun(id) {
  const next = models[id];
  if (!next) return false;
  if (active) {
    active.group.visible = false;
    // Kill an in-flight flash on the gun being holstered, or it comes back
    // still lit the next time you draw it.
    active.flash.visible = false;
    active.light.intensity = 0;
  }
  active = next;
  active.group.visible = true;
  // A swap lands the new gun at rest: no inherited recoil from the last one.
  recoilT = Infinity;
  flashT = Infinity;
  root.position.z = CONFIG.GUN.OFFSET_Z;
  root.rotation.x = 0;
  return true;
}

export function getActiveGunId() {
  return active?.weapon.id ?? null;
}

// Reload progress is INJECTED (main wires ammo.js in) so the render module
// stays ignorant of game rules — same inversion as shooting's canFire.
let reloadProgressCb = () => 0;
export function setReloadProgressSource(fn) {
  reloadProgressCb = fn;
}

export function kick() {
  if (!active) return;
  recoilT = 0;
  flashT = 0;
  active.flash.visible = true;
  // Fresh roll + size each shot so consecutive flashes don't read as one
  // static sprite blinking.
  active.flash.rotation.z = Math.random() * Math.PI * 2;
  const s = 0.8 + Math.random() * 0.5;
  active.flash.scale.set(s, s, 1);
  active.flash.material.opacity = 1;
  active.light.intensity = CONFIG.FLASH_INTENSITY;
}

export function updateGun(dtMs) {
  if (!active) return;
  const w = active.weapon;

  // — Reload dip (pass 9): a sine envelope over reload progress — 0 at the
  // ends, full dip at the midpoint — so the gun swings down and back up in
  // one motion. Writes ONLY position.y; recoil owns z and rotation.x, so the
  // two never fight. progress 0 (idle) lands y exactly on base.
  root.position.y = CONFIG.GUN.OFFSET_Y
    - Math.sin(reloadProgressCb() * Math.PI) * CONFIG.GUN.RELOAD_DIP;

  // — Recoil: instant kick, eased return. amp = (1-k)^2 starts at full
  // deflection and settles with a fast-then-soft curve over the WEAPON's
  // RECOIL_MS. Positive rotation.x raises the barrel (front of a -Z-facing
  // object rises under +X rotation — hand-derived, don't "fix" the sign).
  if (recoilT < w.RECOIL_MS) {
    recoilT += dtMs;
    const k = Math.min(1, recoilT / w.RECOIL_MS);
    const amp = (1 - k) * (1 - k);
    root.position.z = CONFIG.GUN.OFFSET_Z + w.RECOIL_BACK * amp;
    root.rotation.x = ((w.RECOIL_DEG * Math.PI) / 180) * amp;
    if (k >= 1) {
      // Land exactly on base so repeated shots can't accumulate drift.
      root.position.z = CONFIG.GUN.OFFSET_Z;
      root.rotation.x = 0;
    }
  }

  // — Flash: fades out over FLASH_MS, then fully off.
  if (flashT < CONFIG.FLASH_MS) {
    flashT += dtMs;
    const k = Math.min(1, flashT / CONFIG.FLASH_MS);
    active.flash.material.opacity = 1 - k;
    active.light.intensity = CONFIG.FLASH_INTENSITY * (1 - k);
    if (k >= 1) {
      active.flash.visible = false;
      active.light.intensity = 0;
    }
  }
}
