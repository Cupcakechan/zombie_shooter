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
