# Zombie Shooter — Design Doc

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Status: **living document** — updated whenever a decision changes. Current work: Stage 1.

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
| 1 | Shooting Range | Pointer-lock aim, hitscan shot, targets, scoring, round timer, results | **CURRENT — 2 passes left** |
| 2 | Zombie Waves — Last-Stand | Zombies approach a stationary player, HP both ways, waves, game over | Next |
| 3 | WASD Arena | Player movement + bounds, zombies that chase | Later |

> Enemies are **designed through Claude** (Decision B1, 2026-07-11): code-built
> creatures with procedural animation — a placeholder "proto-zombie" proves the
> systems first, then the real designed creatures land via Daniel's creature
> pipeline (**attach the creature-forge skill for those passes**). No downloaded
> models, no GLTFLoader. Octree/Capsule world collision (the research report's
> path) is deferred unless a real level ever demands it.

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
   pipeline, swapped in behind the registry.
8. **Atmosphere pass (optional)** — positional audio, blood particles/decals,
   difficulty tuning.

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

- **START** — title, START button, controls line. (Pointer lock may only be
  requested from a user gesture, so a click is mandatory here by browser rule.)
- **COUNTDOWN** — big 3-2-1 overlay; input locked, no shooting yet.
- **PLAYING** — HUD: score (top-left), streak multiplier (next to score),
  timer (top-right). Crosshair fixed at screen center.
- **PAUSED** — entered automatically whenever pointer lock is lost (ESC or
  alt-tab) during play *or* countdown. Timer freezes. Overlay: "Click to
  resume" → re-lock → 3-2-1 → resume.
- **RESULTS** — score, accuracy %, best streak, personal best (with "NEW BEST!"
  flag when beaten), PLAY AGAIN button.

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
├── index.html               entry (import map + canvas + overlay roots)
├── style.css                single stylesheet at root
├── README.md
├── DESIGN.md                dev doc — outside the ship set
├── PROJECT_HANDOFF.md       session handoff — outside the ship set
├── .gitignore
├── test_suite.mjs           committed module-health suite
├── lib/
│   ├── three.core.js        vendored Three.js r185 (split build) — ships
│   └── three.module.js      vendored Three.js r185 — ships
├── src/
│   ├── main.js              entry + frame loop
│   ├── config.js            ALL tunables live here
│   ├── state.js             screen/game state machine
│   ├── input.js             pointer lock, mouse look, fire clicks
│   ├── data/
│   │   └── targetTypes.js   target registry (Stage 3 zombies join here)
│   ├── render/
│   │   ├── scene.js         range environment (floor, walls, lights, fog)
│   │   ├── gun.js           viewmodel + recoil
│   │   └── targets.js       target meshes, spawn slots, pop anim
│   ├── game/
│   │   ├── shooting.js      raycast + hit resolution
│   │   ├── scoring.js       score / streak / accuracy
│   │   └── round.js         countdown + timer + round flow
│   └── ui/
│       └── hud.js           HUD values + screen overlays
└── assets/                  empty in Stage 1 — placeholders are code-built
```

**Ship set** (what goes to itch later): `index.html`, `style.css`, `src/`,
`lib/`, `assets/`. Dev docs and the suite stay out of it.

## 8. Tunables (starting values — all live in `src/config.js`)

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
- [ ] `test_suite.mjs` green; no console errors; runs in Chrome + Firefox via Live Server

## 11. Out of scope for Stage 1

Movement (Stage 3), enemies/health (Stage 2), audio, real models, weapon
variety, reload/ammo, difficulty modes, touch/mobile, settings menu, leaderboards.

## 12. Open questions

- Game title — `zombie_shooter` is the working name only.
- Creature design direction (Daniel's call, at roadmap pass 7 via creature-forge).
- Does the Stage 1 range survive as a selectable mode next to Waves? Cheap to
  keep (the state machine already separates them) — decide during Stage 2.
- Whether ammo/reload ever enters (classic wave-shooter pressure lever).

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
