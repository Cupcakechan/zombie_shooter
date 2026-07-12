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

  // — Doorways: a header lintel only (walkable below) — reads as a frame.
  for (const { c, r } of grid.doorways) {
    const p = cellToWorld(map, grid, c, r);
    addBox(trimMat, map.CELL, map.HEADER_H, map.CELL,
      p.x, map.FLOOR_H - map.HEADER_H / 2, p.z);
  }

  return group;
}
