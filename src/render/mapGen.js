// render/mapGen.js — generated house geometry (pass 4.1): builds the map's
// visual boxes from the parsed grid. Walls are RUN-MERGED per row
// (consecutive # cells become one stretched box) so a whole house costs a
// couple dozen draw calls, not hundreds. Windows render as sill + header
// (a climb-over barrier that reads as a window, not a missing wall);
// doorways get a header lintel so they read as doorframes.
//
// Factory only, no module-scope side effects: suite-import safe.
// This pass is VISUAL ONLY — collision is 4.2, navigation is 4.3.

import * as THREE from '../../lib/three.module.js';
import { parseLayout, cellToWorld } from '../game/mapGrid.js';

export function buildMap(map) {
  const grid = parseLayout(map);
  const group = new THREE.Group();
  group.name = `map:${map.id}`;

  const wallMat = new THREE.MeshStandardMaterial({ color: map.COLORS.WALL, roughness: 0.95 });
  const trimMat = new THREE.MeshStandardMaterial({ color: map.COLORS.TRIM, roughness: 1.0 });

  const addBox = (mat, w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    // Every map mesh is a raycast occluder (4.2): a wall eats the bullet.
    // Heights are real, so shooting OVER a sill or the fence works naturally.
    mesh.userData.kind = 'wall';
    group.add(mesh);
  };

  // — Walls: greedy run merge along each row. A run of N '#' cells becomes
  // one box N·CELL wide, full height.
  for (let r = 0; r < grid.rows; r++) {
    let c = 0;
    while (c < grid.cols) {
      if (grid.at(c, r) !== '#') { c += 1; continue; }
      let end = c;
      while (end + 1 < grid.cols && grid.at(end + 1, r) === '#') end += 1;
      const len = end - c + 1;
      const a = cellToWorld(map, grid, c, r);
      const b = cellToWorld(map, grid, end, r);
      addBox(
        wallMat,
        len * map.CELL, map.FLOOR_H, map.CELL,
        (a.x + b.x) / 2, map.FLOOR_H / 2, (a.z + b.z) / 2,
      );
      c = end + 1;
    }
  }

  // — Windows: sill below, header above, opening between — the wall line
  // stays readable and the gap is the future spawn barrier (4.3).
  for (const { c, r } of grid.windows) {
    const p = cellToWorld(map, grid, c, r);
    addBox(trimMat, map.CELL, map.WINDOW_SILL_H, map.CELL,
      p.x, map.WINDOW_SILL_H / 2, p.z);
    addBox(trimMat, map.CELL, map.HEADER_H, map.CELL,
      p.x, map.FLOOR_H - map.HEADER_H / 2, p.z);
  }

  // — Doorways (4.1b): header lintel + visible JAMB POSTS on the wall
  // axis, so a door reads as a door from across the yard, not a gap.
  // Orientation from the neighbouring wall run: # left+right = the wall is
  // horizontal, jambs sit on the cell's x edges; otherwise on the z edges.
  const JAMB = 0.18;
  for (const { c, r } of grid.doorways) {
    const p = cellToWorld(map, grid, c, r);
    addBox(trimMat, map.CELL, map.HEADER_H, map.CELL,
      p.x, map.FLOOR_H - map.HEADER_H / 2, p.z);
    const horizontal = grid.at(c - 1, r) === '#' && grid.at(c + 1, r) === '#';
    const off = map.CELL / 2 - JAMB / 2;
    if (horizontal) {
      addBox(trimMat, JAMB, map.FLOOR_H, map.CELL, p.x - off, map.FLOOR_H / 2, p.z);
      addBox(trimMat, JAMB, map.FLOOR_H, map.CELL, p.x + off, map.FLOOR_H / 2, p.z);
    } else {
      addBox(trimMat, map.CELL, map.FLOOR_H, JAMB, p.x, map.FLOOR_H / 2, p.z - off);
      addBox(trimMat, map.CELL, map.FLOOR_H, JAMB, p.x, map.FLOOR_H / 2, p.z + off);
    }
  }

  // — Fountain (4.1b): a low basin box per F cell, a centre column, and a
  // flat "water" slab across the whole footprint. Blocky, code-built.
  if (grid.fountains.length > 0) {
    const fMat = new THREE.MeshStandardMaterial({ color: map.COLORS.FOUNTAIN, roughness: 0.9 });
    const wMat = new THREE.MeshStandardMaterial({ color: map.COLORS.WATER, roughness: 0.3 });
    let sx = 0, sz = 0;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const { c, r } of grid.fountains) {
      const p = cellToWorld(map, grid, c, r);
      sx += p.x; sz += p.z;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      addBox(fMat, map.CELL, 0.7, map.CELL, p.x, 0.35, p.z); // basin rim cell
    }
    const cx = sx / grid.fountains.length;
    const cz = sz / grid.fountains.length;
    const spanX = maxX - minX; // between outer cell CENTRES
    const spanZ = maxZ - minZ;
    // Water slab sits inside the rim, just below its top.
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(spanX, map.CELL) , 0.08, Math.max(spanZ, map.CELL)), wMat,
    );
    water.position.set(cx, 0.62, cz);
    group.add(water);
    addBox(fMat, 0.5, 1.9, 0.5, cx, 0.95, cz); // centre column
    addBox(fMat, 0.9, 0.15, 0.9, cx, 1.9, cz); // column cap
  }

  // — Fence (4.1b): a low ring at the layout boundary — the visible edge
  // of the playfield; the fog swallows everything beyond it. The map edge
  // is open ground by design (no perimeter building walls).
  const FENCE_H = 0.8;
  const FENCE_T = 0.15;
  const a = cellToWorld(map, grid, 0, 0);
  const b = cellToWorld(map, grid, grid.cols - 1, grid.rows - 1);
  const west = a.x - map.CELL / 2;
  const east = b.x + map.CELL / 2;
  const north = a.z - map.CELL / 2;
  const south = b.z + map.CELL / 2;
  const w = east - west;
  const d = south - north;
  addBox(trimMat, w, FENCE_H, FENCE_T, (west + east) / 2, FENCE_H / 2, north);
  addBox(trimMat, w, FENCE_H, FENCE_T, (west + east) / 2, FENCE_H / 2, south);
  addBox(trimMat, FENCE_T, FENCE_H, d, west, FENCE_H / 2, (north + south) / 2);
  addBox(trimMat, FENCE_T, FENCE_H, d, east, FENCE_H / 2, (north + south) / 2);

  return group;
}

