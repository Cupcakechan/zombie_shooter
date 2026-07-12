// game/flowField.js — pass 4.3: horde navigation as a flow field. One BFS
// from the PLAYER'S cell serves every zombie: each walkable cell stores the
// step that descends toward the player, and zombies simply read their
// cell's direction. Recomputed only when the player changes cells (main.js
// gates that), so the cost is one ~500-cell BFS per player cell-change —
// not a path per zombie (the per-agent-A* trap the prior-art research
// documented). Pure: no THREE, no DOM — suite Section 14 proves it in Node.

// 4-connected expansion — the SAME connectivity as floodReachable, so the
// field's coverage equals the flood's coverage by construction (the suite
// asserts both against countWalkable).
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Diagonals are DIRECTIONS, not BFS edges: distances stay 4-way, but a
// cell may point diagonally when that neighbor is strictly closer — this
// is what turns staircase walks into straight diagonal walks in the open.
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// Build the field toward `target` ({c,r} — the player's cell). Returns
// { cols, rows, target, distAt, dirAt, stepAt }:
//   distAt(c,r) — BFS cell-distance to the target; Infinity off-field.
//   stepAt(c,r) — the integer descent step {dc,dr}, or null (target cell,
//                 blocked, unreached, out of bounds).
//   dirAt(c,r)  — stepAt normalized to a world-space unit {x,z}
//                 (+c is +x, +r is +z, per cellToWorld), or null.
// GUARDED: an invalid target (blocked / out of bounds) yields an all-null
// field instead of throwing — callers fall back to the beeline, because a
// throw here would land inside the render loop.
export function buildFlowField(grid, target) {
  const { cols, rows } = grid;
  const n = cols * rows;
  const idx = (c, r) => r * cols + c;
  const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;

  // -1 = unreached (blocked cells stay -1 forever).
  const dist = new Int32Array(n).fill(-1);

  const validTarget =
    !!target && inBounds(target.c, target.r) && grid.walkable(target.c, target.r);

  if (validTarget) {
    // Ring-buffer BFS: head/tail indices, no O(n) shifts.
    const qc = new Int32Array(n);
    const qr = new Int32Array(n);
    let head = 0;
    let tail = 0;
    qc[tail] = target.c;
    qr[tail] = target.r;
    tail += 1;
    dist[idx(target.c, target.r)] = 0;
    while (head < tail) {
      const c = qc[head];
      const r = qr[head];
      head += 1;
      const d = dist[idx(c, r)];
      for (const [dc, dr] of ORTHO) {
        const nc = c + dc;
        const nr = r + dr;
        if (!grid.walkable(nc, nr)) continue; // walkable() bounds-checks via at()
        const ni = idx(nc, nr);
        if (dist[ni] !== -1) continue;
        dist[ni] = d + 1;
        qc[tail] = nc;
        qr[tail] = nr;
        tail += 1;
      }
    }
  }

  // Precompute every cell's descent step once (~500 cells) rather than
  // scanning neighbors per zombie per frame. 0,0 = no step.
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
        // only when strictly closer (on a 4-way field the toward-target
        // diagonal is often dist−2 in the open, so diagonals DO get used).
        for (const [dc, dr] of ORTHO) {
          const nc = c + dc;
          const nr = r + dr;
          if (!grid.walkable(nc, nr)) continue;
          const nd = dist[idx(nc, nr)];
          if (nd !== -1 && nd < best) { best = nd; bc = dc; br = dr; }
        }
        for (const [dc, dr] of DIAG) {
          const nc = c + dc;
          const nr = r + dr;
          if (!grid.walkable(nc, nr)) continue;
          // Corner guard: a diagonal step must not shave a wall corner —
          // BOTH orthogonal cells beside it have to be open, or a body
          // following the direction grinds into the corner the grid says
          // isn't there.
          if (!grid.walkable(c + dc, r) || !grid.walkable(c, r + dr)) continue;
          const nd = dist[idx(nc, nr)];
          if (nd !== -1 && nd < best) { best = nd; bc = dc; br = dr; }
        }
        // A reached cell (dist >= 1) ALWAYS has its BFS parent one step
        // closer among the orthogonals, so bc/br are never left 0,0 here.
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
