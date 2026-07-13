# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-12 — session 4 end. **Pass 7c (the Crawler) is BUILT,
suite-proven, and browser-tested through one fix round**; two feel items
remain and are RESOLVED BY DESIGN into the next pass (§0), which Daniel
already picked. This wrap ships as ONE checkpoint (code + docs) on top of
`d56e0c6`. History note (unchanged): 4.3b.2's code rides inside docs
commit `2ce0803`.

## 0. NEXT SESSION OPENS WITH — **pass 7c.2, Option 2 PICKED (cold start)**

No options round: Daniel chose **Option 2 — the waist joint ("sphinx")**
plus the crawl turn-rate fix. Build spec in §4. Then, in queue order
(Daniel may reorder):

- **Pass 10 — kill scoring** (research adoption): wave kills score,
  headshot bonus, CSS praise popup on the HUD layer. Options round.
- **Pass 7d — spawnable crawlers** (Daniel-requested 2026-07-12):
  promote the crawler to a first-class spawn path — `pickEntry` gains a
  typeId (window entries must refuse non-climbers), wave-table entry
  mixes gain a type dimension. Hook already shipped: `beginCrawl(rec,
  instant)` — `instant=true` spawns prone, no fall.
- DESIGN.md v3.1 — owes Stage 4 + 4.3 series + windows pass + pass 7c.
- **Dev-method harvest — OVERDUE: 16 unharvested LESSONS entries.**

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no downloaded
assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy, localStorage
  PB). Reload applies. NO map/nav/zombies: 4.3 and 7c provably inert.
- **Waves** — untimed last-stand in the village. Zombies navigate a flow
  field, climb windows (queued, congestion-priced), spawn from the fog
  ring + window entries — and now **transform**: 3 leg hits collapse a
  Shambler into a prone Crawler that keeps coming (§3).

`RESEARCH_PRIOR_ART.md`: prior-art → roadmap map. `DESIGN.md` v3.0
(v3.1 queued). No DevLog.

## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**; enemyTypes.js
  / waveTable.js / maps.js: registry additions as quote-the-anchor
  INSERTIONS (used twice this session — it works), full-replace needs a
  "tuned anything?" caveat.
- Feel reports: mechanism → single lever → surgical value. Bugs:
  reproduce/measure in Node before naming the mechanism.
