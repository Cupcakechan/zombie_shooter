# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-11 — session 1 end (kickoff → Stages 1 & 3 DONE, Stage 2
passes 3–6 done; pass 7 pending in a dedicated session, pass 8 optional)

## 1. What this project is

A browser first-person shooter in **three.js r185**, built pass-by-pass.
Two playable modes from the START screen:
- **Range** — 60 s score attack (targets, streak multipliers ×2@10/×3@20,
  accuracy, localStorage personal best).
- **Waves** — untimed last-stand: cleared-based escalating zombie waves,
  5-hit arcade player health, WASD kiting, game over with wave/kills/time.

Enemies are **designed through Claude** (Decision B1): code-built procedural
creatures — no downloaded models, no GLTFLoader. The blocky proto-zombie
proved every system; designed visuals are pass 7. `DESIGN.md` (v2.9) is the
living spec; read it and the code before any work. **No DevLog for this
project** (Daniel's explicit call).

## 2. Stack & environment

- three.js **r185** vendored as `lib/three.module.js` + `lib/three.core.js`
  (the split build). **RELATIVE imports everywhere — no import map**: the
  committed Node suite imports every module, and Node can't read browser
  import maps. Any future vendored addon needs its `from 'three'` line
  edited to the relative path.
- Plain ES modules, VS Code Live Server, Windows + Node only (no Python).
- Daniel's dev-method governs: options round → he picks → one tested pass
  per commit; full files as downloads with exact paths; **config.js is
  paste-in edits ONLY** (hand-tuned territory — never full-replace);
  `enemyTypes.js`/`waveTable.js` ARE full-replaced but always with a
  "tell me if you tuned values since the last push" caveat; balance
  reports get mechanism → single lever → surgical value; bug reports get
  the debugging protocol (evidence first, one focused fix).

## 3. Current state (all tested & pushed)

**Modes/flow:** BOOT/START/COUNTDOWN/PLAYING/PAUSED/RESULTS/GAMEOVER state
machine; mode ('range'|'waves') is a single-writer variable in main.js.
Pause = pointer-lock loss during PLAYING or COUNTDOWN; resume re-runs the
3-2-1 consuming zero round time; PAUSED and GAMEOVER both offer Quit to
menu (quit button uses stopPropagation — the pause overlay itself is the
resume button). Round clock supports timed (Range) and untimed (Waves).

**Player:** WASD camera-relative movement 4.5 m/s (MEASURED formula:
forward = (−sinY, −cosY), right = (cosY, −sinY) — verified vs r185
getWorldDirection); normalized diagonals; arena clamp (WALL_MARGIN 0.6 on
RANGE dims x ±15, z −30…+4); pushed out of living zombie circles (player
0.3 + zombie 0.45) — corpses walkable; stuck-key guard clears WASD on lock
loss; 5 arcade hits (hearts pips HUD), red vignette + 120 ms camera pitch
kick per hit; fresh rounds re-centre to origin.

**Zombie (proto_zombie, registry-driven):** blocky +Z-built humanoid
(MEASURED: rotation.y = atan2(dx,dz) faces the player); stride-locked
procedural shamble (bob/sway off distance walked + slow time term when
stopped); HP 3; hit = red emissive flash 100 ms + stagger 200 ms + 0.15 m
knockback; telegraphed attack (windup 300 ms arms-rear tell → strike →
recover; cooldown 1200 ms start-to-start, suite-asserted ≥ phase sum);
**a hit CANCELS an in-progress attack** (cooldown keeps running); **the
strike range-checks at the damage moment** — stepping out of reach makes
it whiff (dodge); death = fall-over 600 ms k² → lie 1500 ms (CORPSE_LIFT
0.12) → fade 400 ms; dying bodies unhittable (shots pass through).

**Combat pipeline:** unified raycast — targets + enemy body meshes tested
together, nearest wins, userData.kind routes; zombie hits are
scoring-neutral (wave kill-scoring is UNDECIDED — see §7); 150 ms fire
cooldown; gun recoil + muzzle flash on every real shot.

**Waves:** cleared-based — intermission 2.5 s with WAVE-N banner (first
waits for the first PLAYING frame to avoid the countdown numeral) →
staggered spawns (800 ms, 5 SPAWN_POINTS cycled from a random offset) →
all dead → next. Data in `src/data/waveTable.js`: TABLE 5 hand-tuned waves
(1..5 zombies, speedMult 1.0→1.15) + EXTEND (+1 count, +0.05 speed,
cap ×1.4); per-spawn speedMult; O(n²) pairwise crowd separation 0.9 m.
Kills/wave/time live in `src/game/waves.js`. Pooling DEFERRED until a
MEASURED frame drop.

## 4. File map (18 suite-visible modules + root)

Root: index.html, style.css, test_suite.mjs, DESIGN.md, LESSONS.md (3
entries), README.md, this file.
src/: main.js (boot glue, suite-excluded), config.js, state.js, input.js
(look + WASD + fire hook), data/targetTypes.js, data/enemyTypes.js,
data/waveTable.js, render/scene.js, render/gun.js, render/targets.js,
render/enemies.js, game/shooting.js, game/scoring.js, game/round.js,
game/best.js, game/player.js, game/movement.js, game/waves.js, ui/hud.js.

## 5. The suite (run `node test_suite.mjs` before EVERY delivery and after
every paste-in — the missing-key class has struck twice; see LESSONS)

