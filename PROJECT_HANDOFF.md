# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-15 — session-7 END. **Pass 14** (exploder) and **pass 15**
(spitter) shipped, completing the archetype expansion (report #3). Suite
413 → **492**, 28 → **29 modules**. Tip at wrap: `1b4fe7c`.
**Read §6's first item before touching pass 15 code** — it arrived with
unexplained provenance and was adopted only after a full 16-pin bite-test.
History notes (unchanged): 4.3b.2's code rides inside docs commit
`2ce0803`; `e280d47` (pass 12) doesn't certify — the paste-in landed in
`62ac91f`.

## 0. ROADMAP (adopted 2026-07-13; ordering PROVISIONAL, Daniel
reorders by pass name; report refs = RESEARCH_GENRE.md PART 2)

**Next session opens with: Pass 16 options round (special reward round).**

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
- ~~Pass 13b~~ DONE: **arm-derived crawler strike ring** — the ring is
  `proneChainExtents(type).arm × RING_FRACTION` (0.85). Conscious §15
  pin move (the old "crawl ring ≤ standing ring" invariant retired).
- ~~Pass 13c~~ **DROPPED, not deferred** — see §6. Do not re-open
  without new evidence.
- ~~Pass 14~~ DONE: **exploder** — on-death two-band AoE, pulsing-eye
  tell, wave 7. See §3.
- ~~Pass 15~~ DONE: **spitter** — pooled ballistic globs on an arc, the
  game's first ranged threat, wave 8. See §3 and §6's provenance note.
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

**Named, banked, out of phase order (Daniel's, opened on request):**
- **Pass 14b — friendly-fire exploders.** Deferred from 14 BY DESIGN: an
  AoE that killed other zombies would bump `notifyKill()` while
  `scoreKill()` stayed back in `onHit` with the part context, so kills
  and score would visibly disagree. Needs its own scoring round.
- **Pass 14c — exploder blast FX.** Daniel picked this option and then
  re-queued it to follow the roadmap first. Agreed scope: reshape the
  burst (radial throw + acid colour + per-particle materials) PLUS a new
  pooled `blastFX.js` — a full-bright additive flash (~120 ms) and a
  ground shockwave ring expanding to exactly `EXPLODE.RADIUS` (~300 ms),
  unlit + `fog:false` like the eyes. The ring TEACHES the 3.5 m radius;
  that's why it beat the burst-only option. A pulsed `PointLight` (created
  at init with intensity 0 so lit materials compile once and never hitch)
  was considered and left for its own pass. See §7 for the mechanism.
- **Pass 15b — the spitter's acid pool** (ground denial, report #3C's
  actual intent). The hook is marked in `projectiles.js` at the ground
  retire (`if (y <= g.radius)`). Reuses `spawnPool`'s visual — pools
  already carry a material EACH, so the colour lever is free, and
  `poolPhase` owns the lifetime. The delicate number is the DoT tick rate
  against `PLAYER.MAX_HITS` 5.

