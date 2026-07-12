# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-12 — session 3 end (first wrap of s3). This session:
prior-art research (Option 2 adopted) + the ENTIRE 4.3 navigation series
(4.3a flow field, 4.3b window entries, 4.3b.1 latch, 4.3b.2 climb pose).
HEAD at write time: Daniel's 4.3b.2 commit ("Pass 4.3b.2: climb pose -
three-phase procedural window climb..."); this wrap commits on top of it.
Next session verifies the tip as always — fetch+reset, never pull.

## 0. NEXT SESSION OPENS WITH (queue — order is Daniel's pick)

Three build passes are queued; open with an ordering pick (no design
rounds needed for the first, scoped rounds for the other two):

- **4.3c — spawn rework** (completes the 4.3 series): window/perimeter-
  based entries replacing the five fixed SPAWN_POINTS. MUST fix the
  MEASURED defect: spawn points (±13, −30) sit INSIDE blocked wall cells
  of the village (TL/TR north corner runs) — they only work because the
  resolver ejects them on frame one (§7). Scope round: pure window-entry
  spawns vs mixed perimeter+window vs wave-table-driven entry mixes.
- **Pass 10 — kill scoring** (adopted from research, Option 2): wave-mode
  kills score, headshot bonus (the 7b hook), CodePen-style CSS praise
  popup on the existing HUD layer. Resolves the long-open scoring item.
- **Pass 7c — the Crawler** (adopted from research, Option 2): leg
  destruction transitions a Shambler to a prone crawl (drag gait, slower
  close attack). First cash-out of the 7b hitbox substrate. DESIGN
  CONSTRAINT flagged: a crawler CANNOT VAULT — the shared flow field
  currently assumes every type climbs (windows priced for all). 7c needs
  either a second no-window field or per-type vault gating at the
  trigger; decide in its options round.
- Docs debt: DESIGN.md v3.1 — now covers Stage 4 AND the 4.3 series
  (grew past "one small changelog entry"; still a small docs pass).

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no downloaded
models/assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy, localStorage
  PB). Reload applies. NO map, NO nav — `setFlowField(null)`; every 4.3
  system is provably inert here (los short-circuits true, nav null).
- **Waves** — untimed last-stand in the village: four roomed buildings
  around a fountain plaza, fog + fence, escalating waves, 5-hit health.
  Zombies NAVIGATE (4.3): flow field around buildings, through doorways,
  and now THROUGH WINDOWS (climbing), with one-climber-one-waiter queues.

`RESEARCH_PRIOR_ART.md` (repo root, this session): prior-art techniques
mapped to the roadmap — consult before designing audio, environments,
scoring, or enemy-variety passes. `DESIGN.md` v3.0 (v3.1 queued). No DevLog.

## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**; enemyTypes.js
  / waveTable.js / maps.js full-replace with a "tuned anything?" caveat
  (this session used INSERTION paste-ins for enemyTypes' WALL/VAULT
  blocks — quote-the-anchor insertions are the safer default there too).
- Feel reports: mechanism → single lever → surgical value. Bugs: the
  debugging protocol — and REPRODUCE IN NODE before naming the mechanism
  (the corner-freeze's first hypothesis was wrong; the repro named the
  real one). Behavioral probes pin inputs BY TAG, never iteration order
  (the limb-mesh probe mimicked a real defect — LESSONS).
- **Claude sync: `git fetch origin && git reset --hard origin/main`,
  never pull; verify tip + key docs.** Checkpoint blocks are
  COPY-COMPLETE (end with `git push`). Read `git status` before add.
- Run `node test_suite.mjs` before every delivery. Render-path changes
  are SUITE-INVISIBLE — browser-first in testing steps. Animation/feel
  passes: the suite pins timelines/continuity; only eyes judge the read.

## 3. Current state (all tested & pushed)

