# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-12 — session 2 end (pass 8 atmosphere COMPLETE in four
sub-passes, pass 9 reload COMPLETE, two pending items closed; pass 7
creature design remains the next dedicated session)

## 1. What this project is

A browser first-person shooter in **three.js r185**, built pass-by-pass.
Two playable modes from the START screen:
- **Range** — 60 s score attack (targets, streak multipliers ×2@10/×3@20,
  accuracy, localStorage personal best). NOTE: reload now applies here too —
  any personal best set before pass 9 was earned under infinite-ammo rules.
- **Waves** — untimed last-stand: cleared-based escalating zombie waves,
  5-hit arcade player health, WASD kiting, dense fog, game over with
  wave/kills/time.

Enemies are **designed through Claude** (Decision B1): code-built procedural
creatures — no downloaded models, no GLTFLoader, no image assets ANYWHERE
(fog, blood, splatter, brass are all generated in code). The blocky
proto-zombie proved every system; designed visuals are pass 7. `DESIGN.md`
(v2.9) is the living spec — **its §12 still lists ammo/reload as open;
needs a one-line resolve note next docs touch.** **No DevLog** (Daniel's
call).

**NEW DIRECTION (Daniel, 2026-07-12): the long-term map goal is a
maze-like arena (CoD-Zombies style), not one big room.** That is a future
dedicated stage with real scope: movement clamp rework, walls as raycast
occluders, spawn-window redesign, and — the big one — zombie navigation
(beeline steering breaks on interior corners; that is the documented
trigger for real pathfinding). Fog systems were built data-driven so the
curtains can move from the perimeter to spawn windows when it lands.

## 2. Stack & environment

- three.js **r185** vendored as `lib/three.module.js` + `lib/three.core.js`
  (split build). **RELATIVE imports everywhere — no import map** (the
  committed Node suite imports every module; Node can't read import maps).
  Any future vendored addon needs its `from 'three'` line edited.
- Plain ES modules, VS Code Live Server, Windows + Node only (no Python).
- Daniel's dev-method governs: options round → he picks → one tested pass
  per commit (he may explicitly waive the one-pass rule — did so for
  pass 8.3, folding floor pools in with bursts); full files as downloads
  with exact paths; **config.js is paste-in edits ONLY**;
  `enemyTypes.js`/`waveTable.js` full-replace with a "tuned anything?"
  caveat; balance reports get mechanism → single lever → surgical value;
  bug reports get the debugging protocol.
- **Claude-side sync rule (new, fired twice):** after any delivery, the
  sandbox clone syncs by `git fetch origin && git reset --hard origin/main`
  — NEVER `git pull` (locally applied delivery files always collide with
  the push that ships them; pull aborts while printing `Updating x..y`).
  Then verify tip, grep one changed value, confirm key docs exist.

## 3. Current state (all tested & pushed, HEAD c135123)

**Modes/flow:** unchanged from session 1 (BOOT/START/COUNTDOWN/PLAYING/
PAUSED/RESULTS/GAMEOVER; pause = lock loss; resume re-runs 3-2-1 costing
zero round time; Quit on PAUSED and GAMEOVER). Firefox behavior confirmed
(see §8).

**Player:** WASD 4.5 m/s camera-relative (MEASURED formulas §9), arena
clamp, circle pushout vs living zombies, dodge-by-range, 5 arcade hits,
vignette + camera kick — now plus **screen blood splatter** on damage.

**Ammo/reload (pass 9 — resolves the old open question):** magazine 12
(4 kills at zombie HP 3), unlimited reserve; **R** reloads manually,
empty-click auto-reloads; RELOAD_MS 1200 **equals the zombie attack
cooldown on purpose** (reloading in melee range risks a hit); firing
blocked while reloading, movement free; gun-dip sine telegraph
(GUN.RELOAD_DIP, writes only position.y — recoil owns z/rotation.x);
bottom-right `N / 12` counter, red at ≤ LOW_AT 3, `RELOADING…` during.
Reload ticks ONLY in PLAYING (pause freezes it mid-dip). Pure rules live
in `game/ammo.js`, all suite-proven (Section 10). **Applies in BOTH modes
— provisional:** Daniel accepted in play but never explicitly ruled on
both-vs-Waves-only; Range difficulty changed (PB note in §1). Waves-only
would be a small gate in main.js if he ever wants it.

**Atmosphere (pass 8, complete):**
- **8.1 Perimeter fog bank** (`render/fogBank.js`): fixed translucent
  curtains hugging all four walls (3 layers/wall, canvas-gradient texture,
  DoubleSide, depthWrite off), per-wall depths BACK 7 / SIDE 3 / FRONT 2 —
  every spawn point sits inside a bank (suite-asserted, section 8).
  Waves-only via visibility toggle. Zombies **fade in over
  SPAWN.FADE_MS 600** as they emerge (registry field; kill mid-fade snaps
  opaque so the death fall never runs on a half-ghost). Built data-driven
  for the future maze re-placement.
- **8.2 Whole-arena murk:** per-mode distance fog; Range 18/55, Waves
  `FOG.WAVES` — **Daniel-tuned to NEAR 1 / FAR 13** (his tension call;
  zombies materialize ≈13 m out ⇒ ~7 s to contact; flankers appear with
  no warning — intended). If deaths ever feel cheap the single lever is
  WAVES.FAR. The perimeter banks are now mostly invisible from mid-arena
  (global fog took over their job); kept — near-wall they still read.
- **8.3 Blood** (`render/bloodFX.js` + hud/css): pooled cube bursts at the
  exact raycast hit point sprayed away from the ray (HIT 10), kill adds an
  upward eruption (KILL 22) + a floor pool that lingers 8 s then fades 1 s
  (poolPhase pure fn, suite-tested); player damage adds 3-blob CSS screen
  splatter, randomly rotated per hit. Caps: 64 particles / 24 pools,
  oldest-reclaim. Scoring-neutral, Range targets produce NO blood.
- **8.4 Brass casings** (`render/casings.js`): every real shot ejects a
  tumbling brass box from the muzzle to the player's right (measured
  right-vector formula), one dampened bounce (RESTITUTION 0.35), rests
  3 s, shrinks away (landedScale pure fn, suite-tested). Cap 40.
  **Ejection port is anchored to the gun.js muzzle-flash point**
  (PORT_UP 0.03, PORT_FWD **−0.45** — camera space is −Z-forward; a sign
  slip here shipped and was fixed same-session; see LESSONS 2026-07-12).

