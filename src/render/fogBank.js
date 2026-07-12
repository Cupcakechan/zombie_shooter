// render/fogBank.js — the perimeter fog bank: fixed translucent curtains
// hugging the arena walls so zombies spawn inside the murk and walk out of
// it (pass 8.1, Waves atmosphere). Scene fog (THREE.Fog) can't do this job:
// it fades by distance from the CAMERA, so it recedes as the player kites
// toward a wall — a bank that stays put has to be real geometry.
//
// Factory only, no module-scope side effects (same convention as scene.js):
// safe for the Node suite to import; the canvas texture is only created when
// main.js actually calls createFogBank() in a browser.
//
// Maze future (Daniel, 2026-07-11): when the arena becomes a maze, fog moves
// from the perimeter to the spawn windows — the layer/texture code here is
// the reusable piece; only the placement loop changes.

import * as THREE from '../../lib/three.module.js';
import { CONFIG } from '../config.js';

// A soft vertical gradient (dense at the ground, clear at the top), painted
// in the sky/fog colour so the bank blends into the distance fade. Generated
// in code — no image assets, per the project's no-assets rule.
function makeGradientTexture(hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 2; // horizontal is uniform; 2 px keeps GPU sampling happy
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const c = new THREE.Color(hexColor);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  const grad = ctx.createLinearGradient(0, canvas.height, 0, 0); // bottom → top
  grad.addColorStop(0.0, `rgba(${rgb},1)`);
  grad.addColorStop(0.55, `rgba(${rgb},0.85)`);
  grad.addColorStop(1.0, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new THREE.CanvasTexture(canvas);
}

export function createFogBank() {
  const { RANGE, FOG, COLORS } = CONFIG;
  const B = FOG.BANK;
  const group = new THREE.Group();
  group.name = 'fogBank';

  const tex = makeGradientTexture(COLORS.SKY);
  const arenaDepth = RANGE.FRONT_Z - RANGE.BACK_Z;
  const centerZ = (RANGE.FRONT_Z + RANGE.BACK_Z) / 2;
  const halfW = RANGE.WIDTH / 2;

  // One material per layer index, shared across all four walls: opacity
  // eases from OPACITY_MAX at the wall to OPACITY_MIN at the inner edge.
  // depthWrite stays OFF so curtains never occlude each other (or fading
  // zombies) in the depth buffer; default back-to-front transparent sorting
  // stacks them correctly, and an emerging zombie draws veiled behind
  // whichever layers are still between it and the camera.
  const layerMats = [];
  for (let i = 0; i < B.LAYERS; i++) {
    const t = B.LAYERS === 1 ? 0 : i / (B.LAYERS - 1);
    layerMats.push(new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: B.OPACITY_MAX + (B.OPACITY_MIN - B.OPACITY_MAX) * t,
      depthWrite: false,
      side: THREE.DoubleSide, // readable from inside the bank too
    }));
  }

  const wallGeo = new THREE.PlaneGeometry(RANGE.WIDTH, B.HEIGHT); // back/front
  const sideGeo = new THREE.PlaneGeometry(arenaDepth, B.HEIGHT); // left/right

  // Layer i sits (i + 0.5)/LAYERS of the way into its bank's depth: half a
  // step off the wall face (no z-fighting with the wall plane) and half a
  // step short of the inner boundary.
  const inset = (depth, i) => depth * ((i + 0.5) / B.LAYERS);

  for (let i = 0; i < B.LAYERS; i++) {
    const mat = layerMats[i];

    const back = new THREE.Mesh(wallGeo, mat);
    back.position.set(0, B.HEIGHT / 2, RANGE.BACK_Z + inset(B.DEPTH.BACK, i));
    group.add(back);

    const front = new THREE.Mesh(wallGeo, mat);
    front.position.set(0, B.HEIGHT / 2, RANGE.FRONT_Z - inset(B.DEPTH.FRONT, i));
    group.add(front);

    const left = new THREE.Mesh(sideGeo, mat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-halfW + inset(B.DEPTH.SIDE, i), B.HEIGHT / 2, centerZ);
    group.add(left);

    const right = new THREE.Mesh(sideGeo, mat);
    right.rotation.y = Math.PI / 2;
    right.position.set(halfW - inset(B.DEPTH.SIDE, i), B.HEIGHT / 2, centerZ);
    group.add(right);
  }

  return group;
}
