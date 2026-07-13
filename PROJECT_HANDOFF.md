# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-12 — session 3 end, THIRD wrap (supersedes the same-day
first two). Adds the **windows map pass** on top of the complete 4.3
navigation series: the village now has **11 windows across all four
compass faces** (was 6, all north; BL had none), every one entry-capable,
with ZERO code changes — pure layout data. HEAD at write time: Daniel's
windows commit ("Map: five new windows..."); this wrap commits on top
with a SCOPED add. History note (unchanged): pass 4.3b.2 has no own
commit — its code rides inside docs commit `2ce0803` (recorded, not
rewritten).

## 0. NEXT SESSION OPENS WITH (queue — order is Daniel's pick)

- **Pass 10 — kill scoring** (adopted from research): wave kills score,
  headshot bonus (the 7b hook), CSS praise popup on the existing HUD
  layer. Resolves the long-open scoring item. Scoped options round.
- **Pass 7c — the Crawler** (adopted from research): leg destruction →
  prone crawl (drag gait, slower close attack), first cash-out of the
  7b hitbox substrate. CONSTRAINT: crawlers can't vault — the shared
  field assumes all types climb; needs a no-window field or per-type
  trigger gating (decide in its options round). pickEntry also gains a
  typeId when types multiply (noted in main.js).
- DESIGN.md v3.1 — owes Stage 4 + the 4.3 series + the windows pass.
- **Dev-method harvest — OVERDUE: 14 unharvested LESSONS entries.**

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no downloaded
models/assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy, localStorage
  PB). Reload applies. NO map/nav: every 4.3 system provably inert.
- **Waves** — untimed last-stand in the village. Zombies NAVIGATE: flow
  field around buildings/through doorways, CLIMB through windows (one
  climber + one waiter per window; congested windows priced out), SPAWN
  from a grid-derived N/E/W perimeter ring in the fog plus window
  entries that materialize at the glass, loiter a dread beat, then haul
  over the sill. With 11 windows on all four building faces, the siege
  now comes from every direction — including the P-room's own south
  window.

`RESEARCH_PRIOR_ART.md` (repo root): prior-art techniques mapped to the
roadmap. `DESIGN.md` v3.0 (v3.1 queued). No DevLog.

## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**; enemyTypes.js
  / waveTable.js / maps.js full-replace with a "tuned anything?" caveat
  (registry additions can be quote-the-anchor INSERTIONS — safer).
- Feel reports: mechanism → single lever → surgical value. Bugs:
  REPRODUCE IN NODE before naming the mechanism. Behavioral probes pin
  inputs BY TAG and mirror main's wiring.
