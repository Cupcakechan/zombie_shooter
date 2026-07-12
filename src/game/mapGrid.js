// game/mapGrid.js — pure map logic (pass 4.1): parse the ASCII layout,
// prove reachability, and map cells to world space. No THREE, no DOM —
// everything here is suite-provable in Node, and the flood fill is the
// seed of pass 4.3's flow-field navigation.

// Parse a map's layout into a queryable grid.
// Returns { cols, rows, walkable(c,r), at(c,r), playerStart:{c,r},
//           windows:[{c,r}], doorways:[{c,r}] } — or throws on a malformed
// layout (the suite asserts the good path AND the invariants).
export function parseLayout(map) {
  const rows = map.layout.length;
  const cols = map.layout[0].length;
  const windows = [];
  const doorways = [];
  const fountains = [];
  let playerStart = null;
  for (let r = 0; r < rows; r++) {
    if (map.layout[r].length !== cols) {
      throw new Error(`mapGrid: row ${r} length ${map.layout[r].length} !== ${cols}`);
    }
    for (let c = 0; c < cols; c++) {
      const ch = map.layout[r][c];
      if (ch === 'W') windows.push({ c, r });
      if (ch === 'D') doorways.push({ c, r });
      if (ch === 'F') fountains.push({ c, r });
      if (ch === 'P') {
        if (playerStart) throw new Error('mapGrid: more than one P');
        playerStart = { c, r };
      }
    }
  }
  const at = (c, r) =>
    (c >= 0 && c < cols && r >= 0 && r < rows) ? map.layout[r][c] : '#';
  // Walls and windows block; floor, doorways, and the start are walkable.
  const walkable = (c, r) => {
    const ch = at(c, r);
    return ch === '.' || ch === 'D' || ch === 'P';
  };
  return { cols, rows, at, walkable, playerStart, windows, doorways, fountains };
}

// Flood fill from the start over walkable cells (4-connected). Returns the
// set of reached cells as 'c,r' keys. The suite asserts it covers EVERY
// walkable cell — a sealed room cannot ship. Pass 4.3 grows this same
// traversal into the flow field.
export function floodReachable(grid) {
  const seen = new Set();
  if (!grid.playerStart) return seen;
  const queue = [grid.playerStart];
  seen.add(`${grid.playerStart.c},${grid.playerStart.r}`);
  while (queue.length) {
    const { c, r } = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      const key = `${nc},${nr}`;
      if (seen.has(key) || !grid.walkable(nc, nr)) continue;
      seen.add(key);
      queue.push({ c: nc, r: nr });
    }
  }
  return seen;
}

// Count every walkable cell (the flood's coverage target).
export function countWalkable(grid) {
  let n = 0;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.walkable(c, r)) n += 1;
    }
  }
  return n;
}

// World mapping (4.1b): the map is CENTRED on its ANCHOR (a world point in
// the map registry) and the player spawns wherever P is — the map owns the
// start. +c goes +x, +r goes +z (layout top = far from the default camera).
export function cellToWorld(map, grid, c, r) {
  return {
    x: map.ANCHOR.x + (c - (grid.cols - 1) / 2) * map.CELL,
    z: map.ANCHOR.z + (r - (grid.rows - 1) / 2) * map.CELL,
  };
}

// Where a fresh round puts the player for this map.
export function playerWorldStart(map, grid) {
  return cellToWorld(map, grid, grid.playerStart.c, grid.playerStart.r);
}

// Collision (pass 4.2): every BLOCKED cell (walls, window sills, fountain)
// becomes part of a 2D AABB, run-merged along rows exactly like the visual
// geometry — the colliders and the boxes derive from the same cells, so
// they cannot disagree. The fence is NOT here: the arena clamp already
// bounds movement at the map edge.
export function buildColliders(map, grid) {
  const blocked = (c, r) => 'W#F'.includes(grid.at(c, r));
  const boxes = [];
  for (let r = 0; r < grid.rows; r++) {
    let c = 0;
    while (c < grid.cols) {
      if (!blocked(c, r)) { c += 1; continue; }
      let end = c;
      while (end + 1 < grid.cols && blocked(end + 1, r)) end += 1;
      const a = cellToWorld(map, grid, c, r);
      const b = cellToWorld(map, grid, end, r);
      boxes.push({
        minX: a.x - map.CELL / 2,
        maxX: b.x + map.CELL / 2,
        minZ: a.z - map.CELL / 2,
        maxZ: b.z + map.CELL / 2,
      });
      c = end + 1;
    }
  }
  return boxes;
}
