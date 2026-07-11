// render/scene.js — builds the range environment (floor, walls, lights, fog).
// Factory only, no module-scope side effects: safe for the Node suite to
// import, and nothing exists until main.js asks for it.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

export function createRange() {
  const { RANGE, FOG, COLORS } = CONFIG;
  const depth = RANGE.FRONT_Z - RANGE.BACK_Z;
  const centerZ = (RANGE.FRONT_Z + RANGE.BACK_Z) / 2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.SKY);
  // Fog colour matches the background so distance fades into "sky" seamlessly.
  scene.fog = new THREE.Fog(COLORS.SKY, FOG.NEAR, FOG.FAR);

  // — Lights —
  scene.add(new THREE.HemisphereLight(COLORS.HEMI_SKY, COLORS.HEMI_GROUND, 0.85));
  const sun = new THREE.DirectionalLight(COLORS.SUN, 0.9);
  sun.position.set(8, 12, 6);
  scene.add(sun);

  // — Floor —
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(RANGE.WIDTH, depth),
    new THREE.MeshStandardMaterial({ color: COLORS.FLOOR }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, centerZ);
  scene.add(floor);

  // Grid gives depth perception in the placeholder stage. Slight Y offset
  // avoids z-fighting with the floor plane.
  const grid = new THREE.GridHelper(
    RANGE.WIDTH,
    RANGE.WIDTH,
    COLORS.GRID_MAJOR,
    COLORS.GRID_MINOR,
  );
  grid.position.set(0, 0.01, centerZ);
  scene.add(grid);

  // — Walls — single-sided planes, each rotated to face INTO the range so
  // there's no doubled geometry and misses always land on something visible.
  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.WALL });
  const halfH = RANGE.WALL_HEIGHT / 2;

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(RANGE.WIDTH, RANGE.WALL_HEIGHT), wallMat);
  back.position.set(0, halfH, RANGE.BACK_Z); // default plane faces +Z: inward
  scene.add(back);

  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(RANGE.WIDTH, RANGE.WALL_HEIGHT), wallMat);
  front.position.set(0, halfH, RANGE.FRONT_Z);
  front.rotation.y = Math.PI; // face -Z: inward (this wall is behind the player)
  scene.add(front);

  const left = new THREE.Mesh(
    new THREE.PlaneGeometry(depth, RANGE.WALL_HEIGHT), wallMat);
  left.position.set(-RANGE.WIDTH / 2, halfH, centerZ);
  left.rotation.y = Math.PI / 2; // face +X: inward
  scene.add(left);

  const right = new THREE.Mesh(
    new THREE.PlaneGeometry(depth, RANGE.WALL_HEIGHT), wallMat);
  right.position.set(RANGE.WIDTH / 2, halfH, centerZ);
  right.rotation.y = -Math.PI / 2; // face -X: inward
  scene.add(right);

  return scene;
}
