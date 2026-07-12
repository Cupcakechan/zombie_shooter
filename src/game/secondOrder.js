// game/secondOrder.js — a second-order spring-damper: velocity-carrying
// easing that overshoots and settles (follow-through), the primitive behind
// the hit-flinch squash (pass 7c).
//
// PROVENANCE: ported 2026-07-12 from Daniel's research repo
// (ExperimentProject/sdf-blend-shell/src/secondOrder.js, the t3ssel8r
// f/zeta/r formulation). That research was HALTED — nothing here is trusted
// on provenance: suite Section 12 pins every behavior with OUR probes
// (no-overshoot at critical damping, overshoot underdamped, settle, pause
// hold, undersampling stability, kick-and-return).
// Our one addition: kick(dv) — a velocity impulse, which is what a hit is.
//
// Parameters:
//   f    natural frequency in Hz — how fast it responds
//   zeta damping: 1 = critical (no overshoot); < 1 overshoots then settles
//   r    initial response (1 = track; negative = anticipation wind-up)
// Semi-implicit Euler with a k2 stability clamp so an undersampled stiff
// spring degrades gracefully instead of exploding. THREE-free: pure math,
// suite-probeable in Node.

export function createSecondOrder(f, zeta, r, x0 = 0) {
  const k1 = zeta / (Math.PI * f);
  const k2 = 1 / ((2 * Math.PI * f) * (2 * Math.PI * f));
  const k3 = (r * zeta) / (2 * Math.PI * f);
  let xp = x0; // previous input (for input velocity)
  let y = x0;  // output position
  let yd = 0;  // output velocity
  return {
    update(x, dt) {
      if (!(dt > 0)) return y; // dt <= 0 / NaN: hold (pause-safe)
      const xd = (x - xp) / dt;
      xp = x;
      const k2s = Math.max(k2, (dt * dt) / 2 + (dt * k1) / 2, dt * k1);
      y = y + dt * yd;
      yd = yd + (dt * (x + k3 * xd - y - k1 * yd)) / k2s;
      return y;
    },
    // A velocity impulse — the flinch: the spring lurches, overshoots its
    // target on the way back (underdamped), and settles.
    kick(dv) { yd += dv; },
    reset(x = x0) { xp = x; y = x; yd = 0; },
    get value() { return y; },
    get velocity() { return yd; },
  };
}