**Long tail (unscheduled, gated):** traps [#7], perks [#9], buyable
doors [#12], mutators [#11], roguelite meta [#13], mystery box [#14 —
gate: ≥4–5 weapons], downed/second-wind [#15].
**Docs debt: DESIGN.md v3.1** (owes Stage 4 + 4.3 + windows + 7c + 7d +
10 + 12 + 13 + 13b + 14 + 15) — the standing docs-session candidate.

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no
downloaded assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy,
  localStorage PB). Reload applies. NO map/nav/zombies: 4.3/7c/waves
  systems provably inert.
- **Waves** — untimed last-stand in the village. Zombies navigate a
  flow field, climb windows (queued, congestion-priced), spawn from the
  fog ring + window entries in per-wave TYPE mixes (7d), scale in HP
  past wave 8 (12), come in **six archetypes** (13/14/15), transform (3
  leg hits → prone Crawler), pay registry bounties with headshot praise
  (10).

The six archetypes and the question each asks:

| type | debut | question |
|---|---|---|
| proto_zombie | 1 | baseline |
| crawler | 4 | low profile, can't climb |
| sprinter | 5 | pace |
| brute | 6 | attrition; breaks camping |
| exploder | 7 | WHERE you kill it |
| spitter | 8 | are you MOVING? |

Doc index: `RESEARCH_GENRE.md` (genre survey + candidate passes — the
roadmap source; §0 owns the adopted ordering and pass numbers).
`RESEARCH_PRIOR_ART.md` (session ≤3). `DESIGN.md` v3.0 (v3.1 queued).
`LESSONS.md` (29 entries). No DevLog.

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
- **When a registry block is too long to paste inline, ship it as a file
  named so it CANNOT be mistaken for the target** (`PASTE_INTO_<file>.js`,
  15). Confirm it never reaches the repo: `git ls-tree origin/main -r |
  grep -i PASTE_INTO` must return nothing.
- **RUN THE SUITE IN THE TREE YOU ARE COMMITTING.** Pass 13b was
  committed on the delivery message's expected count ("suite 401") and
  pushed RED. The gate worked; it was never run.
- **Multi-part deliveries state the changed-file count, and checkpoint
  blocks list the expected files as a comment** (LESSONS #20 — a
  skipped paste-in leaves nothing in `git status` to notice). Pass 15
  shipped as "7 files: 4 downloads + 3 paste-ins".
- **The `git status` READ catches ARRIVALS, not just deletions** (15) —
  see §6's provenance note. `git add .` is blind; the READ is what makes
  it safe.
- Feel reports: mechanism → single lever → surgical value. Bugs:
  reproduce/measure before naming the mechanism.
- Pose/rig constants are PROBE-MEASURED (LESSONS #19); handoff numbers
  are pointers — MEASURED-at-HEAD wins.
- Multi-edit plans get the end-state grep walk: WRITE and READ of every
  planned change (LESSONS #18). **When a brand-new suite pin fails,
  suspect the PIN first** (LESSONS #21). **And a new pin isn't done
  until you've broken the thing it guards and watched it go red**
  (2026-07-14) — this has now caught, across two sessions: three
  false-green pins, a NaN-passes-`>`-tolerance probe, a suite HANG on a
  zero divisor, and a registry comment that was simply false.
- **A bite harness is code**: unique anchors (sibling sections share
  pin wording — §19/§21/§22 all say "reachable through the real wave
  table"), a landing report per mutation, and a per-run `timeout`
  (a probe that derives its loop bound from the value under test will
  hang when the bite feeds it zero) — all 2026-07-15.
- **A counterfactual must be RUN, not computed** (2026-07-14): a
  behaviour change alters trajectories, so data sampled under build A
  cannot score build B.
- Claude sync: `git fetch origin && git reset --hard origin/main`;
  verify tip + key docs; **reconcile my tree against ORIGIN before
  theorising about a bug in Daniel's build** — the 13b wall bug was
  diagnosed backwards for a long stretch because my sandbox held a
  CORRECT 13b while origin held the botched one. Reading
  `git show origin/main:<file>` ended it in one command.
- Run `node test_suite.mjs` before every delivery; `node --check` has
  no binding analysis; ES modules also get an import-run; main.js is
  DOM-coupled — grep its new identifiers' imports. Render-path changes
  are SUITE-INVISIBLE — browser-first testing steps.

## 3. Current state (deltas this session; earlier systems unchanged)

- **Exploder (14)** — stat-only registry entry, no `scaleBody`, no probe
  cycle. `EXPLODE` is an OPTIONAL block on the CRAWL contract: no block,
  no blast. `blastDamage(type, dist)` is a PURE export from
  `enemies.js` (NOT at the call site — main.js is DOM-coupled and
  suite-invisible, so a model written there is certified by nothing).
  Two BANDS, not falloff: `damagePlayer()` takes integer hearts against
  `MAX_HITS` 5 and does no rounding, so a curve would render fractions or
  quantise invisibly. Fires on ANY death — no headshot defuse, because
  `HITBOX.HEAD` 3 one-shots `HP` 2 through the whole pre-ramp era, so a
  defuse rule hands every exploder to the skill the game already trains.
  Player-only (see 14b). Tell = **eye pulse**: `enemyBody.js` now returns
  `eyeMat` BY NAME (never by array index or by sniffing for the only
  material without `.emissive`); the pulse sits ABOVE every branch in
  `updateEnemies`, so it ticks while walking, vaulting, collapsing, and
  crawling. Raised cosine off ACCUMULATED `rec.t` (the 7a.7 integral
  rule). Two freebies fall out of existing code: a crippled exploder
  detonates at its CORPSE (0.393 m) not standing height (1.163 m) because
  pass 12's eruption anchor rides the LIVE waist; and a climber shot off
  a sill detonates OUTSIDE the wall, because `startDeath` teleports it
  back before the kill callback runs.
- **Spitter (15)** — the first thing in this game that REACHES you; every
  other threat is melee, so distance had always meant safety. New pooled
  module `src/render/projectiles.js` (the 29th suite module). `RANGED` is
  an OPTIONAL block on the same contract. The strike hook reuses the
  attack phase machine WHOLESALE — a RANGED type releases a glob at the
  same beat a clawing type lands damage, so the windup tell, the LOS
  gate, and the range gate are all inherited untouched (a spitter can no
  more lob through a wall corner than a shambler can swipe through one).
  `enemies.js` does NOT import `projectiles.js` — it fires
  `onRangedAttack(typeId, from)` up to main, same as its player damage and
  kills; main owns the camera, so main owns the aim.
  **Gated on `!crawling` deliberately**: prone, `AT` is already
  `CRAWL.ATTACK` (verified — `enemies.js` line ~842 `AT = crawling ?
  CR.ATTACK : type.ATTACK`, line ~846 `stopDist` switches to the crawl
  ring), so legging a spitter genuinely DISARMS the artillery and the
  crawl ring drags it into shotgun range. Contrast the exploder, whose
  threat is its TYPE and so survives the collapse.
- **`arcVelocity(from, to, flightMs, gravity)`** solves for a flight TIME,
  not a launch speed. Speed-based has two solutions and NO real solution
  when out of range — a spitter would silently decline to fire and you'd
  find that in a play session. Time-based always has exactly one answer,
  and it's the lever the player reads.
- **Registry-first held all session.** Both archetypes are data entries;
  the only structural code is the pure `blastDamage`, the pure
  `arcVelocity`/`flightMsFor`, one `eyeMat` return field, one strike-hook
  branch, and one new pooled module.

## 4. NEXT BUILD PASS: **Pass 16 — special reward round (OPTIONS ROUND)**

Report #2: a hound round + Max Ammo pulse every N rounds. Real questions
for the round: what the special round IS (a distinct enemy? a modified
wave? both?); the reward's shape (Max Ammo pulse is named, but nothing
consumes a "pickup" concept yet — check whether this needs machinery
without a consumer, and if so, cut it); cadence (every N rounds — a
`waveTable` field or a config constant?); and whether the hound is a new
registry archetype (cheap, given six exist) or a wave-composition trick.
Probe any body change (LESSONS #19); bite-test every new pin.

**Alternatively, Daniel has 14c queued and pre-scoped** (§0) — it's the
smaller pass and the ring teaches a radius the game currently doesn't
explain. His call.

## 5. The suite — 29 modules, **492 asserts**, run before EVERYTHING

New this session:
- **§21 — the Exploder (~40 asserts)**: band math exact and INCLUSIVE at
  both boundaries; 0 for a type with no EXPLODE block and for `undefined`;
  a monotonic-non-rising sweep; the design window (`RADIUS` 3.5 > the
  standing attack gate 2.5, AND ≤ `NAV.BEELINE_DIST` 4 — that PAIR is the
  whole archetype); `CORE_DAMAGE` < `MAX_HITS`; the particle budget fits
  the pool; `PULSE_HZ > 0`; the debut is reachable through the real wave
  table and the LAST row carries it (EXTEND). Tell + freebie are driven
  through the LIVE update loop: eye throb by identity (widest-channel
  parametric), a non-exploder control proving the guard, a genuinely prone
  crippled exploder that still ticks and still detonates as an exploder.
- **§22 — the Spitter (~39 asserts)**: ballistics (XZ lands within one
  tick's travel; Y arrives within Euler's own drift; a dead-on shot lands
  inside the hit cylinder); both /0 guards; the design window (never
  beelines, outranges every melee type, visible inside `FOG.WAVES.FAR`,
  `LIFE_MS` outlasts the flight, a moving player clears the glob); the
  debut share PRODUCES a spitter through the real rounding; and the
  behavioural set — a stationary player is hit, one who stepped aside is
  not, a type with no RANGED block can't throw, a spitter at its post
  fires, a shambler never fires the hook **and still claws normally**
  (the harness proof), and a LEGGED spitter never spits again **but still
  drags into claw range and bites** (proving the 0 isn't inertness).
- **§5**: extended with the `EXPLODE` and `RANGED` optional-block schemas,
  each mirroring the CRAWL contract with a negative test that must NAME a
  deleted key.

**Every new pin in both sections is BITE-TESTED** — 9 for §21, 16 for §22,
all fire. Two §21 pins were false greens caught this way (see LESSONS
2026-07-15), and the §22 bites are what surfaced the float-noise tie-break
and the two wrong tunable comments in §6.

## 6. Open / outstanding / banked

- **Pass 15's provenance is UNEXPLAINED — read this before touching it.**
  Mid-session, after the sandbox was synced clean to `0a4e37f` and only
  read from, `git status` showed a complete uncommitted pass 15
  implementation (6 modified files + untracked `projectiles.js` + suite
  §22), passing at 29 modules. It was in neither HEAD nor origin nor the
  session transcript. Neither Claude nor Daniel can account for it.
  **It was NOT trusted on its green suite.** On Daniel's explicit call it
  was adopted only after the full gate set: line-by-line read, end-state
  grep walk, ES-module import gate, and a bite-test of all 16 new pins.
  That review found and fixed three wrong comments (below). The code is
  verified; the mystery is not solved. If anything about pass 15 ever
  behaves oddly, start here.
- **Three comment errors found by that review and FIXED** (code was always
  correct; the comments lied): (a) `spitter.ATTACK.COOLDOWN_MS` was
  annotated "~3.3 s between shots" — `enemies.js` sets `cooldownT` at the
  WINDUP, so it's start-to-start and the true period is **2.6 s flat**;
  3.3 was `2600 + WINDUP_MS` double-counted. (b) `config.js`'s
  `PROJECTILES.MAX` rationale inherited the same wrong figure. (c) the
  wave-8 row claimed "a 0.05 share would have been 0.4 and quietly floored
  to none" — false; it wins the remainder tie on float noise. See §7.
- **Pass 13c — DROPPED ON THE EVIDENCE, do not re-open blind.** The
  proposal was to gate the crawl attack on the ARM extent (2.171)
  instead of the stop ring (1.845), on a claim that crowds park crawlers
  outside the gate "clawing at nothing". That claim was a measurement
  error (LESSONS 2026-07-14 #3). Measured properly by control-difference:
  **every crawler deals damage under the current gate** (11/10/11 hits vs
  14/14/15 under the arm gate) — 13c was a ~34% difficulty increase
  wearing a bug-fix costume. If crawler difficulty is ever wanted,
  **`CRAWL.ATTACK.RANGE_SLACK` is the honest lever**, with its own round.
- **Known limitation (15, not a bug today):** globs don't collide with
  walls. In practice they can't pass through one — the spitter only fires
  with LOS and the glob travels the same XZ line — but a glob arcing OVER
  an obstacle isn't modelled. Colliders are 2D AABBs with no height, so
  there is nothing to arc over yet. This becomes a real bug the day walls
  gain height.
- **Watch items (feel — levers named, Daniel's call):** brute crawl
  strike slam scales −0.235 → ~−0.29 (lever `CRAWL.ATTACK.THRUST_RAD`);
  attack-start pop at `REACH_AMP` 0.5 (fix = blend windup start from
  current arm pose, its own round); yaw spring escalation; sprinter gait
  read at 2.4 m/s (levers `ANIM.LEAN` / `LIMP` / `BOB_AMP`); brute vs
  door jambs (longer arms now).
- **Untested risk:** the prone standoff is 2.25 but a grid cell is 1.6,
  so 1-cell gaps (doors, alleys) are marginal for prone bodies — a
  possible indoor failure, never exercised.
- **Cosmetic, pre-existing, deliberately not fixed** (flagged twice, kept
  out of scope): `enemyTypes.js` carries a **duplicate `SPAWN` key** in
  the `crawler` entry (~lines 160/164) — identical values, second wins,
  harmless. Free cleanup for a docs pass.
- Balance to watch as Daniel plays: the six-way type mix at waves 7–8+,
  HP, bounties and debut waves (registry, his); HP ramp feel at 9–15;
  whether ONE spitter reads as a rhythm and THREE as a crossfire.
- Reload scope (both modes) — still provisional. Other stale hand-file
  comments (enemyTypes `SQUASH_KICK` "~9%", LIMP comment, config
  duplicate RECOIL pair; config's WAVES_SCORE block sits flush-left).
- **Banked:** pass 8 audio (oscillator cues arrive piecemeal with
  Phase 2/3 passes — fold into pass 8 when opened); Stage 4b basement;
  Stage 5 environment rotation; itch.io deploy (SHIP gate).
- **LESSONS.md: 29 entries — 21 harvested (`307946e`), 8 NEW and
  unharvested** (3 from 2026-07-14, 5 from 2026-07-15). All route to the
  dev-method. The 07-15 five: the NaN-passes-tolerance probe; the suite
  HANG on a zero divisor; the bite harness that tested the wrong pin; the
  registry comment falsified by float noise; and the unaccounted-for code
  in the tree. **A harvest session is overdue** — it closes with the
  marking hand-off (`[HARVESTED — <date>]` on each promoted heading) plus
  a ready commit block.

## 7. MEASURED facts (MEASURED-at-HEAD wins over this file)

**Exploder (14):**
- Bands: `RADIUS` 3.5 / `CORE_RADIUS` 1.8 / `DAMAGE` 1 / `CORE_DAMAGE` 2.
  Both boundaries INCLUSIVE (`dist === CORE_RADIUS` is core; `dist ===
  RADIUS` still bites) — pinned exactly, so a tune can't drift them
  silently.
- The design window IS the archetype: `RADIUS` 3.5 > standing attack gate
  2.5 (if it can claw you it can blast you) AND ≤ `NAV.BEELINE_DIST` 4
  (a safe kill range always exists). Break either half and it's a
  non-event or unfair.
- Blast anchor measured: prone **0.393 m** vs standing **1.163 m** — the
  crippled-exploder freebie, free from pass 12's live-waist anchor.
- Particle budget: `MAX_PARTICLES` 64 − `KILL_PARTICLES` 22 = 42 of
  headroom; `EXPLODE.PARTICLES` 30 fits with room for a hit spray.
- The eyes are the ONLY fog-free material on a body (`MeshBasicMaterial`,
  `fog: false`) — body emissive is swallowed by `FOG.WAVES.FAR` 13, and
  `group.scale` belongs to the squash spring (3 write sites). That is why
  the tell is the eyes and nothing else. Hues now all taken: amber
  (proto/crawler/brute), orange (sprinter), acid green (exploder), violet
  (spitter). **A 7th archetype needs a new tell axis, not a new hue.**

**Spitter (15):**
- `STOP_DISTANCE` **9** — outside every melee ring (max 2) and outside
  `NAV.BEELINE_DIST` 4, so it never beelines and never closes; inside
  `FOG.WAVES.FAR` 13, so it's visible at its post.
- `GLOB_SPEED` 8 is the design as a number: flight = 9/8 = **1.125 s**,
  and `PLAYER.MOVE_SPEED` 4.5 covers **5.06 m** in that window against a
  **0.43 m** hit radius (`GLOB_RADIUS` 0.13 + `BODY_RADIUS` 0.3). **It
  cannot hit a moving player.** It hits you reloading, cornered, or
  camping. That is the archetype, stated as a number — retune with care.
- Fire period = `ATTACK.COOLDOWN_MS` **2600 ms flat** (start-to-start;
  `cooldownT` is set at the WINDUP, so the 700 ms windup is INSIDE it,
  not added). Phases 700 + 150 + 500 = 1350 < 2600. At most **one glob
  airborne per spitter** (1.13 s flight / 2.6 s period).
- Hit model: XZ distance ≤ `GLOB_RADIUS + PLAYER.BODY_RADIUS`, with the
  column from `y = 0` to `y = playerPos.y` — the CAMERA's own height, not
  a `PLAYER.HEIGHT` constant, because there isn't one and inventing a
  tunable that must silently agree with the camera is how two sources of
  truth start disagreeing. No tunnelling at these speeds (~0.13 m/frame
  horizontal vs a 0.43 m radius).

**Wave-table rounding — a real trap:**
- Largest-remainder resolves exact ties **on float noise**. At the wave-8
  shares, `0.05 × 8 − 0 = 0.40000000000000002220` BEATS `0.425 × 8 − 3 =
  0.39999999999999991118`. So a sub-`1/count` share survives or vanishes
  by luck.
- **`share × count ≥ 1.0` wins a FLOOR slot and never touches the
  tie-break.** That is why spitter is 0.125 at count 8 (= exactly 1.0).
  **Do not tune a debut share below `1/count`** without re-checking §22's
  rounding pin — and note that pin only fires when the share loses EVERY
  tie (it passes at 0.05, fails at 0.01).

**Carried forward (unchanged):**
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
  player is held at **1.95** / **2.51** — necessarily greater than the
  stop ring. **A crawler can never reach its stop ring against a wall —
  only RANGE_SLACK bridges the gap.** Margins: 0.30 / 0.21.
- **Attack range is ABSTRACT in this project, not geometric:** a
  STANDING zombie's body reaches **0.916 m** forward from its origin
  but attacks from up to 2.5 m — hands 1.08–1.58 m short. Do not "fix" a
  gate by deriving it from where the claw lands.
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
  JSON key order is NOT canonical — sort before comparing (LESSONS #21).
- Facing/prone transform/window/village/spring/render-diagnostic facts:
  unchanged (rotation.y = atan2(dx,dz); world_y = y·cosθ − z·sinθ; head
  jut buries past upper-trunk ~0.8; window cost WINDOW_COST + 1;
  village 11 windows / exterior 318 / ring 65 / walkable 387; spring f5
  ζ0.4 kick ×0.022 settle ~350 ms; two-pass render nulls background
  after first; black scene + live HUD + visible gun = paint-over).

## 8. Session hygiene for next session

Attach this file. **Open on Pass 16 (options round — special reward
round)**; read RESEARCH_GENRE.md PART 2 #2 and §4 above first. Daniel may
prefer **14c** (pre-scoped in §0) — ask, don't assume. Clone, fetch+reset,
state the tip inline (`1b4fe7c`), run the suite — expect **SUITE PASS, 29
modules, 492 asserts**.

Do not re-open pass 13c (§6 says why). **Read §6's pass-15 provenance note
before touching `projectiles.js`, `enemies.js`'s strike hook, or §22.**
Probe any body change (LESSONS #19); suspect new pins before code
(LESSONS #21); bite-test every new pin before delivering it, with unique
anchors, landing reports, and a per-run timeout (2026-07-15); multi-part
deliveries state the file count and checkpoints list expected files
(LESSONS #20); run the suite in the tree being committed; verify no
`PASTE_INTO_*` file reached the repo. Docs checkpoints use SCOPED adds.
Rewrite this handoff at session end. **DESIGN.md v3.1 and a LESSONS
harvest (8 entries waiting) are both overdue** — either is a good docs
session.
