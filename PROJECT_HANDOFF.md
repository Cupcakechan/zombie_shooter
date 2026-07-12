# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-12 — session 3 end, SECOND wrap (supersedes the same-day
first). This wrap adds **pass 4.3c (spawn rework)** — the 4.3 navigation
series is now COMPLETE: flow field, turning, reach collision, LOS gating,
window edges, vault, latch, climb pose, and grid-derived spawning with
the window dread beat. HEAD at write time: Daniel's 4.3c commit ("Pass
4.3c: spawn rework - grid-derived perimeter ring + window entries...");
this wrap commits on top with a SCOPED add (LESSONS #17). History note:
the 4.3b.2 climb-pose pass has NO own commit — its code rides inside the
docs commit `2ce0803` (the first wrap's checkpoint was skipped and
`git add .` swallowed the pass; recorded, not rewritten — no force-push).

## 0. NEXT SESSION OPENS WITH (queue — order is Daniel's pick)

- **Windows for the windowless (Daniel's request, next build):** the BL
  building has ZERO windows (south door only) and every existing window
  faces NORTH — window pressure is lopsided. A `maps.js` data pass: add
  W cells to BL + side/south faces elsewhere so every building is
  breachable from multiple directions. Small but touches PINNED suite
  numbers: village windows (6), entry spots (6) in §14, plus §13's
  window-run integrity — update the magic numbers WITH the map, and
  remember maps.js is Daniel-hand-tuned (full-replace caveat). Authoring
  rules the map must honour: every new W embedded in a wall run ('#'
  flanks along the run), both perpendicular neighbors walkable, exactly
  one of them exterior (the flood decides — suite §14 proves it).
- **Pass 10 — kill scoring** (adopted from research): wave kills score,
  headshot bonus, CSS praise popup.
- **Pass 7c — the Crawler** (adopted from research): leg destruction →
  prone crawl. CONSTRAINT: crawlers can't vault — the shared field
  assumes all types climb; needs a no-window field or per-type trigger
  gating (decide in its options round).
- DESIGN.md v3.1 — now owes Stage 4 + the full 4.3 series (docs pass).
- **Dev-method harvest — OVERDUE: 14 unharvested LESSONS entries.**

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no downloaded
models/assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy, localStorage
  PB). Reload applies. NO map/nav: every 4.3 system provably inert
  (setFlowField(null), los short-circuits, no colliders).
- **Waves** — untimed last-stand in the village. Zombies NAVIGATE: flow
  field around buildings/through doorways, CLIMB through windows (queued
  one-climber-one-waiter per window), and SPAWN from a grid-derived
  perimeter ring in the fog plus window entries that materialize at the
  glass, loiter a dread beat, then haul over the sill.

`RESEARCH_PRIOR_ART.md` (repo root): prior-art techniques mapped to the
roadmap — consult before audio/environment/scoring/enemy-variety design.
`DESIGN.md` v3.0 (v3.1 queued). No DevLog.

## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**; enemyTypes.js
  / waveTable.js / maps.js full-replace with a "tuned anything?" caveat
  (registry additions can be quote-the-anchor INSERTIONS — safer).
- Feel reports: mechanism → single lever → surgical value. Bugs:
  REPRODUCE IN NODE before naming the mechanism. Behavioral probes pin
  inputs BY TAG (never iteration order) and mirror main's wiring.
- **Claude sync: `git fetch origin && git reset --hard origin/main`,
  never pull; verify tip + key docs.** Checkpoint blocks COPY-COMPLETE
  (end with `git push`); READ `git status` before add; **docs-only
  checkpoints use SCOPED adds** (`git add <files>`) — `git add .`
  swallowed a skipped pass once (LESSONS #17); never two checkpoint
  blocks in one message when sequencing matters.
- Run `node test_suite.mjs` before every delivery. `node --check` does
  NO binding analysis and main.js can't be import-run (DOM) — grep every
  new identifier's import in DOM-coupled files (LESSONS #16). Render-
  path changes are SUITE-INVISIBLE — browser-first in testing steps.

## 3. Current state (all tested & pushed)

**4.3 NAVIGATION — COMPLETE (this session, six commits):**
- **Field** (`game/flowField.js`, pure): Dial's-bucket weighted search
  from the player's cell; per-cell descent steps (8-way on orthogonal
  distances, corner-guarded — never through sills). `windowCost` prices
  'W' cells (entry k, exit 1; 0 = blocked, byte-identical plain field);
  `blockedWindows` prices congested windows out. ONE build serves all;
  main rebuilds on player cell-change OR congestion-signature change.
- **Movement**: field when far or LOS-blocked; beeline only close WITH
  LOS; then separation, then walls LAST. Stop ring + both attack moments
  gate on LOS (`segmentClearOfAABBs`) — proximity never measured through
  walls; breaking LOS mid-windup = whiff.
- **Facing**: `turnToward` (shortest arc, NAV.TURN_RATE-clamped) is the
  only yaw writer. Knockback uses the cached toward-player normal.
- **Wall collision**: `resolveBodyWithReach` — feet circle + forward
  reach circle (registry WALL block, guarded ?? 0). Face-on standoff
  1.8 m from the wall cell's centre.
- **Windows**: route through when meaningfully shorter (WINDOW_COST 6).
  At the sill (VAULT_TRIGGER 2.0 > standoff 1.8, suite-named) claim the
  queue: ONE climber + ONE waiter; full = congested = priced out, others
  reroute. The climb (`climbPose`, pure): REACH → MOUNT (to exactly sill
  height, lead leg over) → DROP (drag leg hauls late), four spatial
  anchors, lands just inside the face. Climbers hittable; killed = fall
  back outside + slot frees; queues clear on reset.
- **Spawning (4.3c)**: SPAWN_POINTS RETIRED (two sat inside wall cells).
  All grid-derived (`mapGrid.js`): `exteriorCells` (boundary flood with
  D+W sealed = streets vs rooms, zero hints), `perimeterSpawnCells(grid,
  edges)` — main uses N/E/W (south edge is 1.4 m short of the front fog
  bank; suite proves the 65-cell ring fully murk-covered), and
  `windowEntrySpots` (street side vs room side via the flood). waves.js
  decides each zombie's KIND per the wave's `entry` mix (`entryKinds`,
  pure, injected rand); main's injected `pickEntry` resolves kind →
  place with a never-null fallback chain (house01's 0/0/0 degrades
  gracefully). Window entries spawn AT the facing standoff (a
  cell-centre spawn scooted frame-one — probe-caught), FACING the glass,
  with a 900–1600 ms loiter: the dread beat. Wakes on pain or on the
  player closing in the open; staring through the glass does NOT wake it
  (window blocks feet-level LOS — by design).

**Wave table (`data/waveTable.js`)**: per-wave `entry` mixes (w1–2
perimeter-only → 50/50 by w5; +0.03 window share per extended wave,
cap 0.6), SPAWN block (MIN_PLAYER_DIST 10, loiter 900–1600). All prior
tuned values preserved verbatim.

**Adopted from research** (25f92b4): pass 10 + pass 7c queued (§0).
**Earlier passes unchanged**: Stage 4 village map, Shambler (drag-limp,
slam, per-part hitboxes, squash spring), reload (both modes,
provisional), atmosphere (fog bank, murk, blood, casings; audio banked —
research found the no-asset path: PannerNode + synthesized buffers).
World sim freezes outside PLAYING.

## 4. NEXT BUILD PASS (default): windows for the windowless

See §0 first bullet — Daniel's request, a maps.js data pass with suite
magic-number updates riding along. Open with a quick layout proposal
(which walls get W cells) rather than a full options round; the
authoring rules and the proving machinery already exist.

## 5. The suite — 28 modules, 314 asserts, run before EVERYTHING

Session-3 additions live in §8 (entry mixes, entryKinds arithmetic,
window-share cap, SPAWN sanity, and the REWORKED fog probe: the N/E/W
ring fully bank-covered — this probe is WHY the south edge is excluded)
and §14 (field/turn/reach/LOS/window/latch/climb probes from earlier
wraps, plus spawn geometry: exterior 318 streets-not-rooms, ring 65 all
walkable, 6/6 window entry spots street-outside room-inside, house01
0/0/0 by name). PINNED NUMBERS that the windows map pass will change:
village windows 6, entry spots 6 (§14), window-run integrity (§13).

## 6. Open / outstanding / banked

- **Windows map pass, pass 10, pass 7c, DESIGN v3.1, harvest** — §0.
- Reload scope (both modes) — still provisional.
- Watch item (unreported): arm-tips may brush visual door jambs.
- **Banked:** dismemberment (7c first step); Stage 4b basement; pass 8
  audio (no-asset path known); Stage 5 environment rotation; itch.io
  deploy (SHIP gate ready).
- Stale hand-file comments flagged not overwritten: enemyTypes
  SQUASH_KICK "~9%", LIMP comment, config duplicate RECOIL pair.
- LESSONS.md: **17 entries, 14 unharvested (2026-07-12)** — session 3
  added 7: anisotropic-proxy measurement; quantized-target turning;
  LOS-gating distance decisions; pinned probe inputs; trigger-vs-
  standoff ordering; --check's missing-binding blind spot (grep new
  identifiers in DOM-coupled files); scoped adds for docs commits.

