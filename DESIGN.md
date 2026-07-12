# Zombie Shooter — Design Doc

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Status: **living document** — updated whenever a decision changes. Current state:
Stages 1–3 DONE, pass 7 (creature) COMPLETE, pass 8 shipped (audio deferred),
pass 9 (reload) shipped. Next candidates: wave kill scoring, dismemberment, maze.

---

## 1. Pitch

A browser first-person shooter built with Three.js. The player sees only their gun,
aims with the mouse, and shoots with a click. The first playable is a **stationary
shooting range** — a 60-second score attack against pop-and-respawn targets (the
"gridshot" loop proven by aim trainers). The project then grows in stages toward a
zombie wave shooter.

## 2. Scope ladder

| Stage | Name | Adds | Status |
|---|---|---|---|
| 1 | Shooting Range | Pointer-lock aim, hitscan shot, targets, scoring, round timer, results | **DONE** |
| 2 | Zombie Waves — Last-Stand | Zombies approach the player, HP both ways, waves, game over | **DONE** (passes 3–7 complete; pass-8 audio deferred) |
| 3 | WASD Arena | Player movement + bounds, zombies that chase | **DONE (pulled forward 2026-07-11, before pass 7)** |
| 4 | Maze Arena (future) | CoD-Zombies-style maze map: interior walls, spawn windows, zombie navigation (the pathfinding trigger), raycast occluders | **Direction set 2026-07-12; unscheduled** |