**4.3 NAVIGATION (the whole series, this session):**
- **`game/flowField.js`** (pure): `buildFlowField(grid, target, opts)` —
  Dial's-bucket weighted search from the player's cell; every traversable
  cell stores a descent step (8-way directions on orthogonal distances,
  corner-guarded diagonals — never through sills). `opts.windowCost`
  prices 'W' cells as zombie edges (entry costs WINDOW_COST, exit 1;
  cost 0 = windows blocked, byte-identical to the plain field).
  `opts.blockedWindows` (Set of 'c,r') prices congested windows OUT.
  ONE build serves every zombie; main rebuilds only when the player
  changes cells OR the congestion signature changes.
- **Movement blend (enemies.js)**: descend the field when far OR when
  LOS-blocked; beeline only inside NAV.BEELINE_DIST WITH clear LOS; then
  separation, then walls LAST (unchanged order). Stop ring and both
  attack moments (start + damage landing) gate on LOS
  (`movement.js segmentClearOfAABBs`, 2D slab test) — proximity is never
  measured through walls. Breaking LOS mid-windup = a whiff (counterplay).
- **Facing**: `turnToward` (pure, shortest-arc via atan2(sinΔ,cosΔ)) is
  the ONLY writer of enemy yaw, clamped by NAV.TURN_RATE — bodies turn
  through quantized field headings instead of snapping. Knockback uses a
  cached toward-player normal (yaw no longer implies "faces the player").
- **Anisotropic wall collision**: `movement.js resolveBodyWithReach` —
  feet circle + a forward reach circle at the arm tips (registry WALL
  { REACH 0.75, RADIUS 0.25 }, guarded ?? 0). Face-on standoff = 1.0 m
  from the face; sideways slides and doorways byte-identical to the
  plain circle.
- **Window entries (4.3b + 4.3b.1 + 4.3b.2)**: field routes through
  windows when meaningfully shorter (NAV.WINDOW_COST 6 → crossing ≈ 7
  steps). At the sill (NAV.VAULT_TRIGGER 2.0 — MUST exceed the 1.8
  reach standoff, suite-asserted by name) the zombie claims the window's
  queue: ONE climber + ONE waiter per window; a full queue is CONGESTED
  and priced out of the shared field (main rebuild) so everyone else
  reroutes. The climb is a COMMITTED three-phase script (`climbPose`,
  pure): REACH (arms to a sill plant) → MOUNT (body to exactly sill
  height, lead leg over) → DROP (accelerating fall inside, the DRAG LEG
  hauls over late — the limp reads through the climb); travels four
  spatial anchors (from → sill-outer → sill-centre → landing just inside
  the face). Climbers stay HITTABLE (the free-hit window is the price);
  hits don't interrupt; killed climbers FALL BACK OUTSIDE and free the
  slot; dead/flanked waiters free the line; queues clear on reset.

**Adopted from research (Option 2, committed 25f92b4):** pass 10 (kill
scoring + praise popup) and pass 7c (Crawler) queued — see §0.

**Earlier passes (prior sessions, unchanged):** Stage 4 village map
(data-driven ASCII layouts, run-merged colliders, fence bands), Shambler
creature (drag-limp gait, slam, per-part hitboxes, squash spring), reload
(mag 12, R + auto-empty, both modes — provisional), atmosphere (fog bank,
murk, blood, casings; audio banked). World sim freezes outside PLAYING.

## 4. NEXT BUILD PASS (default): 4.3c — spawn rework

See §0. The window-entry substrate is DONE (climb, latch, pricing) — the
spawn pass mostly retargets WHERE zombies enter the map and retires the
fixed SPAWN_POINTS (two of which are inside walls, §7). Daniel's earlier
read ("likes the pressure") predates navigation — re-ask what pressure
should feel like now that they route and climb.

## 5. The suite — 28 modules, 296 asserts, run before EVERYTHING