Sections: 0 module health (MIN_EXPECTED_MODULES = 18 — raise when adding a
module); 1 spawn placement invariants; 2 scoring exact math; 3 round clock
(incl. untimed waves + resume rules); 4 personal-best persistence
(hermetic stub); 5 config contract — 48-key schema + CONFIG.<path> usage
scan over all src incl. main.js + registry leaf sweep (array-recursive,
61 leaves) + **enemy-registry required-keys schema** (28 numeric fields
per type, negative-tested by name) + the **SHIP gate**; 6 enemy movement
clamp + death timeline (relative to registry timings); 7 player health +
attack-pacing invariant; 8 wave composition (table verbatim, EXTEND
formula, cap, monotonic); 9 player movement math (measured directions,
diagonal norm, arena clamp, obstacle pushout).

**SHIP gate (deploy pre-flight):** `set SHIP=1&& node test_suite.mjs`
(cmd) or `$env:SHIP=1; node test_suite.mjs` (PowerShell) — fails any
truthy CONFIG.DEBUG flag. DEBUG is currently `{}`.

## 6. Pass 7 — designed creatures: THE SOURCE OF TRUTH MOVED

**The creature-forge skill NO LONGER EXISTS** (lost; lane parked,
rebuild-on-revival — Daniel, 2026-07-11). The measured knowledge lives in
the public repo instead:

**https://github.com/Cupcakechan/ExperimentProject — subfolder
`sdf-blend-shell/`. Clone it and read, in order: PROJECT_HANDOFF.md,
RESEARCH_TECHNIQUE.md, REFERENCE_FOGLEMAN.md, LESSONS.md.** (Read in full
this session, 2026-07-11.)

Key facts for the pass:
- Technique: capsule/sphere prims → cubic C2 smooth-min SDF →
  gradient normals → toon shading → screen-space depth-ink outline;
  spring-driven animation (`secondOrder.js`, f/zeta/r — no
  AnimationMixer); Surface Nets meshing on a worker.
- **Their IDEA SHELF scoped exactly our FPS use:** prims ARE the hitboxes
  (ray-vs-capsule closed form → per-part identity → headshots free — our
  open headshot lever); the C2 seeded generator = enemy bestiary; the
  squash spring = a flinch primitive; deflate-and-sink deaths; shell
  renderer proven at 24 actors; SN budget 33 meshes/s ÷ N actors.
- Named carried-set candidates: `secondOrder.js` (THREE-free),
  `surfaceNetsActor.js`. Their agreed-next was **biped rig extraction**
  (`bipedRig.js`) — exactly what a walking humanoid zombie wants.
- **Version reconciliation required:** their stack pins three.js
  **0.170.0**; ours is r185. Verify every ported API; their own gotchas
  mandate it. Their modules import headless (suite-stub compatible) —
  same convention as ours.
- Their delivery gate convention (if we pull their code): certify
  provenance — fetch/reset, byte-diff, probe count.
- Pass 7 should OPEN with an options round: adoption scope (port their
  modules vs minimal reimplementation vs full SN actor pipeline),
  measured against wave counts (10–20 concurrent) and the 33/N budget.

## 7. Open questions (DESIGN §12)

- Game title (`zombie_shooter` is the working name).
- Creature design direction (Daniel's call, pass 7).
- Ammo/reload (classic pressure lever — never decided).
- **Wave-mode kill scoring** — zombie kills currently award nothing
  anywhere; decide when waves get a score identity.

## 8. Outstanding / pending

1. **Spawn-point tune — UNCONFIRMED.** Proposed 2026-07-11 (threat
   response: zombies spawn too far to threaten): SPAWN_POINTS back row
   z −28 → −24, sides (±14,−18) → (±13,−11). Daniel never confirmed
   applying it. **Check `waveTable.js`: −24/−11 = applied; −28/−18 =
   still pending.** Lever is spawn geometry, NOT walk speed; fog at
   z < −20 is the spawn curtain.
2. **Firefox DoD once-through** (DESIGN §10 item 7) — still unconfirmed;
   pointer-lock error path differs (no promise; 'pointerlockerror').
3. **Proto-zombie feel tweaks** — deferred by Daniel ("later on we can
   tweak"); levers documented in enemyTypes.js comments.
4. Pass 8 (atmosphere, optional): blood particles, decals, spawn effect
   (code-only parts doable any session; audio needs generated assets).
5. Eventually: itch.io deploy with the SHIP-gate pre-flight + the
   release gate (clean build, no console errors, links, mobile check
   n/a for pointer-lock FPS — note that exception when it comes up).

## 9. MEASURED facts (do not re-derive; probes exist)

- Zombie facing: `rotation.y = atan2(dx, dz)` on a +Z-built body → faces
  the player exactly (dot 1.000000).
- Player movement: forward = (−sinY, −cosY), right = (cosY, −sinY) —
  matches r185 `getWorldDirection` at all tested yaws.
- Diagnostic signature: **scene black + HUD alive + zero console
  errors = NaN in a transform or light uniform**; run the suite first —
  Section 5 names missing config keys AND missing enemy-registry fields.

## 10. Session hygiene for the next session

Attach this file. Clone/pull the repo and confirm with Daniel the remote
is current before working. Run `node test_suite.mjs` — expect SUITE PASS,
18 modules. For pass 7 specifically: also clone ExperimentProject and do
the §6 reading BEFORE the options round. Update this handoff at session
end; sweep LESSONS.md.
