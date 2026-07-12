// game/flowField.js — pass 4.3: horde navigation as a flow field. One
// search from the PLAYER'S cell serves every zombie: each traversable cell
// stores the step that descends toward the player, and zombies simply read
// their cell's direction. Recomputed only when the player changes cells
// (main.js gates that) — not a path per zombie (the per-agent-A* trap the
// prior-art research documented). Pure: no THREE, no DOM — suite Section 14
// proves it in Node.
//
// 4.3b: window edges. With opts.windowCost > 0, 'W' cells become ZOMBIE
// traversal edges: stepping INTO a window costs windowCost (stepping out
// costs 1), so a crossing totals windowCost+1 vs 2 for two open steps —
// windows are shortcuts only when meaningfully shorter. windowCost 0 (the
// default) is byte-identical to the plain 4.3a field: windows blocked.
// Weighted distances use Dial's bucket queue (edge costs are small
// integers), which degenerates to plain BFS at cost 1.

// 4-connected expansion — the SAME connectivity as floodReachable, so at
// windowCost 0 the field's coverage equals the flood's coverage by
// construction (the suite asserts both against countWalkable).
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Diagonals are DIRECTIONS, not search edges: distances stay orthogonal,
// but a cell may point diagonally when that neighbor is strictly closer —
// this is what turns staircase walks into straight diagonal walks in the
// open. Diagonals never touch windows: the corner guard requires both
// flanking cells to be PLAIN walkable, and a window's flanks along its
// wall run are '#' anyway.
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// Build the field toward `target` ({c,r} — the player's cell). Returns
// { cols, rows, target, distAt, dirAt, stepAt }:
//   distAt(c,r) — weighted cell-distance to the target; Infinity off-field.
//   stepAt(c,r) — the integer descent step {dc,dr}, or null (target cell,
//                 blocked, unreached, out of bounds).
//   dirAt(c,r)  — stepAt normalized to a world-space unit {x,z}
//                 (+c is +x, +r is +z, per cellToWorld), or null.
// GUARDED: an invalid target (blocked / out of bounds) yields an all-null
// field instead of throwing — callers fall back to the beeline, because a
// throw here would land inside the render loop.
export function buildFlowField(grid, target, opts = {}) {
  const windowCost = Math.max(0, Math.floor(opts.windowCost ?? 0));
  const { cols, rows } = grid;
  const n = cols * rows;
  const idx = (c, r) => r * cols + c;
  const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;

  // What the field may traverse: everything the player walks, plus windows
  // when they're priced in. (Bodies never STAND in a window — the vault
  // scripts them across — but the field prices the crossing.)
  const traversable = (c, r) =>
    grid.walkable(c, r) || (windowCost > 0 && grid.at(c, r) === 'W');
  // What a step into a cell costs: the climb is expensive, floor is 1.
  const enterCost = (c, r) => (grid.at(c, r) === 'W' ? windowCost : 1);

  // -1 = unreached (blocked cells stay -1 forever).
  const dist = new Int32Array(n).fill(-1);

  const validTarget =
    !!target && inBounds(target.c, target.r) && grid.walkable(target.c, target.r);

  if (validTarget) {
    // Dial's bucket queue: buckets[d] holds cells settled at distance d.
    // Edge costs are 1 or windowCost, so distances are dense small
    // integers — no heap needed, and at windowCost 0 this IS plain BFS.
    const buckets = [[idx(target.c, target.r)]];
    dist[idx(target.c, target.r)] = 0;
    const cOf = (i) => i % cols;
    const rOf = (i) => (i - (i % cols)) / cols;
    for (let d = 0; d < buckets.length; d++) {
      const bucket = buckets[d];
      if (!bucket) continue;
      for (let b = 0; b < bucket.length; b++) {
        const i = bucket[b];
        if (dist[i] !== d) continue; // stale entry: settled cheaper already
        const c = cOf(i);
        const r = rOf(i);
        for (const [dc, dr] of ORTHO) {
          const nc = c + dc;
          const nr = r + dr;
          if (!traversable(nc, nr)) continue; // walkable()/at() bounds-check
          const ni = idx(nc, nr);
          const nd = d + enterCost(nc, nr);
          if (dist[ni] !== -1 && dist[ni] <= nd) continue;
          dist[ni] = nd;
          (buckets[nd] ??= []).push(ni);
        }
      }
    }
  }

  // Precompute every cell's descent step once rather than scanning
  // neighbors per zombie per frame. 0,0 = no step.
  const stepC = new Int8Array(n);
  const stepR = new Int8Array(n);
  if (validTarget) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = idx(c, r);
        if (dist[i] <= 0) continue; // blocked, unreached, or the target itself
        let best = dist[i];
        let bc = 0;
        let br = 0;
        // Orthogonals FIRST: ties prefer the straight step; a diagonal wins
        // only when strictly closer.
        for (const [dc, dr] of ORTHO) {
          const nc = c + dc;
          const nr = r + dr;
          if (!traversable(nc, nr)) continue;
          const nd = dist[idx(nc, nr)];
          if (nd !== -1 && nd < best) { best = nd; bc = dc; br = dr; }
        }
        for (const [dc, dr] of DIAG) {
          const nc = c + dc;
          const nr = r + dr;
          // Diagonals only land on PLAIN walkable cells, and the corner
          // guard demands plain-walkable flanks: a diagonal step must not
          // shave a wall corner OR a window sill — both are solid geometry
          // a body following the direction would grind into.
          if (!grid.walkable(nc, nr)) continue;
          if (!grid.walkable(c + dc, r) || !grid.walkable(c, r + dr)) continue;
          const nd = dist[idx(nc, nr)];
          if (nd !== -1 && nd < best) { best = nd; bc = dc; br = dr; }
        }
        // A reached cell always has its search parent strictly closer among
        // the orthogonals (dist = parent + enterCost, enterCost >= 1), so
        // bc/br are never left 0,0 here.
        stepC[i] = bc;
        stepR[i] = br;
      }
    }
  }

  const INV_SQRT2 = Math.SQRT1_2;

  return {
    cols,
    rows,
    target: validTarget ? { c: target.c, r: target.r } : null,

    distAt(c, r) {
      if (!inBounds(c, r)) return Infinity;
      const d = dist[idx(c, r)];
      return d === -1 ? Infinity : d;
    },

    stepAt(c, r) {
      if (!inBounds(c, r)) return null;
      const i = idx(c, r);
      if (stepC[i] === 0 && stepR[i] === 0) return null;
      return { dc: stepC[i], dr: stepR[i] };
    },

    dirAt(c, r) {
      const s = this.stepAt(c, r);
      if (!s) return null;
      const k = (s.dc !== 0 && s.dr !== 0) ? INV_SQRT2 : 1;
      return { x: s.dc * k, z: s.dr * k };
    },
  };
}
