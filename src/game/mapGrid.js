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

// The inverse of cellToWorld (pass 4.3): which cell CONTAINS a world point.
// ROUND, not floor — cellToWorld returns cell CENTRES, so the containing
// cell is the nearest centre (each cell spans centre ± CELL/2). May return
// out-of-range indices for points beyond the map; callers treat those as
// off-grid (the field returns null there and zombies fall back to the
// beeline).
export function worldToCell(map, grid, x, z) {
  return {
    c: Math.round((x - map.ANCHOR.x) / map.CELL + (grid.cols - 1) / 2),
    r: Math.round((z - map.ANCHOR.z) / map.CELL + (grid.rows - 1) / 2),
  };
}

// The EXTERIOR region (4.3c): every walkable cell reachable from the map
// boundary WITHOUT passing through a door or window — i.e. the streets
// and plaza, never a room interior. This is how spawn geometry knows a
// window's outside from its inside without any hand-authored hints: flood
// from all boundary walkables treating 'D' and 'W' as solid (rooms are
// sealed without their openings). Returns a Set of 'c,r' keys.
export function exteriorCells(grid) {
  const { cols, rows } = grid;
  const out = new Set();
  const open = (c, r) => grid.at(c, r) === '.' || grid.at(c, r) === 'P';
  const queue = [];
  for (let c = 0; c < cols; c++) {
    for (const r of [0, rows - 1]) {
      if (open(c, r) && !out.has(`${c},${r}`)) { out.add(`${c},${r}`); queue.push([c, r]); }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (const c of [0, cols - 1]) {
      if (open(c, r) && !out.has(`${c},${r}`)) { out.add(`${c},${r}`); queue.push([c, r]); }
    }
  }
  let head = 0;
  while (head < queue.length) {
    const [c, r] = queue[head];
    head += 1;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      const key = `${nc},${nr}`;
      if (!open(nc, nr) || out.has(key)) continue;
      out.add(key);
      queue.push([nc, nr]);
    }
  }
  return out;
}

// Grid-derived perimeter spawn candidates (4.3c): walkable cells on the
// map's outermost ring — inside the fog bank, outside every building.
// Replaces hand-authored SPAWN_POINTS (two of which sat inside wall
// cells, working only via frame-one resolver ejection — LESSONS).
// `edges` selects which sides of the ring qualify: the village's SOUTH
// edge (row rows−1, z +2.6) sits 1.4 m short of the front fog bank
// (z ≥ 4), so spawning there would pop into view — main passes
// north/east/west and the suite proves the chosen set fully bank-covered.
export function perimeterSpawnCells(grid, edges = ['north', 'south', 'east', 'west']) {
  const { cols, rows } = grid;
  const wantN = edges.includes('north');
  const wantS = edges.includes('south');
  const wantW = edges.includes('west');
  const wantE = edges.includes('east');
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const onEdge = (wantN && r === 0) || (wantS && r === rows - 1)
        || (wantW && c === 0) || (wantE && c === cols - 1);
      if (!onEdge) continue;
      if (grid.walkable(c, r)) cells.push({ c, r });
    }
  }
  return cells;
}

// Window entry spots (4.3c): for every CONNECTED window (both
// perpendicular neighbors walkable), which side is the street and which
// is the room — via the exterior flood, exactly one of the two must be
// exterior. Windows violating that (edge windows facing off-map, or a
// window between two rooms) are silently excluded: not entry-capable.
// Returns [{ wc, wr, outC, outR, inC, inR }].
export function windowEntrySpots(grid) {
  const ext = exteriorCells(grid);
  const spots = [];
  for (const { c, r } of grid.windows) {
    for (const [dc, dr] of [[0, 1], [1, 0]]) { // the two perpendicular axes
      const a = { c: c - dc, r: r - dr };
      const b = { c: c + dc, r: r + dr };
      if (!grid.walkable(a.c, a.r) || !grid.walkable(b.c, b.r)) continue;
      const aExt = ext.has(`${a.c},${a.r}`);
      const bExt = ext.has(`${b.c},${b.r}`);
      if (aExt === bExt) continue; // both rooms or both streets: not an entry
      const outside = aExt ? a : b;
      const inside = aExt ? b : a;
      spots.push({ wc: c, wr: r, outC: outside.c, outR: outside.r, inC: inside.c, inR: inside.r });
    }
  }
  return spots;
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
  // The fence is solid (4.2b): thick bands extending OUTWARD from the
  // boundary line — the inner face sits exactly at the visible fence, and
  // the metre of invisible solid beyond it means a body on the line always
  // ejects INWARD (the suite probe caught the thin-box version ejecting to
  // the wrong side). The arena clamp beyond is backstop.
  const t = 0.15 / 2;   // visible fence half-thickness (inner face offset)
  const BAND = 1.0;     // invisible solid depth beyond the line
  const wCell = cellToWorld(map, grid, 0, 0);
  const eCell = cellToWorld(map, grid, grid.cols - 1, grid.rows - 1);
  const west = wCell.x - map.CELL / 2;
  const east = eCell.x + map.CELL / 2;
  const north = wCell.z - map.CELL / 2;
  const south = eCell.z + map.CELL / 2;
  boxes.push({ minX: west - BAND, maxX: east + BAND, minZ: north - BAND, maxZ: north + t });
  boxes.push({ minX: west - BAND, maxX: east + BAND, minZ: south - t, maxZ: south + BAND });
  boxes.push({ minX: west - BAND, maxX: west + t, minZ: north, maxZ: south });
  boxes.push({ minX: east - t, maxX: east + BAND, minZ: north, maxZ: south });
  return boxes;
}