> Enemies are **designed through Claude** (Decision B1, 2026-07-11): code-built
> creatures with procedural animation, no downloaded models, no GLTFLoader.
> **How pass 7 actually landed (2026-07-12):** the SDF blend-shell pipeline was
> NOT adopted — Daniel ruled the ExperimentProject research **halted and
> grain-of-salt** (and prefers this game's look over its creatures), demoting
> that repo from source-of-truth to reference. What we took instead: the
> renderer-agnostic anatomy rules, the per-part-hitbox idea, and a ported
> `secondOrder.js` spring re-proven by our own suite section. The shipped
> creature is **the Shambler** (see changelog v3.0). Octree/Capsule world
> collision stays deferred unless a real level demands it.

### Pass roadmap (decided 2026-07-11 — picks A1 / B1 / C1)

**Stage 1 — finish the range:**
1. **Round pass** — countdown → 60 s timer → results screen (score, accuracy,
   best streak, personal best via localStorage) → play again.
2. **Feel pass** — gun recoil + muzzle flash; Stage 1 definition-of-done check.

**Stage 2 — Zombie Waves: Last-Stand (the range becomes the arena):**
3. **Proto-zombie pass** — blocky code-built zombie with a procedural shamble,
   walking from a spawn point toward the player; joins the enemy registry.
4. **Combat pass** — zombie HP (multi-hit), hit reaction, procedural death.
5. **Threat pass** — close-range attack, player health + damage feedback,
   game over + restart.
6. **Wave manager pass** — data-driven wave table (count / speed / spawn
   points), wave HUD, escalation, object pooling.
7. **Creature design pass(es)** — designed zombies via the creature-forge
   pipeline, swapped in behind the registry. **DONE 2026-07-12 (7a–7c: the
   Shambler + hitboxes + flinch spring; see changelog v3.0 — the pipeline
   changed, the registry swap-in held exactly as designed).**
8. **Atmosphere pass (optional)** — positional audio, blood particles/decals,
   difficulty tuning. **Visuals SHIPPED 2026-07-12 (fog bank + murk, blood,
   casings — changelog v2.10); audio still deferred (needs generated assets).**

**Stage 3 — WASD Arena:** movement + arena bounds as its own stage;
Octree/Capsule collision only if a real level requires it.

## 3. Stage 1 core loop

Start screen → click **START** → pointer lock engages → **3-2-1 countdown** →
**60-second round**: three targets are always live; a hit pops the target and
respawns it elsewhere; hits build a streak multiplier; a miss resets it →
**Results screen**: score, accuracy %, best streak, personal best → **PLAY AGAIN**.

## 4. Screens & state flow

```
BOOT ──► START ──click──► COUNTDOWN (3s) ──► PLAYING (60s)
                              ▲                 │      │
                              │            ESC / lock  │ timer = 0
                              │              lost      ▼
                              └── click ── PAUSED   RESULTS ──PLAY AGAIN──► COUNTDOWN
```

- **START** — title, **Range / Waves** mode buttons, controls line. (Pointer
  lock may only be requested from a user gesture, so a click is mandatory
  here by browser rule.) Range = the 60 s score attack; Waves = the untimed
  last-stand (Stage 2).
- **COUNTDOWN** — big 3-2-1 overlay; input locked, no shooting yet.
- **PLAYING** — HUD: score (top-left), streak multiplier (next to score),
  timer (top-right) — Range only; the Waves HUD arrives in pass 5b.
  Crosshair fixed at screen center in both modes.
- **PAUSED** — entered automatically whenever pointer lock is lost (ESC or
  alt-tab) during play *or* countdown. Timer freezes. Overlay: "Click to
  resume" → re-lock → 3-2-1 → resume — plus a **Quit to menu** button back
  to START.
- **RESULTS** — score, accuracy %, best streak, personal best (with "NEW BEST!"
  flag when beaten), PLAY AGAIN button.
- **GAMEOVER** (Waves only) — "You Died" with kills + survival time, TRY AGAIN
  (fresh waves run) and Quit to menu. Entered when player hits reach 0.

## 5. Mechanics spec (Stage 1)

### Look
Pointer-lock mouse look. Yaw unlimited; pitch clamped to ±85°. Sensitivity is a
single config constant applied to `movementX/Y`.

### Shot
- Semi-auto: one shot per click, with a **150 ms cooldown**.
- A click during cooldown is **ignored entirely** — it is not a shot, not a miss,
  and does not touch stats. (Punishing spam is the streak reset's job.)
- Hit test: **hitscan raycast** from the exact screen center along the camera
  direction, tested against target meshes only. Nearest intersection wins.
- A shot that hits no target is a **miss**.

### Targets
- Exactly **3 targets live** at all times. On hit: pop animation (quick flash +
  scale-out, ~120 ms), then a replacement spawns at a different slot.
- Placeholder look: emissive sphere on a thin cylinder stand (code-built, no assets).
- Spawn placement (**Option 3 — jittered grid**, picked 2026-07-11): a slot
  grid of **5 lateral columns (x ∈ {−10, −5, 0, 5, 10}) × 4 depth rows
  (z ∈ {−8, −12, −16, −20})** = 20 slots; each spawn adds jitter of
  **±1.5 m laterally, ±1.0 m in depth**, with centre height drawn fresh from
  **0.8–2.2 m**. Separation is guaranteed by construction — worst case, two
  adjacent slots jitter toward each other and land exactly **2 m** apart
  (lateral 5 − 2×1.5, depth 4 − 2×1.0) — and the suite asserts it. Effective
  envelope: **x ±11.5, z −7…−21** (suite-pinned). No targets behind the player.
- Built as a small **registry/table of target types** (Stage 1 has one type). The
  spawn + hit pipeline works off the registry so Stage 3 zombies plug into the
  same pipeline instead of a parallel system.

### Scoring
- **100 points per hit × streak multiplier.**
- Streak = consecutive hits. Multiplier: **×1 base, ×2 at streak 10, ×3 at streak
  20 (cap)**. A miss resets streak to 0 (multiplier back to ×1). The hit that
  *reaches* a threshold is already paid at the new rate — the 10th consecutive
  hit is the first ×2 hit (suite-pinned: 25 straight hits = exactly 4700).
- Accuracy = hits ÷ shots (misses count, ignored-cooldown clicks don't).
- Personal best score (and its accuracy) persists in `localStorage`.

### Round
Fixed **60-second** round. At 0: input stops, targets freeze, RESULTS shows.

### Gun (viewmodel)
- 2–3 boxes composing a body + barrel, **parented to the camera** (Unity: child of
  the Camera) at approx camera-space offset **(0.28, −0.22, −0.55)** so it sits
  bottom-right. Placeholder until a real model swap later.
- **Feel pass — last step of the slice, after the loop is proven:** recoil kick
  (~60 ms back + 1° up, eased return) and a one-frame muzzle flash (small emissive
  quad or point light pulse). No audio in Stage 1.

## 6. Controls

| Input | Action |
|---|---|
| Mouse | Look (pointer-locked) |
| Left click | Fire |
| WASD | Move (camera-relative, Stage 3) |
| R | Reload (pass 9; empty-click also auto-reloads) |
| ESC | Pause (browser exits pointer lock — that *is* the pause) |

## 7. Tech & architecture

- **Stack:** plain HTML/CSS/JS, ES modules, **no bundler, no build step**.
  Three.js is **vendored** at **r185** in `lib/` — the r185 build is split, so
  it's a pair: `three.module.js` + `three.core.js` (the former imports the
  latter as a sibling). Game code imports it by **relative path**
  (`../lib/three.module.js`) — no import map, because the committed Node test
  suite can't read browser import maps and relative specifiers behave
  identically in browser and Node. Ship folder stays fully self-contained
  (no CDN at runtime). At ship time the `.min` pair can be swapped in if
  upload size matters.
- **Renderer:** `WebGLRenderer` with antialias, `devicePixelRatio` capped at 2,
  shadows OFF for the slice.
- **Crosshair + HUD:** HTML/CSS overlay, not in-scene meshes.
- **Persistence:** namespaced key `zombieShooter.v1.best` (JSON:
  `{ score, accuracy }`); missing/old values default safely on load.
- **Tests:** committed `test_suite.mjs` at root (module-health section 0 imports
  every `src/**/*.js` under a DOM stub — lands with the shell pass). Throwaway
  `test_*.mjs` probes per pass are gitignored.

### File tree (target)

```
zombie_shooter/
├── index.html               entry (canvas + overlay roots)
├── style.css                single stylesheet at root
├── README.md
├── DESIGN.md                dev doc — outside the ship set
├── PROJECT_HANDOFF.md       session handoff — outside the ship set
├── LESSONS.md               error record — outside the ship set
├── .gitignore
├── test_suite.mjs           committed suite (190 asserts, 12 sections)
├── lib/
│   ├── three.core.js        vendored Three.js r185 (split build) — ships
│   └── three.module.js      vendored Three.js r185 — ships
├── src/
│   ├── main.js              entry + frame loop (suite-excluded boot glue)
│   ├── config.js            ALL tunables (87-key suite-enforced schema)
│   ├── state.js             screen/game state machine
│   ├── input.js             pointer lock, look, WASD, fire + R-reload hooks
│   ├── data/
│   │   ├── targetTypes.js   target registry
│   │   ├── enemyTypes.js    enemy registry (83 numeric fields/type: BODY,
│   │   │                    ANIM, COMBAT+squash, ATTACK, HITBOX, SPAWN, DEATH)
│   │   └── waveTable.js     wave composition + spawn points (arena property)
│   ├── render/
│   │   ├── scene.js         range environment (floor, walls, lights, fog)
│   │   ├── gun.js           viewmodel + recoil + reload dip
│   │   ├── fogBank.js       perimeter fog curtains (Waves)
│   │   ├── bloodFX.js       pooled bursts + floor pools
│   │   ├── casings.js       pooled ejected brass
│   │   ├── enemyBody.js     the Shambler builder (registry-driven, tagged)
│   │   ├── targets.js       target meshes, spawn slots, pop anim
│   │   └── enemies.js       enemy lifecycle: gait, attack, damage, death
│   ├── game/
│   │   ├── shooting.js      raycast + hit resolution
│   │   ├── scoring.js       score / streak / accuracy
│   │   ├── round.js         countdown + timer + round flow
│   │   ├── best.js          personal-best persistence
│   │   ├── player.js        arcade hits / health
│   │   ├── movement.js      pure WASD math (measured formulas)
│   │   ├── waves.js         wave manager (kills/wave/time)
│   │   ├── ammo.js          magazine + reload rules (pure, suite-proven)
│   │   └── secondOrder.js   spring-damper (ported; suite Section 12)
│   └── ui/
│       └── hud.js           HUD values + screen overlays + ammo counter
└── assets/                  still empty — everything is code-built
```

**Ship set** (what goes to itch later): `index.html`, `style.css`, `src/`,
`lib/`, `assets/`. Dev docs and the suite stay out of it.

## 8. Tunables (Stage-1 starting values — historical)

**`src/config.js` is the authoritative tunables list** (87 keys under a
suite-enforced schema; the enemy registry adds 83 more per type) — this table
is the original Stage-1 set, kept for the record:

| Constant | Start value | Note |
|---|---|---|
| FOV | 75° | |
| Eye height | 1.7 m | camera Y |
| Mouse sensitivity | 0.002 rad/px | |
| Pitch clamp | ±85° | |
| Fire cooldown | 150 ms | |
| Round length | 60 s | |
| Targets live | 3 | |
| Target radius | 0.5 m | visual = hitbox in Stage 1 |
| Slot grid | x ∈ {−10,−5,0,5,10}, z ∈ {−8,−12,−16,−20} | 20 slots |
| Spawn jitter | ±1.5 m x, ±1.0 m z; height 0.8–2.2 m | envelope x ±11.5, z −7…−21 |
| Min target separation | 2 m | |
| Points per hit | 100 | |
| Streak thresholds | ×2 @ 10, ×3 @ 20 (cap) | |
| Pop anim | 120 ms | |
| Recoil | 60 ms, 1° kick | feel pass |

These are starting points, not commitments — tuning is Daniel's call, one value
at a time.

## 9. Visual direction

Stage 1 ships on **code-built placeholder shapes** by design. One functional
choice made now: **dark, lightly fogged range with bright emissive targets**, so
hits read instantly against the background. The actual theme/art pass (zombie
flavor, palette, real gun model) is an open decision for Daniel — nothing in the
slice blocks on it.

## 10. Definition of done — Stage 1

- [x] Start screen → pointer lock → countdown → playable round → results → replay, with no dead ends
- [x] Losing pointer lock (ESC/alt-tab) always lands in PAUSED, never a broken state
- [x] 3 targets always live; hit → pop → respawn honors band + separation rules
- [x] Score, streak multiplier, accuracy, and timer all correct (hand-checked math)
- [x] Personal best persists across reloads
- [x] Gun feel pass done (recoil + muzzle flash)
- [x] `test_suite.mjs` green; no console errors; runs in Chrome + Firefox via Live Server *(Firefox 8-item once-through passed 2026-07-12 — Stage 1 DoD complete)*

## 11. Out of scope for Stage 1

*(Stage-1 list, kept for the record — several items have since shipped:
movement (Stage 3), enemies/health (Stage 2), reload/ammo (pass 9).)*
Still out of scope: audio (deferred — needs generated assets), real models
(never — code-built by design), weapon variety, difficulty modes,
touch/mobile, settings menu, leaderboards.

## 12. Open questions

- Game title — `zombie_shooter` is the working name only.
- **Wave-mode kill scoring** — zombie kills still award nothing; headshots
  (pass 7b) give the obvious identity (headshot bonus) whenever decided.
- Reload mode scope — currently BOTH modes; provisional (Daniel accepted in
  play but never explicitly ruled both-vs-Waves-only).
- ~~Creature design direction~~ — **RESOLVED 2026-07-12**: Direction A,
  "the Shambler" + glowing eyes (changelog v3.0).
- ~~Whether ammo/reload ever enters~~ — **RESOLVED 2026-07-12**: yes, pass 9
  (changelog v2.11).
- **Banked ideas:** dismemberment (Daniel, 2026-07-12 — builds on the 7b part
  tags + per-mesh limbs; casing-tumble physics as the motion reference);
  the maze arena (Stage 4 row above).

---

*Changelog: 2026-07-11 — v1, written after kickoff decisions (Option 1 slice, new repo).*
*2026-07-11 — v1.1 (shell pass): import map dropped in favour of relative imports (Node suite compatibility); vendored pair is `three.module.js` + `three.core.js` (r185 split build).*
*2026-07-11 — v1.2 (shot loop pass): spawn spec is the jittered slot grid (Option 3) with suite-pinned envelope; target registry named `targetTypes.js` to stay distinct from `render/targets.js`; target colour hot orange (crosshair readability).*
*2026-07-11 — v1.3 (scoring/HUD pass): threshold-hit multiplier semantics pinned (10th hit is the first ×2); HUD shows score + multiplier pill (pill hidden at ×1); accuracy is `null` before any shot; timer element reserved for the round pass.*
*2026-07-11 — v2 (roadmap): stage ladder reshaped around decisions A1/B1/C1 — finish Stage 1, enemies designed through Claude (procedural, creature-forge pipeline; no GLTFLoader), wave v1 is stationary last-stand, WASD becomes Stage 3; full pass roadmap added to §2.*
*2026-07-11 — v2.1 (round pass): pinned — lock loss during COUNTDOWN also pauses; clicks can only fire in PLAYING; a personal best requires score > 0 (ties don't count, first recorded best flashes NEW BEST); resume re-runs the 3-2-1 without consuming round time (suite-pinned).*
*2026-07-11 — v2.2 (feel pass): recoil (60 ms, 1° up + 0.06 m back, eased return) + muzzle flash (additive quad AND point-light pulse, 50 ms) on every real shot, hits and misses alike; new tunables RECOIL_KICK_BACK / FLASH_MS / FLASH_INTENSITY.*
*2026-07-11 — v2.3 (guard): suite Section 5 config contract (42-key schema + usage scan over all src incl. main.js), added after the NaN-light incident (LESSONS.md) and proven to fire on it; DoD items 1–6 ticked, browser matrix pending.*
*2026-07-11 — v2.4 (proto-zombie pass, picks 1+B): dev-toggled proto-zombie (`DEBUG.SPAWN_ZOMBIE`, intentionally true in the dev build) — blocky arms-out humanoid, stride-locked procedural shamble, walks from (0,−28) and stops exactly 2 m out; `enemyTypes.js` registry + `enemies.js`; MEASURED: `rotation.y = atan2(dx,dz)` faces a +Z-built body at the player; new SHIP env-var gate makes the suite fail any truthy DEBUG flag pre-ship; registries now leaf-swept by Section 5; movement clamp suite-pinned (Section 6).*
*2026-07-11 — v2.5 (combat pass, pick A): unified hit pipeline (targets + enemy body parts raycast together, nearest wins, kind-tagged dispatch); proto_zombie HP 3, hit reaction = red flash 100 ms + stagger 200 ms + 0.15 m knockback; death = fall-over around the feet (600 ms, k² ease) → lie 1500 ms → fade 400 ms → despawn; dying bodies are unhittable (shots pass through); zombie hits are SCORING-NEUTRAL until wave-mode scoring (passes 5–6); death timeline suite-pinned relative to registry timings.*
*2026-07-11 — v2.6 (mode split, 5a of pick 1): START offers Range / Waves; Waves = untimed last-stand arena (no practice targets, no round clock — suite-pinned) with the zombie in its proper home; `DEBUG.SPAWN_ZOMBIE` retired (DEBUG block + SHIP gate stay for future flags); PAUSED gains Quit to menu; range-as-a-mode open question RESOLVED: yes. Player health, attacks, and game over are 5b.*
*2026-07-11 — v2.7 (threat pass, 5b, pick B): zombie telegraphed swipe (windup 300 ms arms-rear tell → strike lands damage → recover; cooldown 1200 ms start-to-start, suite-asserted ≥ phase sum); pinned — a hit CANCELS an in-progress attack and the cooldown keeps running; player = 5 arcade hits (hearts HUD), red vignette + 120 ms camera kick per hit; GAMEOVER state (kills + survival time, Try Again, Quit); waves kills/time counters live in main until the pass-6 wave manager absorbs them.*
*2026-07-11 — v2.8 (wave manager, pass 6): cleared-based waves — intermission (2.5 s, "WAVE N" banner, first one waits for the first PLAYING frame so it never collides with the 3-2-1) → staggered spawns (800 ms gaps, 5 spawn points cycled from a random offset) → all dead → next; `waveTable.js` data (5 hand-tuned waves + endless EXTEND formula, speed capped ×1.4, suite-pinned relatively); per-spawn speed multiplier; O(n²) pairwise crowd separation (0.9 m); kills/time/wave absorbed into `waves.js`; enemy SPAWN moved out of the registry (arena property); pooling DEFERRED until a measured frame drop.*
*2026-07-11 — v2.9 (movement, Stage 3 pulled forward before pass 7): camera-relative WASD (MEASURED vs r185: forward = (−sinY, −cosY)); normalized diagonals; arena clamp (WALL_MARGIN 0.6); player-vs-zombie circle resolve (0.3 + 0.45 — walking through the mob would void being surrounded); stuck-key guard clears WASD on lock loss; the strike now RANGE-CHECKS at the damage moment — backing out of reach makes it whiff (movement is defence); `movement.js` pure + suite Section 9. Pass-7 source relocated: creature-forge skill LOST → ExperimentProject repo `sdf-blend-shell/` (see §2 note).*
*2026-07-12 — v2.10 (atmosphere, pass 8.1–8.4): perimeter fog bank (fixed layered curtains hugging the walls, per-wall depths, canvas-gradient texture, Waves-only) + zombie spawn fade-in (registry SPAWN.FADE_MS 600, kill mid-fade snaps opaque); Waves whole-arena distance murk (FOG.WAVES, Daniel-tuned to NEAR 3 / FAR 13 — tension over visibility, flankers appear unannounced BY DESIGN); blood (pooled cube bursts at the exact raycast point sprayed off the ray, kill eruption + floor pools 8 s linger / 1 s fade, 3-blob CSS screen splatter on player damage, hard caps 64/24); brass casings (muzzle-anchored — PORT_FWD −0.45 after a camera-space sign fix, tumble, one dampened bounce, 3 s linger, cap 40); suite gained the fog-coverage invariant (every spawn point inside a bank) and the pool/casing pure timelines. Audio remains the deferred tail of pass 8.*
*2026-07-12 — v2.11 (reload, pass 9 — resolves the §12 ammo question): magazine 12 (4 kills at zombie HP 3), unlimited reserve; R reloads manually, an empty click auto-reloads; RELOAD_MS 1200 EQUALS the zombie attack cooldown on purpose (reloading in melee range risks a hit); firing blocked while reloading, movement free; gun-dip sine telegraph (GUN.RELOAD_DIP, position.y only — recoil owns z/rotation); bottom-right `N / 12` counter, red at ≤ LOW_AT 3; reload ticks ONLY in PLAYING (pause freezes it mid-dip); pure rules in `game/ammo.js`, suite Section 10. Applies in BOTH modes — provisional; pre-pass-9 Range personal bests were earned under infinite ammo.*
*2026-07-12 — v3.0 (CREATURE, pass 7 complete — 7a body/gait, 7b hitboxes, 7c flinch): the SDF pipeline was NOT adopted (ExperimentProject demoted — halted research, grain of salt; Daniel prefers this look); pass 7 became anatomy + hitboxes + springs. **The Shambler** (Direction A + glowing eyes): registry-driven body (`BODY` block — a future enemy type is pure data) — oversized forward-jutting head, hanging jaw, hunched chest, two-segment arms/legs (joints at 55%), dark feet, unlit fog-free amber eyes that appear in the murk before the body. Gait converged over 8 browser rounds (the normal shape of feel work — LESSONS): stride phase drives everything; good left leg steps (lagged knee pulse), bad right leg PINNED — trails, shin locked in a toe-scrape, body rolls onto the good side and SINKS once per stride (BOB_AMP is a dip, not a bob); sway stride-locked (SWAY_FREQ must stay BOB_FREQ/2); idle breathing is an integrated per-enemy phase (scaling accumulated phase caused the shot/strike shake — LESSONS); LIMP is the one limp knob. Attack is an overhead raise-and-slam with elbows extending through the strike. World-freeze fix: enemies/FX simulate only in PLAYING (zombies no longer advance through a resume 3-2-1). Hitboxes: every mesh part-tagged; HITBOX table HEAD 3 / TORSO 1 / LIMB 0.5 (fractional HP; headshot one-shots + double burst; untagged falls back to torso — suite-guarded). Flinch: ported `secondOrder.js` spring (provenance header; OUR suite Section 12 proves the behaviors), hits kick a squash toward the feet (kick→peak ≈ ×0.022 at f5 ζ0.4; Daniel-tuned KICK 2). Suite at 24 modules / 190 asserts, Sections 11 (body geometry, measured headless) + 12 (springs) new. Dismemberment banked (§12).*
