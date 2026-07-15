# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-14 — session-6 END. **Pass 13** (sprinter + brute) and
**pass 13b** (arm-derived crawler strike ring) shipped; then a reported
wall bug turned out to be a **botched 13b paste that had shipped a RED
suite to origin**, repaired in its own commit; the session closed by
pinning the invariant it broke. A proposed **pass 13c was built,
measured, and DROPPED on the evidence** — the premise was a
measurement error (LESSONS 2026-07-14 #3). Suite 366 → **413**.
Tip at wrap: `56b04d4`. History notes (unchanged): 4.3b.2's code rides
inside docs commit `2ce0803`; `e280d47` (pass 12) doesn't certify — the
paste-in landed in `62ac91f`.

## 0. ROADMAP (adopted 2026-07-13; ordering PROVISIONAL, Daniel
reorders by pass name; report refs = RESEARCH_GENRE.md PART 2)

**Next session opens with: Pass 14 options round (exploder).**

**Phase 1 — scoring & economy keystone: DONE**
- ~~Pass 10~~ DONE: kill scoring + praise popup.
- ~~Pass 11~~ ABSORBED: the wallet half lands with its first consumer
  in Pass 19 — no wallet without a shop.

**Phase 2 — challenge: enemy variety** [priority: challenging game]
- ~~Pass 7d~~ DONE: spawnable crawlers (wave-table `types` shares,
  window/climber pairing repair, `crawler` entry, enters wave 4).
- ~~Pass 12~~ DONE: wave HP scaling (`hpMultAt`, ramp from wave 8,
  +0.15/wave, cap 2.0; LEG_HP deliberately unscaled).
- ~~Pass 13~~ DONE: **sprinter + brute** — stat/scale registry variants
  via `scaleBody`, `NO_CLIMB` routes brutes onto the ground field
  (perimeter-only), conscious §18 pin move exempting HEAVY types from
  the one-shot guarantee. Sprinter debuts wave 5, brute wave 6.
- ~~Pass 13b~~ DONE: **arm-derived crawler strike ring** — the crawl
  stop ring is now `proneChainExtents(type).arm × RING_FRACTION` (0.85)
  instead of a flat `STOP_DISTANCE`, because prone the hands lead the
  feet origin by ~2 m and an origin-based ring walked the body under
  the player before the claw fired. Conscious §15 pin move (the old
  "crawl ring ≤ standing ring" invariant retired for physical bounds).
- ~~Pass 13c~~ **DROPPED, not deferred** — see §6. Do not re-open
  without new evidence.
