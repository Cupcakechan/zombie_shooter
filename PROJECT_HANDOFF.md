# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-11 — session 1 (kickoff → Stage 1 complete + roadmap + config-contract guard)

## 1. What this project is

A browser first-person shooter in **three.js r185**, built pass-by-pass. The
destination is a **zombie wave shooter** — wave v1 is *last-stand* (stationary
player), with enemies **designed through Claude** as code-built procedural
creatures (no downloaded models). Stage 1 — a 60-second shooting-range score
attack — is complete. `DESIGN.md` is the living spec; read it (and the code)
before any work.

## 2. Current state (all committed & pushed)

- Passes completed, in order: **scaffold → app shell → shot loop →
  scoring/HUD → docs/roadmap → round pass → feel pass → config-contract
  guard**.
- Playable now: the full Stage 1 loop — START → 3-2-1 countdown → 60 s round
  (jittered-grid targets, semi-auto hitscan, streak multipliers, live timer,
  recoil + muzzle flash on every real shot) → results (score, accuracy, best
  streak, personal best in localStorage, NEW BEST flag) → Play Again.
  Pause/resume is exact-to-the-second and re-runs the 3-2-1.
- Stage 1 DoD (DESIGN.md §10): items 1–6 verified; item 7's **Firefox
  once-through** was still pending Daniel's confirmation when this was written.
- Suite: `node test_suite.mjs` — **6 sections**, all green: module health
  (12 modules), spawn invariants, scoring exact math, round clock timing,
  personal-best persistence, config contract.
- One shipped incident this session, plugged: see §3 conventions + LESSONS.md
  (NaN light intensity — missing config constant, zero console errors).

## 3. Stack & project conventions

- Plain ES modules, **no bundler, no import map**. three.js r185 is vendored as
  `lib/three.module.js` + `lib/three.core.js` (split build — module imports
  core as a sibling). Game code imports by **relative path**
  (`../lib/three.module.js`) so the committed **Node** suite can import every
  module — Node can't read browser import maps. Consequence: any future
  vendored `examples/jsm` addon needs its `from 'three'` line edited to the
  relative lib path. (The B1 creature route needs **no** addons.)
- All tunables live in `src/config.js` (grouped, commented). Content is
  registry-driven: `src/data/targetTypes.js` — Stage 2 enemies join it.