**Combat pipeline:** unified raycast unchanged; `onHit` now carries
`(mesh, point, rayDir)` and `onEnemyKilled` carries `(typeId, {x,z})` —
extra args, old callers unaffected. Shots consume ammo on hit AND miss
(cooldown-swallowed clicks consume nothing).

**Waves:** unchanged mechanics; spawn points CONFIRMED at back z −24 /
sides (±13, −11) (the session-1 pending tune was verified applied).

## 4. File map (22 suite-visible modules + root)

Root: index.html, style.css, test_suite.mjs, DESIGN.md, LESSONS.md
(5 entries), README.md, this file.
src/: main.js (boot glue, suite-excluded), config.js, state.js, input.js
(look + WASD + fire + **R-reload hook**), data/targetTypes.js,
data/enemyTypes.js, data/waveTable.js, render/scene.js, render/gun.js,
render/fogBank.js, render/bloodFX.js, render/casings.js,
render/targets.js, render/enemies.js, game/shooting.js, game/scoring.js,
game/round.js, game/best.js, game/player.js, game/movement.js,
game/waves.js, **game/ammo.js**, ui/hud.js.

## 5. The suite (run `node test_suite.mjs` before EVERY delivery and after
every paste-in — the missing-key class has struck twice; see LESSONS)

151 assertions. Sections: 0 module health (MIN_EXPECTED_MODULES = **22** —
raise when adding a module); 1 spawn placement; 2 scoring math; 3 round
clock; 4 personal-best persistence; 5 config contract — **87-key schema**
+ CONFIG.<path> usage scan + registry leaf sweep (**62 leaves**) +
enemy-registry required-keys schema (**29 numeric fields** per type,
negative-tested by name) + SHIP gate (DEBUG `{}`); 6 enemy movement +
death timeline **+ blood-pool and casing timelines** (poolPhase /
landedScale, boundaries relative to config); 7 player health + attack
pacing; 8 wave composition **+ fog-bank spawn coverage** (every
SPAWN_POINT inside a bank volume — retuning spawns or bank depths
inconsistently fails HERE, not in the game); 9 player movement math;
**10 ammo + reload invariants** (fire gate, consumption, refusal rules,
completion refill, progress).

SHIP gate unchanged: `set SHIP=1&& node test_suite.mjs` (cmd) /
`$env:SHIP=1; node test_suite.mjs` (PowerShell).