## 7. MEASURED facts (do not re-derive)

- Facing: `rotation.y = atan2(dx,dz)` on +Z-built bodies; player fwd
  = (−sinY,−cosY); camera/gun −Z-forward; muzzle gun-local (0,0.03,−0.45).
- Built Shambler extents: half-width x 0.31; forward z 0.92 rest / 1.02
  leaned — vs BODY_RADIUS 0.45 (why the reach probe exists).
- Face-on standoff = CELL/2 + WALL.REACH + WALL.RADIUS = 1.8 m from the
  wall cell's centre. Proximity triggers must exceed it (VAULT_TRIGGER
  2.0); spawns near faced geometry must START at it or scoot frame one.
- worldToCell ROUNDS (centre-addressed); round-trips both maps.
- Window crossing cost = WINDOW_COST + 1. climbPose: k=0/1 exactly the
  walk rest; boundaries 0.25/0.65 continuous; peak y = sillH.
- Village spawn geometry: exterior 318 cells; N/E/W ring 65; all 6
  windows entry-capable. South edge z +2.6 vs front bank inner face
  z ≥ 4 (1.4 m short) — why the ring excludes it. house01: 0/0/0 (its
  boundary IS the house wall).
- Spring f5 ζ0.4: kick→peak ≈ ×0.022, settle ~350 ms.
- Two-pass render: null scene.background on every pass after the first.
- Diagnostic: black scene + live HUD + no console errors = NaN transform
  OR render-path paint-over — if the GUN is visible, it's the latter.

## 8. Session hygiene for next session

Attach this file. Open with the §0 ordering pick (windows map pass is
Daniel's stated next). Clone, fetch+reset, state the tip inline, run the
suite — expect **SUITE PASS, 28 modules, 314 asserts**. Checkpoint
blocks end with `git push`; docs checkpoints use SCOPED adds. Rewrite
this handoff at session end; flag the overdue harvest (14 entries).