- **config.js is hand-tuned territory**: deliver changes to it as small
  paste-in ADDITIVE snippets with exact anchors, never as a full-file
  replacement (or ask for Daniel's current copy and merge). Suite Section 5
  is the safety net: extend its SCHEMA whenever a constant is added.
- Run locally with the VS Code **Live Server** extension — never `file://`.
- Verification before any delivery: fast syntax check on changed files, then
  `node test_suite.mjs`. Section 0 imports every `src/**/*.js` except `main.js`
  (boot entry); `MIN_EXPECTED_MODULES` is currently **12** — raise it when a
  module is added.
- Suite-pinned facts (change the config ⇒ update the suite deliberately):
  jittered grid worst-case separation exactly **2 m** both axes, envelope
  **x ±11.5 / z −7…−21**; scoring pays the threshold hit at the new rate
  (**25 straight = 4700**); accuracy `null` before any shot; resume countdown
  consumes **zero** round time; a personal best requires **score > 0** and
  strictly-greater to overwrite; config schema = 42 keys, usage scan ≥ 15 reads.
- Debug signature worth remembering (LESSONS.md): **scene suddenly black but
  grid/unlit materials still visible = NaN light uniform** — check the
  last-touched light value first; there will be zero console errors.
- **No DevLog for this project** (Daniel, 2026-07-11 — may revisit later).
- Research reference: the project file *"Building a Browser-Based First-Person
  Zombie Wave Shooter in three.js r185: A Practical Resource Report"* — treat
  as reference, not contract; its asset-sourcing advice (Quaternius/Mixamo/
  GLTFLoader) is **superseded by Decision B1**. Its secondary-systems guidance
  (audio, decals, wave pooling, performance thresholds) remains the go-to.
- Creature design passes (roadmap pass 7) follow Daniel's creature pipeline —
  **the creature-forge skill must be attached** in the session doing that work.

## 4. File map

```
zombie_shooter/
├── index.html / style.css        entry + single stylesheet (root)
├── DESIGN.md                     living spec (v2.x: roadmap in §2)
├── PROJECT_HANDOFF.md            this file
├── LESSONS.md                    error record (dev-method capture queue)
├── test_suite.mjs                committed 6-section suite
├── lib/three.module.js + three.core.js   vendored r185 pair
└── src/
    ├── main.js                   boot glue + frame loop (suite-excluded)
    ├── config.js                 ALL tunables (paste-in edits only)
    ├── state.js                  BOOT/START/COUNTDOWN/PLAYING/PAUSED/RESULTS
    ├── input.js                  pointer lock, look math, fire hook
    ├── data/targetTypes.js       content registry
    ├── render/scene.js|gun.js|targets.js
    ├── game/shooting.js|scoring.js|round.js|best.js
    └── ui/hud.js                 overlays, crosshair, HUD bar, results
```

## 5. Decisions log (all 2026-07-11)

- Slice = **Option 1**: stationary shooting range (gridshot loop).
- **Relative imports, no import map** — Node-suite compatibility.
- Spawning = **Option 3 jittered slot grid**, invariants suite-proven.
- Multiplier semantics: the hit that reaches a tier is paid at it.
- Targets hot orange (crosshair stays readable); UI accent acid green —
  both provisional placeholder styling.
- Roadmap picks: **A1** finish Stage 1 (round + feel) / **B1** creatures
  designed via Claude, placeholders-first / **C1** wave v1 is last-stand;
  WASD = Stage 3; Octree/Capsule deferred unless a level demands it.
- Round pins (v2.1): lock loss in COUNTDOWN pauses; fire only in PLAYING;
  best requires score > 0, ties don't count; resume re-runs the 3-2-1.
- Feel (v2.2): recoil 60 ms / 1° up / 0.06 m back; flash = additive quad AND
  point-light pulse (50 ms), on hits and misses alike.
- Guard (v2.3): suite Section 5 config contract, proven to fire on the
  incident that motivated it.

## 6. Roadmap (detail in DESIGN.md §2)

1. ~~Round pass~~ done
2. ~~Feel pass~~ done — **Stage 1 complete**
3. **Proto-zombie pass** ← NEXT (blocky procedural shamble toward player)
4. Combat pass (zombie HP, hit reaction, procedural death)
5. Threat pass (attacks, player health, game over)
6. Wave manager pass (data-driven waves, pooling)
7. Creature design pass(es) — creature-forge skill required
8. Atmosphere pass (optional: audio, gore, tuning)
→ Stage 3: WASD arena.

## 7. Session ritual

- **Start:** Daniel attaches this handoff. Claude reads it + `DESIGN.md` in
  full, confirms state back, then clones/pulls the repo and works from HEAD —
  after confirming with Daniel that nothing is uncommitted/unpushed locally.
- **Each pass:** options first (skip only if Daniel names the approach or it's
  a one-value tweak) → build → syntax checks + suite → deliver full files with
  exact paths → test plan → Daniel confirms → checkpoint
  (`git status` [read it!] → `add` → `commit` → `push`).
- **config.js:** additive paste-ins only (see §3).
- **End:** update this handoff (state, decisions, next steps) and sweep
  anything that broke or surprised us into `LESSONS.md`.

## 8. Open items

- Firefox DoD once-through (DESIGN §10 item 7) — pending Daniel's confirm.
- Game title (`zombie_shooter` = working name).
- Creature design direction (Daniel's call, pass 7).
- Keep the range as a selectable mode next to Waves? Decide during Stage 2.
- Ammo/reload as a pressure lever — undecided.
