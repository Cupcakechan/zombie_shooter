# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-13 — session 5, mid-session docs checkpoint. **The
Crawler is COMPLETE through 7c.3** (sphinx waist rig 7c.2 + crawl feel
round 7c.3), browser-approved, tip `bb31607` before this docs commit.
This session also ran the **genre deep-research pass** — the report is
now in-repo (`RESEARCH_GENRE.md`) and §0 below is the ADOPTED roadmap:
the old queue folded into the report's candidate passes, weighted by
Daniel's two stated priorities — **more weapon variety** and **a
challenging game**. History note (unchanged): 4.3b.2's code rides
inside docs commit `2ce0803`.

## 0. ROADMAP (adopted 2026-07-13 — ordering PROVISIONAL, Daniel
reorders by pass name; report refs = RESEARCH_GENRE.md PART 2 numbers)

**Next session opens with: Pass 10 options round.**

**Phase 1 — scoring & economy keystone**
- **Pass 10 — kill scoring + praise popup** (options round on style):
  wave kills score, headshot bonus, CSS praise popup on the HUD layer.
- **Pass 11 — spendable points currency** [report #1]: per-kill value
  as an `enemyTypes.js` field (auto-flows to every future archetype),
  locational bonus reuses hit data, HUD counter. Per-KILL model (no
  leg-farm exploit). The keystone that Phases 3+ spend against.

**Phase 2 — challenge: enemy variety** [priority: challenging game]
- **Pass 7d — spawnable crawlers** (hook shipped: `beginCrawl(rec,
  instant)`, `instant=true` spawns prone, no fall): `pickEntry` gains a
  typeId (window entries must refuse non-climbers), wave-table entry
  mixes gain a type dimension. This IS the first archetype pass — the
  type-dimension plumbing it builds is what passes 12–14 ride on.
- **Pass 12 — sprinter + brute** [report #3A]: registry stat/scale
  variants (speed/HP/scale + tint via material color/emissive).
- **Pass 13 — exploder** [report #3B]: on-death AoE, reuses bloodFX
  tech; leg-crippling an exploder into a ticking crawler comes free.
- **Pass 14 — spitter** [report #3C]: ranged arc projectile
  (code-generated sphere), first ranged threat.
- **Pass 15 — special reward round** [report #2]: every N rounds a
  hound round (fast low-HP registry entry, emissive tint, oscillator
  warning cue, existing fog) ending in a Max-Ammo pulse.

**Phase 3 — weapon variety** [priority: Daniel's explicit ask]
- **Pass 16 — weaponTypes.js registry + switching**: data-driven
  weapon registry (damage, fire rate, mag, spread, recoil kick, muzzle
  offsets); a second weapon proves the registry; number-key/scroll
  switching. Prereq for everything below.
- **Pass 17 — weapon roster expansion**: 2–3 more entries (shotgun
  pellet spread, SMG, etc.) — pure data + code-drawn meshes.
- **Pass 18 — wall-buys** [report #5]: buy-spot registry (position +
  item id + price), chalk-outline CanvasTexture panels on existing
  buildings; ammo ≈ half weapon price. Prereq: passes 11 + 16.
- **Pass 19 — upgrade station** [report #6]: one machine, big fee,
  stat multiplier + emissive tint + brighter muzzle flash + synthesized
  jingle.

**Phase 4 — score feel & challenge modulation**
- **Pass 20 — combo/style meter** [report #4]: decaying multiplier
  (fast/headshot/varied kills), HUD meter, pitch-rising chime. Can jump
  forward cheaply — it amplifies Pass 10 directly.
- **Pass 21 — intensity spawn modulator** [report #10]: rolling stress
  scalar (damage taken vs kills/time) throttles or surges spawns —
  the "challenging game" self-balancer. Tune against rubber-band feel.
- **Pass 22 — window-boarding repair economy** [report #8]: board
  entities on the existing windows, per-board repair for points,
  tear-down reuses vault logic. Unusually cheap given window tech.

**Long tail (unscheduled, gated):** traps [#7], perks [#9], buyable
doors [#12], mutators [#11], roguelite meta [#13], mystery box [#14 —
gate: ≥4–5 weapons], downed/second-wind [#15]. Docs debt: DESIGN.md
v3.1 (owes Stage 4 + 4.3 series + windows + 7c series); **dev-method
harvest — OVERDUE: 16 unharvested LESSONS entries.**

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no
downloaded assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy,
  localStorage PB). Reload applies. NO map/nav/zombies: 4.3 and 7c
  provably inert.
- **Waves** — untimed last-stand in the village. Zombies navigate a
  flow field, climb windows (queued, congestion-priced), spawn from the
  fog ring + window entries — and transform: 3 leg hits collapse a
  Shambler into a prone Crawler that keeps coming (§3).

Doc index: `RESEARCH_GENRE.md` (genre mechanics survey + candidate
passes — THE roadmap source, adopted in §0). `RESEARCH_PRIOR_ART.md`
(prior-art → roadmap map, session ≤3). `DESIGN.md` v3.0 (v3.1 queued).
`LESSONS.md` (19 entries). No DevLog.

## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**;
  enemyTypes.js / waveTable.js / maps.js: registry additions as
  quote-the-anchor INSERTIONS, full-replace needs a "tuned anything?"
  caveat.
- Feel reports: mechanism → single lever → surgical value. Bugs:
  reproduce/measure in Node before naming the mechanism.
- **Pose/rig constants are PROBE-MEASURED before shipping** (LESSONS
  #19). **Handoff numbers are pointers, not truth: MEASURED-at-HEAD
  wins** — 7c.2's calibration found this file's fix-round-1 numbers
  off by up to 0.14 m (§7); constraints re-anchor to fresh measurement.
- **Multi-edit plans get an end-state check against the PLAN** (LESSONS
  #18): grep the WRITE and the READ of every planned change in the
  final file.
- **Claude sync: `git fetch origin && git reset --hard origin/main`,
  never pull; verify tip + key docs.** Checkpoint blocks COPY-COMPLETE
  (end with `git push`); READ `git status` before add; docs-only
  checkpoints use SCOPED adds; never two checkpoint blocks in one
  message when sequencing matters.
- Run `node test_suite.mjs` before every delivery. `node --check` does
  no binding analysis; main.js can't be import-run — grep new
  identifiers' imports in DOM-coupled files; ES modules also get an
  import-run (`node --input-type=module -e "await import(...)"`).
  Render-path changes are SUITE-INVISIBLE — browser-first testing
  steps.

## 3. Current state

**THE CRAWLER — COMPLETE through 7c.3 (browser-approved 2026-07-13):**
- **Damage accounting**: leg chain retagged `'leg'` (arms keep
  `'limb'`); `HITBOX.LEG 0.5 === LIMB`; `legDmg` on the record;
  `CRAWL.LEG_HP 1.5` = exactly 3 leg hits (suite-pinned).
- **Transition**: `beginCrawl(rec, instant)` — releases window waits,
  cancels attacks; mid-vault defers via `crawlPending` to the landing.
  Leg-out hit sprays double (`res.legsOut`).
- **The sphinx rig (7c.2)**: `waist` Group in `enemyBody.js` pivoted at
  the belly/chest seam (y = bellyTop − 0.04 = 1.02); chest/head/arms
  re-parented, standing world-IDENTICAL (suite §11 pins head +
  shoulders to the registry stack at 1e-9). Prone counter-bend raises
  chest/head off the flattened pelvis. All pose constants
  probe-measured (§7).
- **Collapse & death carry the waist**: `collapsePose` has a waist
  channel riding the trunk's k² (suite-pinned both ends); death from
  prone captures `dieFromWaist` and relaxes to 0 through the fall —
  corpses settle FLAT; standing deaths capture 0, numerically
  identical to before.
- **The crawl gait (7c.3)**: one-sided reach-and-pull arm cycle —
  `max(0, ±sin)` lifts (REACH_AMP 0.5) on the crawl's OWN stride phase
  (STRIDE_FREQ 5.2 rad/m → a hand plants every ~0.6 m, ~1.1 s at crawl
  speed), roll phase-locked at stride/2, leg wiggle on the stride. The
  planted arm never digs BY CONSTRUCTION (lift-only), which is what let
  amplitude rise from the buried symmetric 0.075.
- **Prone turning (7c.3)**: `TURN_MULT 0.125` at the alive-path yaw
  write only (vault call untouched) — matches the prone head-end sweep
  (~2 m lever) to the standing shoulder sweep (~1.25 m/s) that already
  reads right.
- **Navigation**: two fields per rebuild — priced climb field + ground
  field (`windowCost 0`, windows untraversable); crawlers read the
  ground field, routes window-free BY CONSTRUCTION (suite: zero window
  steps, full coverage). `!crawling` belt on the vault trigger. Prone
  wall reach `CRAWL.WALL 2.0/0.25`.

**Unchanged from session 3**: 4.3 navigation complete (field, LOS
gating, turnToward, reach resolver, window climb+queue, grid-derived
spawning); 11 windows all faces; wave table with entry mixes; Shambler;
reload (provisional); atmosphere; world-sim freeze outside PLAYING.

## 4. NEXT BUILD PASS: **Pass 10 — kill scoring + praise popup (OPTIONS ROUND)**

Open with an options round on scoring style (per-kill values,
headshot bonus shape, popup presentation). Design it points-ready:
Pass 11 turns the score stream into spendable currency, so the kill
event payload should already carry the enemy's registry value and the
locational bonus flag. RESEARCH_GENRE.md PART 2 #1 and #4 are the
design references; the praise popup is the seed of the Pass 20 combo
meter — keep its HUD layer generic.

## 5. The suite — 28 modules, **336 asserts**, run before EVERYTHING

New in 7c.2/7c.3: **§11 exact standing-neutrality pins** (waist in
parts map, head/arms parented to it, standing waist rotation 0, head
world position === registry stack to 1e-9, shoulders exactly at
(±ARM.X, ARM.Y, ARM.FWD)); **§15 waist-aware** (collapsePose end-pins
gain the waist channel; prone-extent invariant recomputed with the
waist split — reads `CRAWL_POSE.WAIST`, auto-tracks retunes; currently
2.25 ≥ 2.17). Village pins unchanged: windows 11, entry spots 11,
exterior 318, walkable/flood 387, ring 65.

## 6. Open / outstanding / banked

- **Roadmap** — §0 (Pass 10 next; ordering provisional).
- **Watch items (crawler, feel — levers named, Daniel's call):**
  strike slam depth **−0.235** (was −0.143 pre-sphinx; momentary,
  eases out over 150 ms; lever: registry `CRAWL.ATTACK.THRUST_RAD`
  0.45 → ~0.30); **attack-start pop** — an attack triggered mid-reach
  snaps the lifted arm to the windup ramp in one frame (pre-existing,
  now visible at REACH_AMP 0.5; fix = blend windup start from current
  arm pose, its own round); **yaw spring** — if prone turning still
  reads as snapping at TURN_MULT 0.125, the mechanism is constant-rate
  onset; escalate to a `secondOrder.js` yaw spring (wrap-handled).
- RESOLVED watch items: trailing-toes hover (flat at HEAD:
  −0.011…0.037); prone standoff prediction — extent measured 2.17, did
  NOT drop below 2.0, so `CRAWL.WALL.REACH` stays and standoff stays
  2.25 m.
- Reload scope (both modes) — still provisional.
- Arm-tips vs door jambs (standing, unreported).
- **Banked:** pass 8 audio (PannerNode + synthesized buffers — note:
  Phase 2/3 passes introduce oscillator cues piecemeal; fold into pass
  8 when opened); Stage 4b basement; Stage 5 environment rotation;
  itch.io deploy (SHIP gate).
- Stale hand-file comments flagged not overwritten: enemyTypes
  SQUASH_KICK "~9%", LIMP comment, config duplicate RECOIL pair.
- LESSONS.md: **19 entries, 16 unharvested** — harvest genuinely
  overdue.

## 7. MEASURED facts (do not re-derive; MEASURED-at-HEAD wins over
this file — re-probe on contact)

- **Calibration event (2026-07-13)**: this file's fix-round-1 numbers
  did not match measurement at HEAD — strike hand was **−0.143** (file
  said −0.005), toe hover **0.053** (file said ~0.10). The probe
  harness was verified transform-by-transform against the code;
  constraints were re-anchored to the measured baseline. Treat every
  remembered number here the same way.
- **CRAWL_POSE at HEAD (all probe-measured 2026-07-12/13)**: PITCH
  1.35, WAIST −0.8, Y 0.02, ARM_REST 1.125, ELBOW 0.5, REACH_AMP 0.5,
  STRIDE_FREQ 5.2, ROLL 0.08, HIP_TRAIL 0.15, KNEE_TRAIL 0.25,
  DRAG_WIGGLE 0.06, HEAD_UP −0.1, WINDUP_COCK 2.2, TURN_MULT 0.125.
- **Sphinx pose measurements**: belly bottom +0.047 (was 0.258
  pre-waist), toes −0.011…0.037, head clearance +0.125 min across
  stances, rest hands +0.045 (planted), gait floor = rest plant BY
  CONSTRUCTION (one-sided lift; reach peak raises the hand to
  0.44–0.62), strike hand −0.235 (watch item), windup arm +0.365.
- **Face angle rule**: world head pitch = PITCH + WAIST + TILT +
  HEAD_UP = **0.30 rad** (the browser-approved read; derive HEAD_UP
  from it on any trunk retune).
- **Waist pivot**: y = bellyTop − 0.04 = **1.02** (proto_zombie);
  suite §15 mirrors this formula — keep them in lockstep.
- **Prone extent (waist split)**: parts below the pivot rotate by
  PITCH about the feet origin, above by PITCH + WAIST about the pivot;
  arm chain 2.17 m ≥ head chain 1.84 → CRAWL.WALL REACH+RADIUS 2.25
  covers it (§15 recomputes automatically). Face-on standoff = CELL/2
  + REACH + RADIUS (standing 1.8 m; prone 2.25 m).
- **Prone turn rule**: prone yaw pivots at the FEET with a ~2 m head
  lever — set turn rate by END-POINT sweep speed (~1.25 m/s matches
  the approved standing read), not angular rate.
- Facing: `rotation.y = atan2(dx,dz)` on +Z-built bodies; player fwd
  = (−sinY,−cosY); camera/gun −Z-forward; muzzle gun-local
  (0,0.03,−0.45).
- Prone transform math: world_y of local (y,z) at pitch θ =
  y·cosθ − z·sinθ; the head's forward jut (+Z 0.40) becomes a DOWNWARD
  jut prone — upper trunk (PITCH+WAIST) must stay ≲ 0.8 rad or the
  head buries (measured −0.201 at upper = 1.0).
- Window crossing cost = WINDOW_COST + 1. climbPose: k=0/1 exact walk
  rest; boundaries 0.25/0.65 continuous; peak y = sillH. collapsePose:
  k=0 exact walk rest, k=1 exact CRAWL_POSE rest (incl. waist).
- Village at HEAD: 11 windows (N (3,2)(7,2)(14,2)(17,2)(14,15)(17,15),
  E (9,4)(18,6), W (2,16), S (5,20)(16,20)); exterior 318; ring 65;
  walkable 387; house01 0/0/0. Layout rows: use two-line anchors.
- Spring f5 ζ0.4: kick→peak ≈ ×0.022, settle ~350 ms.
- Two-pass render: null scene.background on every pass after the first.
- Diagnostic: black scene + live HUD + no console errors = NaN
  transform OR render-path paint-over — if the GUN is visible, it's
  the latter.

## 8. Session hygiene for next session

Attach this file. **Open on Pass 10 (options round)** — read
RESEARCH_GENRE.md PART 2 (#1, #4) first for the design references.
Clone, fetch+reset, state the tip inline, run the suite — expect
**SUITE PASS, 28 modules, 336 asserts**. Probe before shipping pose
constants; MEASURED-at-HEAD beats this file. Checkpoint blocks end
with `git push`; docs checkpoints use SCOPED adds. Rewrite this
handoff at session end; flag the overdue harvest (16 entries).