Section 14 (navigation) is the session's addition and now covers: field
coverage/descent/corner-guard/greedy-routing (both maps), worldToCell
round-trip, graceful degradation, turnToward (wrap/clamp/arrival/seam),
reach resolve (standoff exact, parallel unchanged, doorway pass, no-op),
LOS segments (+ village wall/doorway integration), weighted windows
(connected, priced, orthogonal-only, exact crossing price, route flip by
price), blockedWindows (latch parity, coverage survives), trigger-vs-
standoff ordering BY NAME, VAULT.MS sanity, and the climb timeline (rest
at both ends, zero pops at phase boundaries, sill-height peak, monotonic
progress, late trail-leg haul). Sections 0–13 as before (config schema
now 91 keys incl. NAV's four).

## 6. Open / outstanding / banked

- **4.3c, pass 10, pass 7c** — §0 (ordering = Daniel's session-open pick).
- DESIGN.md v3.1 — grew to cover Stage 4 + 4.3 series (small docs pass).
- Reload scope (both modes) — still provisional.
- 7c×field constraint — crawlers can't vault (§0, decide at 7c).
- Watch item (unreported): arm-tips may brush the VISUAL door jambs
  (jambs have no colliders by design). Only act on a Daniel report.
- **Banked:** dismemberment (7c is its first step); Stage 4b basement;
  pass 8 audio (research found the no-asset path: Web Audio PannerNode +
  SYNTHESIZED buffers — see RESEARCH_PRIOR_ART.md); Stage 5 environment
  rotation per wave band (research); itch.io deploy (SHIP gate ready).
- Stale hand-file comments flagged not overwritten: enemyTypes
  SQUASH_KICK "~9%", LIMP comment (old behaviour), config duplicate
  RECOIL pair (harmless).
- LESSONS.md: **15 entries, 12 unharvested (2026-07-12)** — the 7 prior
  + this session's 5: anisotropic-proxy measurement; quantized-target
  rate-limited turning; LOS-gating distance decisions (+ repro-first);
  probe inputs pinned by tag (+ dead drafting terms); trigger-vs-standoff
  ordering as a named invariant. A dev-method harvest session is OVERDUE.

## 7. MEASURED facts (do not re-derive)

- Facing: `rotation.y = atan2(dx,dz)` on +Z-built bodies; player fwd
  = (−sinY,−cosY); camera/gun −Z-forward; muzzle gun-local (0,0.03,−0.45).
- Built Shambler extents (Box3, Node): half-width x 0.31; forward z 0.92
  rest / 1.02 with LEAN — vs BODY_RADIUS 0.45. The reach probe exists
  because of this gap.
- Face-on wall standoff = CELL/2 + WALL.REACH + WALL.RADIUS = 1.8 m
  (from the wall CELL's centre). Any sill/wall proximity trigger must
  exceed it (VAULT_TRIGGER 2.0; suite-asserted).
- worldToCell ROUNDS (cells are centre-addressed); round-trips every
  cell centre on both maps.
- Window crossing cost = WINDOW_COST + 1 (entry k, exit 1). Village door
  routes beat windows at k=6 unless the door path is long (fixture-pinned).
- climbPose contract: k=0 and k=1 are EXACTLY the walk rest pose;
  boundaries at k=0.25/0.65 are continuous; peak y = sillH exactly.
- Spawn points (±13, −30) lie INSIDE blocked wall cells (village rows 2,
  cols 2/18 runs); they work only via frame-one resolver ejection. 4.3c
  retires them. (0,−30) and (±15.5,−14) are on walkable cells.
- Spring f5 ζ0.4: kick→peak ≈ ×0.022, settle ~350 ms.
- Two-pass render: null scene.background on every pass after the first.
- Diagnostic: black scene + live HUD + no console errors = NaN transform
  OR a render-path paint-over — if the GUN is visible, it's the latter.

## 8. Session hygiene for next session

Attach this file. Open with the §0 ordering pick. Clone, fetch+reset,
state the tip inline, run the suite — expect **SUITE PASS, 28 modules,
296 asserts**. Every checkpoint block ends with `git push`. Rewrite this
handoff at session end; LESSONS.md holds 12 unharvested entries — flag
the overdue dev-method harvest to Daniel.