- **Pose/rig constants are PROBE-MEASURED before shipping** (LESSONS
  #19): hand-trig on rotated boxes with child meshes lied by 0.3 m.
  Probe recipe lives in that entry.
- **Multi-edit plans get an end-state check against the PLAN** (LESSONS
  #18): every applied edit verified its landing, yet a planned edit
  silently never happened — capture shipped without its consumer.
- **Claude sync: `git fetch origin && git reset --hard origin/main`,
  never pull; verify tip + key docs.** Checkpoint blocks COPY-COMPLETE
  (end with `git push`); READ `git status` before add; docs-only
  checkpoints use SCOPED adds; never two checkpoint blocks in one
  message when sequencing matters.
- Run `node test_suite.mjs` before every delivery. `node --check` does
  no binding analysis; main.js can't be import-run — grep new
  identifiers' imports in DOM-coupled files. Render-path changes are
  SUITE-INVISIBLE — browser-first testing steps.

## 3. Current state

**PASS 7c — THE CRAWLER (this session, tested through fix round 1):**
- **Damage accounting**: leg chain (thighs/shins/feet) retagged `'leg'`
  (arms keep `'limb'`); `HITBOX.LEG 0.5 === LIMB` — accounting only,
  damage identical, double-fallback guarded. `legDmg` accumulates on the
  record; `CRAWL.LEG_HP 1.5` = exactly **3 leg hits** (suite-pinned).
- **Transition**: `beginCrawl(rec, instant)` — releases window waits,
  cancels attacks; mid-vault defers via `crawlPending` to the landing.
  The leg-out hit sprays double (`res.legsOut` in main's shot handler).
- **Collapse**: `collapsePose(k, rest)` pure, suite-pinned k=0 = exact
  walk rest, k=1 = exact `CRAWL_POSE` rest; 550 ms; rooted + hittable.
- **Prone state**: same attack/movement machinery, CRAWL numbers —
  stop ring 1.1, speed ×0.45, claw 400/150/400/1500; arms anchor on
  `CRAWL_POSE.ARM_REST`; windup = coiled claw (REAR_RAD 1.05 +
  `WINDUP_COCK` elbow fold ~1.6 rad — Daniel's green drawing).
- **Navigation**: main builds TWO fields per rebuild — the priced climb
  field + a **ground field** (`windowCost 0`, windows untraversable).
  Crawlers read the ground field: routes contain no windows BY
  CONSTRUCTION (suite: zero window steps, full coverage). `!crawling`
  belt on the vault trigger. Prone wall reach `CRAWL.WALL 2.0/0.25`.
- **Death from prone**: `dieFromPitch`/`dieFromY` captured at
  `startDeath` and CONSUMED by the fall — settles flat, no stand-up
  (fix round 1; the standing death is numerically identical to before).
- **Fix round 1 (browser-driven, probe-measured)**: `CRAWL_POSE` now
  PITCH 1.15 / Y 0.09 / ARM_REST 0.5 / PULL_AMP 0.2 / HEAD_UP −0.7 —
  head +0.008 above floor in all stances (was −0.30), pulling arm
  +0.015 (was −0.48), strike hands land at −0.005.
- **OPEN feel items → both resolved by 7c.2 (§4)**: (a) prone turning
  reads as a "clock hand" (shared TURN_RATE about the feet pivot);
  (b) rigid plank can't do "pelvis/legs down, chest/head up" — belly
  floats ~0.27 m.

**Unchanged from session 3**: 4.3 navigation complete (field, LOS
gating, turnToward, reach resolver, window climb+queue, grid-derived
spawning); 11 windows all faces; wave table with entry mixes; Shambler;
reload (provisional); atmosphere; world-sim freeze outside PLAYING.

## 4. NEXT BUILD PASS: **7c.2 — the sphinx rig + crawl turn rate (Option 2, PICKED)**

Goal: crawler silhouette = pelvis+legs FLAT on the floor, chest/head/
arms RAISED on the propping arms; prone turning reads heavy, not
mechanical. Two mechanisms:

**A. Waist joint (`enemyBody.js`)** — structural, standing-neutral:
- Add a `waist` Group pivoted at the belly/chest seam; re-parent chest,
  head (jaw/eyes ride along as existing children), armL, armR into it,
  positions re-expressed relative to the pivot (child.pos = old − pivot).
- Standing: `waist.rotation.x = 0` → world-identical body. **Suite §11's
  existing world-space pins (head jut/height, tag census, ground
  contact) PROVE the re-parent moved nothing — run before any prone
  work.** Add `waist` to the parts map.
- Prone: group pitch near-flat (~1.45–1.5 → pelvis/legs down) + waist
  counter-bend (~−0.5 → chest/head/arms rise). **DO NOT ship these
  numbers — probe them** (LESSONS #19 recipe): min world-y per part per
  stance (gait extremes, windup, strike, rest) + head clearance + chest
  height; grid-search like fix round 1.
- `collapsePose` gains a `waist` channel (0 at k=0 → `CRAWL_POSE.WAIST`
  at k=1; pins auto-track). Death from prone: capture `dieFromWaist`,
  relax to 0 through the fall so corpses lie flat (standing deaths:
  waist already 0 — identical). Vault/climbPose: waist stays 0,
  untouched.
- **§15's prone-extent invariant must gain the waist term** — a bent
  waist changes the forward-extent math (chest raised, head less
  forward); recompute the bound from the new pose chain, then re-check
  `CRAWL.WALL.REACH` (it may DROP below 2.0 — good, shrinks the
  standoff watch item).

**B. Crawl turn rate (`enemies.js`)** — one constant:
- Mechanism (named): 5 rad/s about the FEET pivot sweeps the prone head
  end (~1.9 m lever) at ~9 m/s — the clock hand.
- Fix: `turnToward(..., CONFIG.NAV.TURN_RATE * (crawling ?
  CRAWL_POSE.TURN_MULT : 1) * dtMs / 1000)` at the alive-path yaw write
  (the vault's own turn call is NOT a crawler — leave it). Recommend
  `TURN_MULT 0.4` (~2 rad/s: 90° in ~0.8 s), structural in CRAWL_POSE,
  promote to registry only on a feel report.

Testing: suite first (§11 re-parent pins + §15 recomputed extent), then
browser: silhouette vs Daniel's drawing, turning weight, collapse still
continuous, corpse flat, standing zombies pixel-identical, Range inert.

## 5. The suite — 28 modules, **330 asserts**, run before EVERYTHING

New this session: **§15 the Crawler** (leg routing + fallbacks, 3-hit
threshold arithmetic, claw pacing relative, collapsePose end-pins +
pitch monotonic, prone reach vs registry-derived extent, ground-field
zero-window-steps + coverage 386 = walkable−1); **§5 CRAWL_REQUIRED**
(14 conditional keys, fires only when the block exists, negative-tested
BY NAME — `structuredClone` + delete); **§11 tag census now four tiers**
(head/torso/limb/leg, 6+6 limb split). Village pins unchanged: windows
11, entry spots 11, exterior 318, walkable/flood 387, ring 65.

## 6. Open / outstanding / banked

- **7c.2 (§4 — cold start), pass 10, pass 7d, DESIGN v3.1, harvest** — §0.
- Reload scope (both modes) — still provisional.
- Watch items: prone face-on wall standoff 2.25 m (7c.2 likely shrinks
  it); trailing-toes hover ~0.10 m (7c.2's flatter pelvis likely
  removes it); arm-tips vs door jambs (standing, unreported).
- **Banked:** pass 8 audio (PannerNode + synthesized buffers); Stage 4b
  basement; Stage 5 environment rotation; itch.io deploy (SHIP gate).
- Stale hand-file comments flagged not overwritten: enemyTypes
  SQUASH_KICK "~9%", LIMP comment, config duplicate RECOIL pair.
- LESSONS.md: **19 entries, 16 unharvested** — harvest genuinely overdue.

## 7. MEASURED facts (do not re-derive)

- Facing: `rotation.y = atan2(dx,dz)` on +Z-built bodies; player fwd
  = (−sinY,−cosY); camera/gun −Z-forward; muzzle gun-local (0,0.03,−0.45).
- Prone transform math: world_y of local (y,z) at pitch θ =
  y·cosθ − z·sinθ; the head's FORWARD jut (+Z 0.40) becomes a DOWNWARD
  jut prone — why the rigid plank can't satisfy the sphinx ask (belly
  floats 0.27 m at PITCH 1.15; head −0.12 m if flattened).
- Prone probe results at PITCH 1.15/Y 0.09 (all stances): head +0.008,
  pull arm +0.015, strike hands −0.005, toes hover ~0.10. Prone forward
  extent bound: arm chain 2.15 m (arm can point straight world-forward:
  sin(PITCH+φ)=1 inside the swing range), head chain 1.79 —
  CRAWL.WALL REACH+RADIUS = 2.25 covers it (§15 recomputes from
  CRAWL_POSE.PITCH automatically).
- Face-on standoff = CELL/2 + REACH + RADIUS (standing 1.8 m; prone
  2.25 m). Proximity triggers must exceed it.
- Window crossing cost = WINDOW_COST + 1. climbPose: k=0/1 exact walk
  rest; boundaries 0.25/0.65 continuous; peak y = sillH. collapsePose:
  k=0 exact walk rest, k=1 exact CRAWL_POSE rest.
- Village at HEAD: 11 windows (N (3,2)(7,2)(14,2)(17,2)(14,15)(17,15),
  E (9,4)(18,6), W (2,16), S (5,20)(16,20)); exterior 318; ring 65;
  walkable 387; house01 0/0/0. Layout rows: use two-line anchors.
- Spring f5 ζ0.4: kick→peak ≈ ×0.022, settle ~350 ms.
- Two-pass render: null scene.background on every pass after the first.
- Diagnostic: black scene + live HUD + no console errors = NaN transform
  OR render-path paint-over — if the GUN is visible, it's the latter.

## 8. Session hygiene for next session

Attach this file. **Open directly on §4 (7c.2 — Option 2 is PICKED, no
options round)**; read LESSONS #18/#19 first. Clone, fetch+reset, state
the tip inline, run the suite — expect **SUITE PASS, 28 modules, 330
asserts**. Probe before shipping pose constants. Checkpoint blocks end
with `git push`; docs checkpoints use SCOPED adds. Rewrite this handoff
at session end; flag the overdue harvest (16 entries).
