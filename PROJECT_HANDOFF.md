# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-12 — session 2 end, second wrap (first wrap same day at
`e26555d`). **PASS 7 IS COMPLETE** (7a designed creature + gait, 7b
per-part hitboxes, 7c flinch spring), on top of the earlier pass 8
atmosphere + pass 9 reload. HEAD at write time: `eafd815`.

## 1. What this project is

A browser first-person shooter in **three.js r185**, built pass-by-pass.
Two playable modes from the START screen:
- **Range** — 60 s score attack (targets, streak multipliers ×2@10/×3@20,
  accuracy, localStorage personal best). Reload applies here too — any PB
  set before pass 9 was earned under infinite-ammo rules.
- **Waves** — untimed last-stand: cleared-based escalating zombie waves,
  5-hit arcade player health, WASD kiting, dense fog (Daniel-tuned
  NEAR 3 / FAR 13), game over with wave/kills/time.

Everything is code-built — no downloaded models, no image assets anywhere.
`DESIGN.md` (v2.9) is the living spec but is now MEANINGFULLY BEHIND
(ammo resolved, creature complete, atmosphere shipped) — a dedicated docs
pass is queued (§8). **No DevLog** (Daniel's call).

**Map direction (Daniel, 2026-07-12): long-term goal is a maze-like arena
(CoD-Zombies style).** Future dedicated stage; scope includes movement
clamp rework, walls as raycast occluders, spawn windows, and zombie
navigation (beeline breaks on corners — the documented pathfinding
trigger). Fog systems were built data-driven for the re-placement.

## 2. Stack, method & session rules

- three.js **r185** vendored (`lib/three.module.js` + `three.core.js`),
  RELATIVE imports everywhere, no import map (the Node suite imports every
  module). Plain ES modules, VS Code Live Server, Windows + Node.
- Daniel's dev-method governs: options round → he picks → one tested pass
  per commit; full files as downloads with exact paths; **config.js is
  paste-in ONLY**; `enemyTypes.js`/`waveTable.js` full-replace with a
  "tuned anything?" caveat; balance/feel reports get mechanism → single
  lever → surgical value; bugs get the debugging protocol. Daniel commits
  his tunes separately (did so repeatedly: fog NEAR 3, SWAY_AMP 0.04,
  SQUASH_KICK 2).
- **Claude-side sync rule (fired twice):** after any delivery, sync by
  `git fetch origin && git reset --hard origin/main` — NEVER pull; verify
  tip + grep one changed value + key docs exist.
- **Checkpoint blocks are copy-complete** (LESSONS 2026-07-12): Daniel
  copies them verbatim — every block ends `git push`. If his "pushed"
  and the remote disagree, STOP and reconcile (it happened; the stale
  base would have erased a fix under playtest).
- **Feel work is a loop:** the gait took 8 rounds (7a.1–7a.8), one
  mechanism + one lever each — that's the normal shape of animation
  work, not churn (LESSONS 2026-07-12).

## 3. Current state (all tested & pushed)

**The creature (pass 7 — COMPLETE).** The Shambler: registry-driven
13-part hunched body (`render/enemyBody.js`, all dimensions in the
enemy registry's BODY block — a future enemy type is pure data).
- **Look:** oversized forward-jutting head (cocked, up-tilted), hanging
  jaw, hunched chest over belly, two-segment arms (elbow droop) and legs
  (knee at 55%), dark ground-anchor feet, **unlit fog-free amber eyes**
  (`fog:false` MeshBasic — pinpricks appear in the murk before the body
  resolves; excluded from the emissive hit-flash by a guard).
- **Gait (7a.1–7a.8, browser-converged):** stride phase `p = walked ×
  BOB_FREQ (2.6)` drives everything. Good LEFT leg steps (hip swing +
  quarter-stride-lagged knee pulse); bad RIGHT leg is PINNED — no swing,
  backward trail (LIMP×0.4), shin locked in a deep toe-scrape cock
  (LIMP×0.8); body rolls onto the good side (LIMP×0.16) and SINKS once
  per stride as weight lands on the bad leg (BOB_AMP is a DIP now, not a
  bob — the old |sin| vault read as skipping). Sway is stride-locked
  (SWAY_FREQ **must stay BOB_FREQ/2**), idle breathing is an INTEGRATED
  per-enemy phase (`idlePhase` — scaling accumulated phase by the blend
  caused the shot/strike whole-body shake; LESSONS). Legs plant via
  `legBlend` when rooted. LIMP (0.5) is the one limp knob.
- **Attack:** overhead raise-and-slam (windup REST − REAR raises, strike
  REST + THRUST slams down), elbows cock on the raise and EXTEND through
  the strike (a reaching lunge). Arm rest = BODY.ARM.REST_RAD (1.85 —
  a dangle; the Section 11 probe caught 1.25 pointing UP on first run).
- **Hitboxes (7b):** every mesh tagged `userData.part`; damage table
  `HITBOX: HEAD 3 / TORSO 1 / LIMB 0.5` (registry — armored heads later
  are three numbers). HP is fractional internally. Headshot = one-shot +
  double blood burst. `partDamage()` is a pure export, fallback-guarded
  (untagged → torso; missing table → 1). `damageEnemy` returns
  `{part, killed}` (truthy — old callers fine).
- **Flinch (7c):** per-enemy second-order squash spring
  (`game/secondOrder.js`, PORTED from the halted research repo with a
  provenance header; trusted only via suite Section 12). Hits kick it;
  body compresses toward the feet and rebounds. Params in COMBAT
  (SQUASH_F 5, ZETA 0.4, KICK **2** — Daniel's tune; kick→peak is linear
  ≈ ×0.022 at these params, so 2 ≈ 4–5% squash). Corpses fall
  un-squashed (scale reset in startDeath).

**Ammo/reload (pass 9):** mag 12, unlimited reserve, R + auto-on-empty,
1200 ms (= attack cooldown, on purpose), gun-dip telegraph, bottom-right
counter red at ≤3. Reload ticks only in PLAYING. Both modes —
**provisional** (Daniel never explicitly ruled both-vs-Waves-only).

**Atmosphere (pass 8):** perimeter fog bank + spawn fade-in (600 ms);
Waves whole-arena murk (**NEAR 3 / FAR 13**, Daniel-tuned twice); blood
(hit bursts at the raycast point, kill eruption + 8 s floor pools, CSS
screen splatter on player damage); brass casings (muzzle-anchored —
PORT_FWD −0.45, the sign lesson — tumble + one bounce, 3 s linger).

**World-freeze rule (bug fix, 7a.5):** enemies/blood/casings simulate
ONLY in PLAYING — during a resume countdown everything freezes with the
player (zombies used to advance through the 3-2-1).

**Combat pipeline:** unified raycast; `onHit(mesh, point, rayDir)`;
`onEnemyKilled(typeId, {x,z})`; ammo consumed on hit AND miss; zombie
kills still score nothing (§7).

## 4. File map (24 suite-visible modules + root)

Root: index.html, style.css, test_suite.mjs, DESIGN.md, LESSONS.md
(**8 entries**, 5 unharvested from 2026-07-12), README.md, this file.
src/: main.js (suite-excluded), config.js, state.js, input.js (look +
WASD + fire + R-reload), data/targetTypes.js, data/enemyTypes.js,
data/waveTable.js, render/scene.js, render/gun.js, render/fogBank.js,
render/bloodFX.js, render/casings.js, **render/enemyBody.js**,
render/targets.js, render/enemies.js, game/shooting.js, game/scoring.js,
game/round.js, game/best.js, game/player.js, game/movement.js,
game/waves.js, game/ammo.js, **game/secondOrder.js**, ui/hud.js.

## 5. The suite (run `node test_suite.mjs` before EVERY delivery and
after every paste-in)

**190 assertions.** Sections: 0 module health (MIN_EXPECTED_MODULES =
**24**); 1 spawn placement; 2 scoring; 3 round clock; 4 personal best;
5 config contract — **87-key schema** + usage scan + registry leaf sweep
(**116 leaves**) + **enemy schema 83 numeric fields** + SHIP gate;
6 enemy/blood/casing timelines; 7 player health + attack pacing; 8 wave
composition + fog-bank spawn coverage; 9 player movement math; 10 ammo +
reload; **11 enemy body geometry** (built headless and MEASURED: ground
contact, forward signs, chain parenting thigh→shin→foot and
upper→forearm→hand measured at the true chain end, hitbox tag coverage
with zero untagged meshes, partDamage tiers + both fallbacks); **12
spring behaviors** (our probes of the ported secondOrder: no-overshoot
critical, overshoot underdamped, kick-and-settle, dt=0 hold,
undersampling clamp).

SHIP gate unchanged: `set SHIP=1&& node test_suite.mjs` (cmd) /
`$env:SHIP=1; node test_suite.mjs` (PowerShell). DEBUG is `{}`.

## 6. ExperimentProject — DEMOTED to reference (Daniel, 2026-07-12)

**The research was HALTED at roadblocks and is not bug-free — grain of
salt; never build solely on it. Daniel prefers the current zombies' look
over its SDF creatures**, so the shell/SN render pipeline is OFF the
table. What we adopted (and re-verified with OUR probes): the anatomy
rules (RESEARCH_TECHNIQUE §5 — spine + limb chains, joint placement,
silhouette test, "motion sells anatomy"), the per-part-hitbox idea, and
`secondOrder.js` (ported with provenance header + suite Section 12).
Their docs remain worth consulting; their code does not get pulled
without a probe section proving it here.

## 7. Open questions (DESIGN §12)

- Game title (`zombie_shooter` is the working name).
- **Wave-mode kill scoring** — still nothing awarded; headshots (7b) now
  give it a natural identity (headshot bonus) when Daniel decides.
- Reload mode scope — both-modes live but provisional.
- ~~Ammo/reload~~ resolved (pass 9). ~~Creature design~~ resolved
  (pass 7, Direction A "the Shambler" + glowing eyes).

## 8. Outstanding / pending / banked

1. **DESIGN.md docs pass (growing debt):** §12 resolve notes (ammo,
   creature), atmosphere + reload + creature sections. One dedicated
   docs touch.
2. **BANKED — DISMEMBERMENT (Daniel, 2026-07-12, explicitly saved):**
   blow parts off. The 7b tags + per-mesh limbs are the exact substrate:
   detach a tagged mesh, give it casing-style tumble physics, cap the
   debris pool. Opens with an options round when Daniel calls it.
3. **Maze-like map** — future dedicated stage (§1); pathfinding trigger
   lives here.
4. Two stale hand-file comments flagged, NOT overwritten (Daniel's
   territory): enemyTypes.js SQUASH_KICK comment still says "~9% peak"
   (kick 2 ≈ 4–5%), and the LIMP comment describes the old knee-only
   behavior (it's now the full drag scaler). Cosmetic.
5. Optional cleanup: config.js duplicate `RECOIL_MS`/`RECOIL_KICK_DEG`
   pair (harmless; flagged 2026-07-12).
6. Pass 8 audio — deferred; needs generated assets.
7. Eventually: itch.io deploy (SHIP-gate pre-flight + release gate;
   mobile check n/a for a pointer-lock FPS).

## 9. MEASURED facts (do not re-derive; probes exist)

- Zombie facing: `rotation.y = atan2(dx, dz)` on a +Z-built body.
- Player movement: forward = (−sinY, −cosY), right = (cosY, −sinY).
- **Frames: camera/gun space is −Z-forward; BODY-LOCAL forward is +Z.**
  FX anchors read from the geometry's source (gun muzzle = gun-local
  (0, 0.03, −0.45)); Section 11 asserts the body's forward signs.
- Spring (f 5, ζ 0.4, 60 fps): kick→peak squash is linear ≈ ×0.022;
  rebound stretch ≈ peak/5; settle ~350 ms. Section 12 pins behaviors.
- Arm rest: rotation.x < π/2 points arms UP, > π/2 dangles them —
  1.85 rad is the shambler's dangle (the 1.25 slip is probe-guarded).
- Diagnostic signature: scene black + HUD alive + zero console errors =
  NaN in a transform or light uniform; the suite names missing config
  keys AND missing enemy-registry fields by name.

## 10. Session hygiene for the next session

Attach this file. Clone; sync by **fetch + reset --hard**; confirm the
remote is current with Daniel. Run `node test_suite.mjs` — expect SUITE
PASS, **24 modules, 190 asserts**. Every checkpoint block ends with
`git push`. Update this handoff at session end; sweep LESSONS.md
(**5 unharvested 2026-07-12 entries** are dev-method/GI routing
candidates: port-sign anchors, clone fetch+reset, copy-complete
checkpoints, integrate-don't-scale phases, the animation feel-loop
expectation).
