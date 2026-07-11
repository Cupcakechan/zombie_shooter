// render/gun.js — the viewmodel plus its feel: recoil kick and muzzle flash.
// Same pattern as targets.js: one module-level instance, a factory that
// builds it, kick() to trigger, updateGun(dt) driven from the frame loop.
// main.js calls kick() on every REAL shot (hit or miss) — cooldown-ignored
// clicks never kick, because the gun didn't fire.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

const KICK_UP_RAD = (CONFIG.RECOIL_KICK_DEG * Math.PI) / 180;

let gun = null;
let flash = null;
let flashLight = null;
// Infinity = animation inactive; 0..MS = animating.
let recoilT = Infinity;
let flashT = Infinity;

export function createGun() {
  gun = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({
    color: 0x1c2124,
    roughness: 0.55,
    metalness: 0.35,
  });

  // Receiver / body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 0.34), metal);
  gun.add(body);

  // Barrel — extends forward (-Z) from the body's front
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.30), metal);
  barrel.position.set(0, 0.03, -0.28);
  gun.add(barrel);

  // Grip — angled slightly back under the body
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), metal);
  grip.position.set(0, -0.13, 0.09);
  grip.rotation.x = 0.28;
  gun.add(grip);

  // — Muzzle flash: an additive quad at the barrel tip. depthWrite off so a
  // transparent quad this close to the camera can't punch a hole in the
  // depth buffer.
  flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.12),
    new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.position.set(0, 0.03, -0.45); // just past the barrel tip (z -0.43)
  flash.visible = false;
  gun.add(flash);

  // — Muzzle light: what makes nearby walls catch the pop. Intensity 0 when
  // idle; distance keeps the cost local.
  flashLight = new THREE.PointLight(0xffc060, 0, 10, 2);
  flashLight.position.set(0, 0.03, -0.45);
  gun.add(flashLight);

  const { GUN } = CONFIG;
  gun.position.set(GUN.OFFSET_X, GUN.OFFSET_Y, GUN.OFFSET_Z);

  return gun;
}

export function kick() {
  if (!gun) return;
  recoilT = 0;
  flashT = 0;
  flash.visible = true;
  // Fresh roll + size each shot so consecutive flashes don't read as one
  // static sprite blinking.
  flash.rotation.z = Math.random() * Math.PI * 2;
  const s = 0.8 + Math.random() * 0.5;
  flash.scale.set(s, s, 1);
  flash.material.opacity = 1;
  flashLight.intensity = CONFIG.FLASH_INTENSITY;
}

export function updateGun(dtMs) {
  if (!gun) return;

  // — Recoil: instant kick, eased return. amp = (1-k)^2 starts at full
  // deflection and settles with a fast-then-soft curve over RECOIL_MS.
  // Positive rotation.x raises the barrel (front of a -Z-facing object
  // rises under +X rotation — hand-derived, don't "fix" the sign).
  if (recoilT < CONFIG.RECOIL_MS) {
    recoilT += dtMs;
    const k = Math.min(1, recoilT / CONFIG.RECOIL_MS);
    const amp = (1 - k) * (1 - k);
    gun.position.z = CONFIG.GUN.OFFSET_Z + CONFIG.RECOIL_KICK_BACK * amp;
    gun.rotation.x = KICK_UP_RAD * amp;
    if (k >= 1) {
      // Land exactly on base so repeated shots can't accumulate drift.
      gun.position.z = CONFIG.GUN.OFFSET_Z;
      gun.rotation.x = 0;
    }
  }

  // — Flash: fades out over FLASH_MS, then fully off.
  if (flashT < CONFIG.FLASH_MS) {
    flashT += dtMs;
    const k = Math.min(1, flashT / CONFIG.FLASH_MS);
    flash.material.opacity = 1 - k;
    flashLight.intensity = CONFIG.FLASH_INTENSITY * (1 - k);
    if (k >= 1) {
      flash.visible = false;
      flashLight.intensity = 0;
    }
  }
}