// — Wall-buy panels (19): the chalk outlines. One plane per BUYS entry,
// hung on the wall face the data names, drawn entirely on a CanvasTexture
// (fogBank's precedent — the no-assets rule holds; the "chalk" is strokes).
//
// The gun on the panel is not an icon: it is the WEAPON'S OWN PARTS,
// side-projected. Each registry box [w,h,d] at [x,y,z] becomes a stroked
// rect in the (z,y) plane — so the shotgun's panel shows the shotgun's
// long barrel and the SMG's shows its hanging magazine, and pass 20's gun
// draws its own chalk the day its entry exists. Nothing per-gun here.
//
// PRICE IS NOT PAINTED ON PURPOSE. A CanvasTexture is baked at build time;
// the price is registry data that pass 20 may multiply, discount, or tint —
// a baked number is a claim nothing repaints. The living text (name, price,
// affordability) belongs to the HUD prompt, which repaints on a cadence.
// The panel is the LANDMARK; the prompt is the LABEL.
import { WEAPON_TYPES } from '../data/weaponTypes.js';

const FACE_OFFSET = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const FACE_YAW = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };

function chalkTexture(weapon) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  // Chalk on plaster: near-white strokes, no fill, slightly translucent.
  ctx.strokeStyle = 'rgba(235, 230, 215, 0.9)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 236, 236); // the panel border

  // Side projection: registry z spans the horizontal, y the vertical.
  // Fit the gun's (z,y) bounding box into the middle band of the canvas.
  let minZ = Infinity; let maxZ = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const p of weapon.PARTS) {
    minZ = Math.min(minZ, p.pos[2] - p.size[2] / 2);
    maxZ = Math.max(maxZ, p.pos[2] + p.size[2] / 2);
    minY = Math.min(minY, p.pos[1] - p.size[1] / 2);
    maxY = Math.max(maxY, p.pos[1] + p.size[1] / 2);
  }
  const spanZ = maxZ - minZ;
  const spanY = maxY - minY;
  const scale = Math.min(190 / spanZ, 110 / spanY);
  // Registry -Z is downrange; canvas +x is right. Negate z so the muzzle
  // points RIGHT — the reading direction, and the way chalk guns face in
  // the reference material. Canvas y grows down; registry y grows up: flip.
  const cx = 128; const cy = 110;
  const midZ = (minZ + maxZ) / 2; const midY = (minY + maxY) / 2;
  ctx.lineWidth = 2;
  for (const p of weapon.PARTS) {
    const w = p.size[2] * scale; const h = p.size[1] * scale;
    const x = cx - (p.pos[2] - midZ) * scale - w / 2;
    const y = cy - (p.pos[1] - midY) * scale - h / 2;
    ctx.strokeRect(x, y, w, h);
  }

  // The name, chalk-printed under the gun. The price deliberately isn't
  // here — see the header.
  ctx.fillStyle = 'rgba(235, 230, 215, 0.9)';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(weapon.NAME, 128, 215);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Builds the panel meshes for a map's BUYS. Separate from buildMap so the
// caller that has no economy (Range builds no buys) simply never calls it —
// the same never-reachable-beats-guarded shape as the pickup's Range story.
export function buildBuyPanels(map) {
  const grid = parseLayout(map);
  const group = new THREE.Group();
  group.name = `buys:${map.id}`;
  for (const b of (map.BUYS ?? [])) {
    const w = WEAPON_TYPES[b.WEAPON];
    if (!w) continue; // a spot for an unshipped gun renders nothing, crashes nothing
    const [c, r] = b.CELL;
    const p = cellToWorld(map, grid, c, r);
    const [ox, oz] = FACE_OFFSET[b.FACE];
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      // Unlit and fog-free like every readable marker in this world (eyes,
      // drops): a saving goal you cannot SEE from across the square is not
      // a goal. It reads as chalk because it is strokes on plaster colour.
      new THREE.MeshBasicMaterial({ map: chalkTexture(w), transparent: true, fog: false }),
    );
    // Half a cell to the face, plus a hair to beat z-fighting with the wall.
    panel.position.set(p.x + ox * (map.CELL / 2 + 0.02), 1.5, p.z + oz * (map.CELL / 2 + 0.02));
    panel.rotation.y = FACE_YAW[b.FACE];
    group.add(panel);
  }
  return group;
}