- **Claude sync: `git fetch origin && git reset --hard origin/main`,
  never pull; verify tip + key docs.** Checkpoint blocks COPY-COMPLETE
  (end with `git push`); READ `git status` before add; **docs-only
  checkpoints use SCOPED adds** (LESSONS #17); never two checkpoint
  blocks in one message when sequencing matters.
- Run `node test_suite.mjs` before every delivery. `node --check` does
  NO binding analysis and main.js can't be import-run — grep every new
  identifier's import in DOM-coupled files (LESSONS #16). Render-path
  changes are SUITE-INVISIBLE — browser-first in testing steps. Layout
  edits: identical rows exist (e.g. old rows 3/6) — use two-line
  anchors; the exact-anchor rule caught it live this session.

## 3. Current state (all tested & pushed)

**Windows map pass (this wrap):** five new `W` cells — BL west (2,16),
BL south into the P room (5,20), TL east (9,4), TR east (18,6), BR
south (16,20). 11 windows total, all entry-capable, every building
breachable from ≥2 compass directions. Geometry, colliders, occluders,
field pricing, latch, and the spawn picker all derived them from the
layout with zero code edits — the data-driven-map payoff, measured.

**4.3 NAVIGATION — COMPLETE (six commits + the swallowed 4.3b.2):**
- **Field** (`game/flowField.js`, pure): Dial's-bucket weighted search
  from the player's cell; 8-way corner-guarded descent steps; windows
  priced via `windowCost` (entry k, exit 1; 0 = plain field);
  `blockedWindows` prices congested queues out. One build serves all;
  main rebuilds on player cell-change OR congestion-signature change.
- **Movement**: field when far or LOS-blocked; beeline only close WITH
  LOS; separation then walls LAST. Stop ring + both attack moments gate
  on LOS (`segmentClearOfAABBs`); mid-windup LOS break = whiff.
- **Facing**: `turnToward` (shortest-arc, NAV.TURN_RATE-clamped) is the
  only yaw writer. Knockback uses the cached toward-player normal.
- **Wall collision**: `resolveBodyWithReach` — feet circle + forward
  reach circle (registry WALL block, guarded). Face-on standoff 1.8 m.
- **Windows**: routed when meaningfully shorter (WINDOW_COST 6); at the
  sill (VAULT_TRIGGER 2.0 > standoff 1.8, suite-named) claim the queue
  (ONE climber + ONE waiter; full = congested = rerouted). `climbPose`
  (pure): REACH → MOUNT (exactly sill height, lead leg over) → DROP
  (drag leg hauls late); four spatial anchors; lands just inside the
  face. Climbers hittable; killed = fall back outside + slot frees.
- **Spawning (4.3c)**: SPAWN_POINTS retired. Grid-derived: exterior
  flood (streets vs rooms), N/E/W perimeter ring (south edge is 1.4 m
  short of the front fog bank — suite proves the ring murk-covered),
  window entry spots. waves.js picks each zombie's KIND per the wave's
  `entry` mix (`entryKinds`, pure); main's `pickEntry` resolves kind →
  place, never-null fallback chain. Window entries spawn AT the facing
  standoff, FACING the glass, loiter 900–1600 ms; wake on pain or
  close-in-the-open; the glass blocks feet-level LOS by design.

**Wave table**: per-wave `entry` mixes (w1–2 perimeter-only → 50/50 by
w5; +0.03 window share per extended wave, cap 0.6); SPAWN block
(MIN_PLAYER_DIST 10, loiter 900–1600). Prior tuned values verbatim.

**Adopted from research** (25f92b4): pass 10 + pass 7c queued (§0).
**Earlier passes unchanged**: Shambler (drag-limp, slam, per-part
hitboxes, squash spring), reload (both modes, provisional), atmosphere
(fog bank, murk, blood, casings; audio banked — no-asset path known:
PannerNode + synthesized buffers). World sim freezes outside PLAYING.

## 4. NEXT BUILD PASS (default): pass 10 — kill scoring

See §0. Small, HUD-adjacent, resolves the oldest open decision; the
praise popup rides the existing HUD layer. 7c follows (its options
round must settle the crawler-vs-field constraint).

## 5. The suite — 28 modules, 314 asserts, run before EVERYTHING

Session-3 coverage: §8 (entry mixes, entryKinds arithmetic, window-share
cap, SPAWN sanity, N/E/W ring fully bank-covered — WHY the south edge
is excluded) and §14 (field/turn/reach/LOS/window/latch/climb/spawn-
geometry probes). PINNED village numbers at HEAD: windows **11**, entry
spots **11**, exterior 318, walkable/flood 387, ring 65. §13 window
integrity is violation-counting (auto-scales with the map).

## 6. Open / outstanding / banked

- **Pass 10, pass 7c, DESIGN v3.1, harvest** — §0.
- Reload scope (both modes) — still provisional.
- Watch item (unreported): arm-tips may brush visual door jambs.
- **Banked:** dismemberment (7c first step); Stage 4b basement; pass 8
  audio; Stage 5 environment rotation; itch.io deploy (SHIP gate ready).
- Stale hand-file comments flagged not overwritten: enemyTypes
  SQUASH_KICK "~9%", LIMP comment, config duplicate RECOIL pair.
- LESSONS.md: **17 entries, 14 unharvested (2026-07-12)** — harvest
  session genuinely overdue.

## 7. MEASURED facts (do not re-derive)

- Facing: `rotation.y = atan2(dx,dz)` on +Z-built bodies; player fwd
  = (−sinY,−cosY); camera/gun −Z-forward; muzzle gun-local (0,0.03,−0.45).
- Built Shambler extents: half-width x 0.31; forward z 0.92 rest / 1.02
  leaned — vs BODY_RADIUS 0.45 (why the reach probe exists).
- Face-on standoff = CELL/2 + WALL.REACH + WALL.RADIUS = 1.8 m from the
  wall cell's centre. Proximity triggers must exceed it; spawns near
  faced geometry must START at it or scoot frame one.
- worldToCell ROUNDS (centre-addressed); round-trips both maps.
- Window crossing cost = WINDOW_COST + 1. climbPose: k=0/1 exactly the
  walk rest; boundaries 0.25/0.65 continuous; peak y = sillH.
- Village at HEAD: **11 windows** on all four building faces — north
  (3,2)(7,2)(14,2)(17,2)(14,15)(17,15), east (9,4)(18,6), west (2,16),
  south (5,20)(16,20). All 11 entry-capable. Exterior 318; N/E/W ring
  65; walkable 387. South map edge z +2.6 vs front bank inner face
  z ≥ 4 (1.4 m short) — why the ring excludes it. house01: 0/0/0.
- Village layout rows 3 and 6 were IDENTICAL strings pre-windows (row 6
  now differs) — two-line anchors for layout edits.
- Spring f5 ζ0.4: kick→peak ≈ ×0.022, settle ~350 ms.
- Two-pass render: null scene.background on every pass after the first.
- Diagnostic: black scene + live HUD + no console errors = NaN transform
  OR render-path paint-over — if the GUN is visible, it's the latter.

## 8. Session hygiene for next session

Attach this file. Open with the §0 ordering pick (pass 10 is the
default). Clone, fetch+reset, state the tip inline, run the suite —
expect **SUITE PASS, 28 modules, 314 asserts**. Checkpoint blocks end
with `git push`; docs checkpoints use SCOPED adds. Rewrite this handoff
at session end; flag the overdue harvest (14 entries).