- **Pass 14 — exploder** [report #3B]: on-death AoE, reuses bloodFX;
  leg-crippling an exploder into a ticking crawler comes free.
- **Pass 15 — spitter** [report #3C]: ranged arc projectile.
- **Pass 16 — special reward round** [report #2]: hound round + Max
  Ammo pulse every N rounds.

**Phase 3 — weapon variety** [priority: Daniel's explicit ask]
- **Pass 17 — weaponTypes.js registry + switching** (second weapon
  proves it). Prereq for all below.
- **Pass 18 — weapon roster expansion** (shotgun spread, SMG…).
- **Pass 19 — wall-buys + THE WALLET** [report #5 + absorbed pass 11].
- **Pass 20 — upgrade station** [report #6].

**Phase 4 — score feel & challenge modulation**
- **Pass 21 — combo/style meter** [report #4] (`showPraise` is its seed).
- **Pass 22 — intensity spawn modulator** [report #10].
- **Pass 23 — window-boarding repair economy** [report #8].

**Long tail (unscheduled, gated):** traps [#7], perks [#9], buyable
doors [#12], mutators [#11], roguelite meta [#13], mystery box [#14 —
gate: ≥4–5 weapons], downed/second-wind [#15].
**Docs debt: DESIGN.md v3.1** (owes Stage 4 + 4.3 + windows + 7c + 7d +
10 + 12 + 13 + 13b) — the standing docs-session candidate. LESSONS
harvest is CURRENT (see §6).

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no
downloaded assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy,
  localStorage PB). Reload applies. NO map/nav/zombies: 4.3/7c/waves
  systems provably inert.
- **Waves** — untimed last-stand in the village. Zombies navigate a
  flow field, climb windows (queued, congestion-priced), spawn from the
  fog ring + window entries in per-wave TYPE mixes (7d), scale in HP
  past wave 8 (12), come in four archetypes (13), transform (3 leg hits
  → prone Crawler), pay registry bounties with headshot praise (10).

Doc index: `RESEARCH_GENRE.md` (genre survey + candidate passes — the
roadmap source; §0 owns the adopted ordering and pass numbers).
`RESEARCH_PRIOR_ART.md` (session ≤3). `DESIGN.md` v3.0 (v3.1 queued).
`LESSONS.md` (24 entries). No DevLog.

## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**;
  enemyTypes.js / waveTable.js / maps.js: registry additions as
  quote-the-anchor INSERTIONS, full-replace needs a "tuned anything?"
  caveat.
- **A paste-in's failure mode is landing in the WRONG BLOCK** — it
  parses, imports, greps clean, and shows up in `git status` exactly as
  expected (2026-07-14). When a registry paste is the fix for a bug
  CAUSED by a paste, deliver the full file instead.
- **RUN THE SUITE IN THE TREE YOU ARE COMMITTING.** Pass 13b was
  committed on the delivery message's expected count ("suite 401") and
  pushed RED. The gate worked; it was never run.
- **Multi-part deliveries state the changed-file count, and checkpoint
  blocks list the expected files as a comment** (LESSONS #20 — a
  skipped paste-in leaves nothing in `git status` to notice).
- Feel reports: mechanism → single lever → surgical value. Bugs:
  reproduce/measure before naming the mechanism.
- Pose/rig constants are PROBE-MEASURED (LESSONS #19); handoff numbers
  are pointers — MEASURED-at-HEAD wins.
- Multi-edit plans get the end-state grep walk: WRITE and READ of every
  planned change (LESSONS #18). **When a brand-new suite pin fails,
  suspect the PIN first** (LESSONS #21). **And a new pin isn't done
  until you've broken the thing it guards and watched it go red**
  (2026-07-14) — three false-green pins were written in one pass.
- **A counterfactual must be RUN, not computed** (2026-07-14): a
  behaviour change alters trajectories, so data sampled under build A
  cannot score build B.
- Claude sync: `git fetch origin && git reset --hard origin/main`;
  verify tip + key docs; **reconcile my tree against ORIGIN before
  theorising about a bug in Daniel's build** — the 13b wall bug was
  diagnosed backwards for a long stretch because my sandbox held a
  CORRECT 13b while origin held the botched one, so my repros kept
  disagreeing with his report. Reading `git show origin/main:<file>`
  ended it in one command.
- Run `node test_suite.mjs` before every delivery; `node --check` has
  no binding analysis; ES modules also get an import-run; main.js is
  DOM-coupled — grep its new identifiers' imports. Render-path changes
  are SUITE-INVISIBLE — browser-first testing steps.

## 3. Current state (deltas this session; earlier systems unchanged)

- **Archetypes (13)**: `scaleBody(base, k)` scales metric body fields
  and passes fractions/angles through, never mutating the base.
  `sprinter` (fast, own WALK_SPEED — not a mult past `EXTEND.SPEED_CAP`)
  debuts wave 5; `brute` (tanky, scaled body) debuts wave 6 and carries
  **`NO_CLIMB`**, which routes it onto the ground flow field
  (perimeter-only — a scaled body doesn't fit a window). Conscious §18
  pin move: HEAVY types are exempt from the pre-ramp one-shot
  guarantee. All four types are stat-only registry entries — no bespoke
  code.
- **Crawl strike ring (13b)**: `proneChainExtents(type)` is EXPORTED
  from `enemies.js` (mirrors `enemyBody.js`'s height stack; absolute
  overlaps −0.06/−0.08/−0.04 do NOT scale; `waistY = bellyTop − 0.04`;
  returns `{head, arm}`). `beginCrawl` computes
  `rec.crawlRing = proneChainExtents(type).arm × CRAWL.RING_FRACTION`
  once, at the single place a crawl begins (instant spawns and the fall
  path both route through it), with a double guard: a registry still
  carrying the old `STOP_DISTANCE` degrades to it, a CRAWL-less type to
  1.1. The stop-ring read site uses `rec.crawlRing ?? …`.
- **13b paste repair (`ae55ea4`)**: `RING_FRACTION` had landed inside
  the brute's `CRAWL.WALL` block; proto's `CRAWL` kept `STOP_DISTANCE:
  1.1`. Every crawler ran ring 1.1 → attack gate 1.5 → a wall-backed
  player took ZERO crawl damage, and origin's suite was RED. Repair =
  two hunks in `enemyTypes.js` only (`enemies.js`/`test_suite.mjs` were
  already correct 13b).
- **Wall-damage pins (`56b04d4`)**: §19 gained a per-type pin that the
  crawl gate reaches a wall-backed player; §20 is new and behavioural.
  No behaviour change — `enemies.js` untouched.

## 4. NEXT BUILD PASS: **Pass 14 — exploder (OPTIONS ROUND)**

On-death AoE (report #3B), reusing bloodFX. Real questions for the
round: damage model (radius + falloff vs flat-in-radius) and whether it
hurts other zombies; the tell (tint is already registry-driven — a
pulse or a swell needs a lever); whether the AoE fires on ANY death or
only on a non-headshot (a headshot "defusing" it is free counterplay);
and the freebie called out in the roadmap — leg-crippling an exploder
yields a ticking crawler with no extra wiring, so check it falls out of
the registry rather than building for it. Probe any body change
(LESSONS #19); bite-test every new pin (2026-07-14).

## 5. The suite — 28 modules, **413 asserts**, run before EVERYTHING

New/changed this session:
- **§19 — sprinter + brute (31 asserts)**: `scaleBody` semantics
  (metric fields scale, fractions/angles pass through, base unmutated,
  no key dropped); per-type prone chain extents; strike ring inside the
  arms and outside the body; table debut reachable through the real
  wave table. **Plus the wall pin**: `ring + RANGE_SLACK >= (WALL.REACH
  + WALL.RADIUS) − PLAYER.BODY_RADIUS` for every crawling type,
  reporting live margins (crawler **0.30**, brute **0.21**).
- **§20 — wall-backed crawl damage (8 asserts)**: drives the REAL loop
  (real colliders, real prone reach probe, real LOS, real attack gate)
  against a player pressed into a wall by the real resolver, and
  asserts damage LANDS. Every type is genuinely prone: only `crawler`
  has `SPAWN.PRONE`, so the others are crippled through the real path
  (`damageEnemy` on a leg mesh; shot count = `ceil(LEG_HP /
  partDamage(type,'leg'))`; `hpMult: 50` is a harness so the leg hits
  don't kill them first). Each type also gets an anti-false-coverage
  guard asserting it is NOT parked at its standing ring.
- **§15** (13b): the "crawl ring ≤ standing ring" pin was consciously
  retired — the ring is now a physical bound, and it calls the real
  `proneChainExtents` export rather than a duplicated formula.
- **§5**: the CRAWL schema requires `RING_FRACTION` (this is what went
  red on the botched paste).

**Both new pins are bite-tested** (restore after each): botched paste →
§20 fails "0 hits landed" on all four types; `RING_FRACTION` 0.85→0.70
→ §19 fails "margin −0.03" while §5 (key present) and §15 (valid
fraction) both pass it. Suite runtime ~400 ms.

## 6. Open / outstanding / banked

- **Pass 13c — DROPPED ON THE EVIDENCE, do not re-open blind.** The
  proposal was to gate the crawl attack on the ARM extent (2.171)
  instead of the stop ring (1.845), on my claim that crowds park
  crawlers outside the gate "clawing at nothing". That claim was a
  measurement error (LESSONS 2026-07-14 #3). Measured properly by
  control-difference: **every crawler deals damage under the current
  gate** (mixed pile 11/10/11 hits vs 14/14/15 under the arm gate) —
  the status quo is not broken, and 13c was a ~34% crawler difficulty
  increase wearing a bug-fix costume. If crawler difficulty is ever
  wanted, **`CRAWL.ATTACK.RANGE_SLACK` is the honest lever** and it
  needs its own options round with real numbers.
- **Watch items (feel — levers named, Daniel's call):** brute crawl
  strike slam scales −0.235 → ~−0.29 (lever `CRAWL.ATTACK.THRUST_RAD`);
  attack-start pop at `REACH_AMP` 0.5 (fix = blend windup start from
  current arm pose, its own round); yaw spring escalation; sprinter gait
  read at 2.4 m/s (levers `ANIM.LEAN` / `LIMP` / `BOB_AMP`); brute vs
  door jambs (longer arms now).
- **Untested risk:** the prone standoff is 2.25 but a grid cell is 1.6,
  so 1-cell gaps (doors, alleys) are marginal for prone bodies — a
  possible indoor failure, never exercised.
- Balance to watch as Daniel plays: sprinter/brute share, HP, bounty and
  debut waves (registry, his); HP ramp feel at waves 9–15.
- Reload scope (both modes) — still provisional. Stale hand-file
  comments (enemyTypes `SQUASH_KICK` "~9%", LIMP comment, config
  duplicate RECOIL pair; config's WAVES_SCORE block sits flush-left —
  cosmetic, Daniel's).
- **Banked:** pass 8 audio (oscillator cues arrive piecemeal with
  Phase 2/3 passes — fold into pass 8 when opened); Stage 4b basement;
  Stage 5 environment rotation; itch.io deploy (SHIP gate).
- **LESSONS.md: 24 entries — 21 harvested (`307946e`), 3 NEW and
  unharvested from 2026-07-14.** All three route to the dev-method: the
  wrong-block paste + red-suite commit, the three false-green pins, and
  the counterfactual measured on the wrong build.

## 7. MEASURED facts (MEASURED-at-HEAD wins over this file)

- **Prone chain extents (probe-measured, 13b):** proto/crawler/sprinter
  `{head 1.8419, arm 2.1709}`; brute `{head 2.3399, arm 2.7250}`.
  Brute standing extent measured **1.156** vs a naively-expected 1.264 —
  absolute overlap constants don't scale (LESSONS #19 confirmed).
- **Crawl rings (13b):** `arm × RING_FRACTION 0.85` → proto/crawler/
  sprinter **1.845**, brute **2.316**. Attack gate = ring +
  `RANGE_SLACK` 0.4 → **2.245** / **2.716**.
- **The wall geometry (why §19/§20 exist):** the anti-clip prone probe
  MUST hold a crawler's origin ≥ its arm extent off any faced wall
  (standoff = `WALL.REACH + WALL.RADIUS` = 2.25 proto / 2.81 brute);
  the player stands `PLAYER.BODY_RADIUS` 0.3 off it. So a wall-backed
  player is held at **1.95** (proto/crawler/sprinter) / **2.51**
  (brute) — which is NECESSARILY greater than the stop ring, because
  the standoff covers the arms and the ring sits inside them. **A
  crawler can never reach its stop ring against a wall — it crawls
  forever, and only RANGE_SLACK bridges the gap.** Margins: 0.30 / 0.21.
- **Attack range is ABSTRACT in this project, not geometric:** a
  STANDING zombie's body reaches **0.916 m** forward from its origin
  but it attacks from up to `STOP_DISTANCE 2` + `RANGE_SLACK 0.5` =
  2.5 m — hands 1.08–1.58 m short. Do not "fix" a gate by deriving it
  from where the claw lands; that convention doesn't exist here.
- The enemy update path has **no RNG** — sims are deterministic, which
  is what makes control-difference measurement valid.
- CRAWL_POSE at HEAD (probe-measured): PITCH 1.35, WAIST −0.8, Y 0.02,
  ARM_REST 1.125, ELBOW 0.5, REACH_AMP 0.5, STRIDE_FREQ 5.2, ROLL 0.08,
  HIP_TRAIL 0.15, KNEE_TRAIL 0.25, DRAG_WIGGLE 0.06, HEAD_UP −0.1,
  WINDUP_COCK 2.2, TURN_MULT 0.125.
- Sphinx measurements: belly +0.047; toes −0.011…0.037; head clearance
  +0.125 min; rest hands +0.045; gait floor = rest plant BY
  CONSTRUCTION (one-sided lift, reach peak 0.44–0.62); strike −0.235
  (watch); windup arm +0.365.
- Face angle rule: PITCH + WAIST + TILT + HEAD_UP = 0.30 rad.
- Waist pivot: bellyTop − 0.04 = 1.02; suite §15 mirrors the formula.
- Prone turn rule: match END-POINT sweep (~1.25 m/s), not angular rate.
- Kill eruption anchor: waist world y + 0.15; `pos.y ?? 1.1` fallback.
- Bounty: `Math.round(SCORE.KILL × hpMult)`, headshot ×HEADSHOT_MULT on
  top (applied in scoreKill, not in the bounty).
- Wave math: `hpMultAt` = min(CAP, 1 + STEP·max(0, n − RAMP_START));
  largest-remainder type rounding (floors, then highest remainders);
  JSON key order is NOT canonical — sort before comparing (LESSONS #21).
- Facing/prone transform/window/village/spring/render-diagnostic facts:
  unchanged (rotation.y = atan2(dx,dz); world_y = y·cosθ − z·sinθ; head
  jut buries past upper-trunk ~0.8; window cost WINDOW_COST + 1;
  village 11 windows / exterior 318 / ring 65 / walkable 387; spring f5
  ζ0.4 kick ×0.022 settle ~350 ms; two-pass render nulls background
  after first; black scene + live HUD + visible gun = paint-over).

## 8. Session hygiene for next session

Attach this file. **Open on Pass 14 (options round — exploder)**; read
RESEARCH_GENRE.md PART 2 #3B and §4 above first. Clone, fetch+reset,
state the tip inline, run the suite — expect **SUITE PASS, 28 modules,
413 asserts**. Do not re-open pass 13c (§6 says why). Probe any body
change (LESSONS #19); suspect new pins before code (LESSONS #21);
bite-test every new pin before delivering it (2026-07-14); multi-part
deliveries state the file count and checkpoints list expected files
(LESSONS #20); run the suite in the tree being committed. Docs
checkpoints use SCOPED adds. Rewrite this handoff at session end;
DESIGN.md v3.1 is the standing docs-session candidate, and three fresh
LESSONS entries are waiting for the next dev-method harvest.
