// render/gun.js — the placeholder viewmodel: three boxes (receiver, barrel,
// grip) composed into a Group that main.js parents to the camera, so it rides
// every look movement — the classic FPS "you only see the gun". Swapped for a
// real model later; recoil arrives in the feel pass.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

export function createGun() {
  const gun = new THREE.Group();

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

  const { GUN } = CONFIG;
  gun.position.set(GUN.OFFSET_X, GUN.OFFSET_Y, GUN.OFFSET_Z);

  return gun;
}