## 6. Pass 7 — designed creatures: THE SOURCE OF TRUTH

Unchanged from session 1; still the next dedicated session.
**https://github.com/Cupcakechan/ExperimentProject — subfolder
`sdf-blend-shell/`. Clone and read, in order: PROJECT_HANDOFF.md,
RESEARCH_TECHNIQUE.md, REFERENCE_FOGLEMAN.md, LESSONS.md.**

Key facts: capsule/sphere prims → cubic C2 smooth-min SDF → gradient
normals → toon shading → depth-ink outline; spring animation
(`secondOrder.js`); Surface Nets meshing on a worker. Their IDEA SHELF
scoped our FPS use (prims ARE hitboxes → headshots free; squash spring =
flinch; deflate-and-sink deaths; shell renderer proven at 24 actors;
SN budget 33 meshes/s ÷ N). Carried-set candidates: `secondOrder.js`,
`surfaceNetsActor.js`; their agreed-next was biped rig extraction.
**Version reconciliation required: they pin three.js 0.170.0, we're
r185 — verify every ported API.** Pass 7 OPENS with an adoption-scope
options round. New since session 1: pass-7 bodies inherit working
fade-in (registry SPAWN.FADE_MS), blood anchored to raycast points, and
BLOOD.COLOR could become a per-type registry field (different creatures,
different blood — noted in bloodFX.js).

## 7. Open questions (DESIGN §12)

- Game title (`zombie_shooter` is the working name).
- Creature design direction (Daniel's call, pass 7).
- **Wave-mode kill scoring** — kills still award nothing; decide when
  waves get a score identity.
- Reload mode scope — both-modes is live but provisional (§3 Ammo).
- ~~Ammo/reload~~ **RESOLVED 2026-07-12** (pass 9). DESIGN §12 needs the
  resolve note.

## 8. Outstanding / pending

1. ~~Spawn-point tune~~ **CLOSED** — verified applied in waveTable.js
   (back −24, sides ±13/−11).
2. ~~Firefox DoD once-through~~ **CLOSED 2026-07-12** — full 8-item
   checklist passed (lock error path flashes the hint via
   'pointerlockerror'; stuck-key guard; both modes; perf clean).
3. **Proto-zombie feel tweaks** — still parked by Daniel; levers in
   enemyTypes.js comments. ANIM levers may be superseded by pass 7;
   COMBAT/ATTACK levers carry over.
4. **Maze-like map** (see §1 NEW DIRECTION) — future dedicated stage,
   opens with its own design/options round; pathfinding trigger lives
   here.
5. Optional cleanup: config.js has a harmless duplicated
   `RECOIL_MS`/`RECOIL_KICK_DEG` pair (identical values, last wins) —
   flagged 2026-07-12, Daniel's call whether to delete the dupe.
6. DESIGN.md touch-ups next docs pass: §12 ammo resolve note; atmosphere
   + reload sections if he wants the spec current.
7. Eventually: itch.io deploy (SHIP-gate pre-flight + release gate;
   mobile check n/a for a pointer-lock FPS).
8. Audio (was pass 8's last piece) — still deferred; needs generated
   assets.

## 9. MEASURED facts (do not re-derive; probes exist)

- Zombie facing: `rotation.y = atan2(dx, dz)` on a +Z-built body (dot
  1.000000).
- Player movement: forward = (−sinY, −cosY), right = (cosY, −sinY) —
  matches r185 getWorldDirection at all tested yaws. (Casings reuse the
  right-vector formula.)
- **Camera/gun space: −Z is FORWARD — "forward" offsets are NEGATIVE.**
  The gun muzzle is gun-local (0, 0.03, −0.45) = camera-space
  (0.28, −0.19, −1.0) at rest; FX anchors read from gun.js, never
  re-derived (LESSONS 2026-07-12).
- Diagnostic signature: scene black + HUD alive + zero console errors =
  NaN in a transform or light uniform; run the suite first — Section 5
  names missing config keys AND missing enemy-registry fields.

## 10. Session hygiene for the next session

Attach this file. Clone the repo; sync by **fetch + reset --hard** (see
§2 Claude-side rule), confirm with Daniel the remote is current. Run
`node test_suite.mjs` — expect SUITE PASS, 22 modules, 151 asserts. For
pass 7: also clone ExperimentProject and do the §6 reading BEFORE the
options round. Update this handoff at session end; sweep LESSONS.md
(2 unharvested 2026-07-12 entries are routing candidates for the
dev-method skill).
