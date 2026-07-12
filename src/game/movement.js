// game/movement.js — player locomotion math, all pure (suite Section 9).
// main.js reads the key axes from input.js, runs these three functions in
// order (move → clamp → resolve), and writes the result onto the camera.
// MEASURED (2026-07-11, vs vendored r185 getWorldDirection): at camera yaw Y,
// forward = (−sinY, −cosY) and right = (cosY, −sinY) — don't re-derive.

// Camera-relative move for one frame. axX: strafe (−1 left … +1 right),
// axZ: forward (−1 back … +1 forward). The axes vector is NORMALIZED so
// diagonals move at the same speed as cardinal directions.
export function computeMove(axX, axZ, yaw, speedMps, dtMs) {
  const len = Math.hypot(axX, axZ);
  if (len < 1e-9) return { dx: 0, dz: 0 };
  const nx = axX / len;
  const nz = axZ / len;
  const step = (speedMps * dtMs) / 1000;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return {
    dx: (fx * nz + rx * nx) * step,
    dz: (fz * nz + rz * nx) * step,
  };
}

// Keep the player inside the walls, with a margin so the camera never
// clips through them. bounds: { minX, maxX, minZ, maxZ } (already
// margin-adjusted by the caller).
export function clampToArena(x, z, bounds) {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, z)),
  };
}

// Push the player out of solid circles (living zombies). The player yields;
// obstacles don't move. One pass is enough at our densities — two zombies
// overlapping the player simultaneously already means trouble anyway.
// obstacles: [{ x, z, radius }]; playerRadius: the player's own body circle.
// Push a circle out of axis-aligned boxes (pass 4.2: map walls). Two
// sweeps so a corner that pushes into a neighbouring box still resolves;
// each overlap exits along the SHALLOWEST axis, which is what produces
// natural wall sliding.
export function resolveCircleAABBs(x, z, boxes, radius) {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      const nx = Math.max(b.minX, Math.min(px, b.maxX));
      const nz = Math.max(b.minZ, Math.min(pz, b.maxZ));
      const dx = px - nx;
      const dz = pz - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-12) {
        // Outside the box but overlapping the edge: push along the normal.
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * radius;
        pz = nz + (dz / d) * radius;
      } else {
        // Centre INSIDE the box: exit along the shallowest penetration axis.
        const left = px - (b.minX - radius);
        const right = (b.maxX + radius) - px;
        const near = pz - (b.minZ - radius);
        const far = (b.maxZ + radius) - pz;
        const m = Math.min(left, right, near, far);
        if (m === left) px = b.minX - radius;
        else if (m === right) px = b.maxX + radius;
        else if (m === near) pz = b.minZ - radius;
        else pz = b.maxZ + radius;
      }
    }
  }
  return { x: px, z: pz };
}

export function resolveCircleObstacles(x, z, obstacles, playerRadius) {
  let px = x;
  let pz = z;
  for (const ob of obstacles) {
    const minDist = playerRadius + ob.radius;
    let dx = px - ob.x;
    let dz = pz - ob.z;
    let d = Math.hypot(dx, dz);
    if (d >= minDist) continue;
    if (d < 1e-6) { dx = 1; dz = 0; d = 1; } // dead-centre: pick an axis
    const push = minDist - d;
    px += (dx / d) * push;
    pz += (dz / d) * push;
  }
  return { x: px, z: pz };
}
