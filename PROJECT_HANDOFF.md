# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-13 — session-5 END. A long, productive session: the
Crawler finished (7c.2 sphinx rig, 7c.3 crawl feel), the **genre
deep-research pass** landed in-repo (`RESEARCH_GENRE.md`) and became the
adopted roadmap, and three roadmap passes shipped — **pass 10** (kill
scoring + praise popup), **pass 7d** (spawnable crawlers), **pass 12**
(wave HP scaling + the kill-eruption anchor fix). Suite 330 → **366**.
Tip at wrap: `62ac91f` (pass 12 + a follow-up waveTable commit; the
intermediate `e280d47` predates the paste-in and doesn't certify —
known, recorded as LESSONS #20, resolved). History note (unchanged):
4.3b.2's code rides inside docs commit `2ce0803`.

## 0. ROADMAP (adopted 2026-07-13; renumbered at session-5 end after
pass 12 took the HP-scaling slot — ordering PROVISIONAL, Daniel
reorders by pass name; report refs = RESEARCH_GENRE.md PART 2)

**Next session opens with: Pass 13 options round (sprinter + brute).**

**Phase 1 — scoring & economy keystone: DONE (this session)**
- ~~Pass 10~~ DONE: kill scoring + praise popup (registry bounties
  `SCORE.KILL`, headshot ×2 via `CONFIG.WAVES_SCORE.HEADSHOT_MULT`,
  generic HUD praise, score on HUD + game-over).
- ~~Pass 11~~ ABSORBED: pass 10 took the registry/HUD half; the wallet
  half (spendable balance vs lifetime score, `spendPoints`) lands with
  its first consumer in Pass 19 — no wallet without a shop.

**Phase 2 — challenge: enemy variety** [priority: challenging game]
- ~~Pass 7d~~ DONE: spawnable crawlers — wave-table `types` share maps
  (largest-remainder rounding in `typeAssignments`), window/climber
  pairing repair (`pairSpawns`, prone spawners demote gracefully),
  `crawler` registry entry derived by spread (`SPAWN.PRONE` →
  `beginCrawl(instant)`), enters wave 4.
- ~~Pass 12~~ DONE: wave HP scaling — `hpMultAt(n)`: 1.0 through
  `WAVES.HP.RAMP_START` 8 (the one-shot era is a chosen constant),
  +`STEP` 0.15/wave to `CAP` 2.0; bounty scales with the multiplier;
  LEG_HP deliberately unscaled (cheap crippling late = counterplay).
  Rider: kill eruption anchored to real chest height (floating-spatter
  fix).
- **Pass 13 — sprinter + brute** [report #3A]: registry stat/scale
  variants (speed/HP/scale + tint). First pass to exercise per-type
  tuning against the HP ramp.
- **Pass 14 — exploder** [report #3B]: on-death AoE, reuses bloodFX;
  leg-crippling an exploder into a ticking crawler comes free.
- **Pass 15 — spitter** [report #3C]: ranged arc projectile.
- **Pass 16 — special reward round** [report #2]: hound round + Max
  Ammo pulse every N rounds.

**Phase 3 — weapon variety** [priority: Daniel's explicit ask]
- **Pass 17 — weaponTypes.js registry + switching** (second weapon
  proves it). Prereq for all below.
- **Pass 18 — weapon roster expansion** (shotgun spread, SMG…).
- **Pass 19 — wall-buys + THE WALLET** [report #5 + absorbed pass 11]:
  buy-spot registry, chalk-outline CanvasTexture panels, spendable
  balance split from lifetime score, `spendPoints` API.
- **Pass 20 — upgrade station** [report #6].

**Phase 4 — score feel & challenge modulation**
- **Pass 21 — combo/style meter** [report #4] (the praise popup is its
  seed — `showPraise` is already generic).
- **Pass 22 — intensity spawn modulator** [report #10].
- **Pass 23 — window-boarding repair economy** [report #8].

**Long tail (unscheduled, gated):** traps [#7], perks [#9], buyable
doors [#12], mutators [#11], roguelite meta [#13], mystery box [#14 —
gate: ≥4–5 weapons], downed/second-wind [#15]. Docs debt: DESIGN.md
v3.1 (owes Stage 4 + 4.3 + windows + 7c + this session's passes);
**dev-method harvest — OVERDUE: 21 LESSONS entries, 18 unharvested.**

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no
downloaded assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy,
  localStorage PB). Reload applies. NO map/nav/zombies: 4.3/7c/waves
  systems provably inert.
- **Waves** — untimed last-stand in the village. Zombies navigate a
  flow field, climb windows (queued, congestion-priced), spawn from the
  fog ring + window entries in per-wave TYPE mixes (7d), scale in HP
  past wave 8 (12), transform (3 leg hits → prone Crawler), pay
  registry bounties with headshot praise (10).

Doc index: `RESEARCH_GENRE.md` (genre survey + candidate passes — the
roadmap source; §0 owns the adopted ordering and pass numbers).
`RESEARCH_PRIOR_ART.md` (session ≤3). `DESIGN.md` v3.0 (v3.1 queued).
`LESSONS.md` (21 entries). No DevLog.

## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**;
  enemyTypes.js / waveTable.js / maps.js: registry additions as
  quote-the-anchor INSERTIONS, full-replace needs a "tuned anything?"
  caveat.
- **Multi-part deliveries (downloads + paste-ins) state the changed-file
  count, and checkpoint blocks list the expected files as a comment**
  (LESSONS #20 — a skipped paste-in leaves nothing in `git status` to
  notice).
- Feel reports: mechanism → single lever → surgical value. Bugs:
  reproduce/measure before naming the mechanism.
- Pose/rig constants are PROBE-MEASURED (LESSONS #19); handoff numbers
  are pointers — MEASURED-at-HEAD wins (7c.2 calibration, §7).
- Multi-edit plans get the end-state grep walk: WRITE and READ of every
  planned change (LESSONS #18). **When a brand-new suite pin fails,
  suspect the PIN first** (LESSONS #21: key-order stringify; default
  params substitute on `undefined` — test guards with `null`).
- Claude sync: `git fetch origin && git reset --hard origin/main`;
  verify tip + key docs; reconcile my base against origin before
  building a pass on top (pass 7d caught a config divergence this way —
  Daniel's pushed file wins for hand-tuned files).
- Run `node test_suite.mjs` before every delivery; `node --check` has
  no binding analysis; ES modules also get an import-run; main.js is
  DOM-coupled — grep its new identifiers' imports. Render-path changes
  are SUITE-INVISIBLE — browser-first testing steps.

## 3. Current state (deltas this session; session ≤4 systems unchanged)

- **Scoring (10)**: `SCORE.KILL` per registry type (proto 100, crawler
  125); `scoreKill({value, part})` in waves.js is the SINGLE write
  site (headshot ×`WAVES_SCORE.HEADSHOT_MULT`); `damageEnemy` returns
  `value` (killed only, `Math.round(KILL × rec.hpMult)`); HUD
  `SCORE n` in the waves block, `showPraise(text)` generic popup
  (CSS `.pop` restart trick), game-over Score row.
- **Type dimension (7d)**: table rows carry `types` shares;
  `typeAssignments` (largest remainder — sums exactly at any count);
  `pairSpawns` repair (window slots hold climbers, else demote);
  `canWindow = !SPAWN.PRONE`; `pickEntry(kind, typeId)` derives the
  window standoff from the ACTUAL type. `crawler` entry: spread-derived,
  HP 2, KILL 125, dried-blood cloth 0x4a3038, `SPAWN.PRONE` →
  spawn-time `beginCrawl(rec, true)` + `legDmg` preloaded to threshold.
- **HP scaling (12)**: `hpMultAt(n, hpCfg = WAVES.HP)` pure +
  injectable; spec → pendingSpawns → spawn opts → `rec.hp = HP × mult`,
  `rec.hpMult` remembered for the bounty. `WAVES.HP { RAMP_START 8,
  STEP 0.15, CAP 2.0 }`. LEG_HP unscaled BY DESIGN.
- **Eruption anchor (12 rider)**: death passes waist world y + 0.15 as
  `pos.y`; main guards `pos.y ?? 1.1`. Prone corpses erupt at the
  corpse.
- **The Crawler (7c.2/7c.3)**: sphinx waist rig (standing-neutral to
  1e-9), probe-measured pose, reach-and-pull one-sided gait on its own
  stride, prone turn at head-end sweep speed. Browser-approved.

## 4. NEXT BUILD PASS: **Pass 13 — sprinter + brute (OPTIONS ROUND)**

Two registry archetypes (report #3A). Real design questions for the
round: the sprinter vs `EXTEND.SPEED_CAP` 1.4 (a sprinter type wants
its own WALK_SPEED, not a mult past the cap); brute scale vs the
window system (a scaled-up body may not FIT a window — decide
climb-capable or perimeter-only via the existing `SPAWN.PRONE`-style
pairing, maybe a general `NO_CLIMB` flag); both vs the HP ramp
(per-type HP × wave mult compounds — pick base HPs against wave-9+
breakpoints); bounties per archetype. Body probe: scale changes may
need §11-style pins re-derived — probe before shipping (LESSONS #19).

## 5. The suite — 28 modules, **366 asserts**, run before EVERYTHING

New this session: **§16** kill scoring (scoreKill math relative to
registry+config, reset semantics); **§17** spawnable crawlers
(largest-remainder rounding, pairing invariants incl. multiset
preservation + demote, table/EXTEND type plumbing, crawler structural
contract); **§18** HP scaling (ramp math, injectable guard via `null`,
waveSpec plumbing, and the TYING pin: heads one-shot EVERY type through
the whole pre-ramp era — moves consciously or not at all). §5 schema
now requires `SCORE.KILL` and sweeps the crawler entry automatically.

## 6. Open / outstanding / banked

- **Watch items (feel — levers named, Daniel's call):** strike slam
  depth −0.235 (lever `CRAWL.ATTACK.THRUST_RAD`); attack-start pop at
  `REACH_AMP` 0.5 (fix = blend windup start from current arm pose, its
  own round); yaw spring escalation if prone turning still reads as
  snapping (mechanism would be constant-rate onset; `secondOrder.js`).
- RESOLVED this session: floating kill-blood (12 rider); toes hover;
  standoff prediction (stays 2.25, extent 2.17).
- Balance to watch as Daniel plays: crawler share/HP/bounty (registry,
  his); HP ramp feel at waves 9–15 (`WAVES.HP`, his); crawler wave-4
  debut timing.
- Reload scope (both modes) — still provisional. Arm-tips vs door
  jambs (standing, unreported). Stale hand-file comments (enemyTypes
  SQUASH_KICK "~9%", LIMP comment, config duplicate RECOIL pair; also
  config's WAVES_SCORE block sits flush-left — cosmetic, Daniel's).
- **Banked:** pass 8 audio (oscillator cues arrive piecemeal with
  Phase 2/3 passes — fold into pass 8 when opened); Stage 4b basement;
  Stage 5 environment rotation; itch.io deploy (SHIP gate).
- LESSONS.md: **21 entries, 18 unharvested — harvest seriously
  overdue; consider a dedicated docs session.**

## 7. MEASURED facts (MEASURED-at-HEAD wins over this file)

- Calibration event (2026-07-13): fix-round-1 numbers in the prior
  handoff were off by up to 0.14 m vs measurement at HEAD; probe
  harness verified transform-by-transform, constraints re-anchored.
  Treat every number here the same way.
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
- Prone extent (waist split): arm chain 2.17 ≥ head chain 1.84 →
  REACH+RADIUS 2.25 covers (§15 auto-recomputes). Standoffs: standing
  1.8, prone 2.25.
- Prone turn rule: match END-POINT sweep (~1.25 m/s), not angular rate.
- Kill eruption anchor: waist world y + 0.15; `pos.y ?? 1.1` fallback.
- Bounty: `Math.round(SCORE.KILL × hpMult)`, headshot ×HEADSHOT_MULT on
  top (applied in scoreKill, not in the bounty).
- Wave math: `hpMultAt` = min(CAP, 1 + STEP·max(0, n − RAMP_START));
  largest-remainder type rounding (floors, then highest remainders);
  JSON key order is NOT canonical — sort before comparing (LESSONS #21).
- Facing/prone transform/window/village/spring/render-diagnostic facts:
  unchanged from session-4 (§7 of `089452c`'s handoff if ever needed;
  the live ones: rotation.y = atan2(dx,dz); world_y = y·cosθ − z·sinθ;
  head jut buries past upper-trunk ~0.8; window cost WINDOW_COST + 1;
  village 11 windows / exterior 318 / ring 65 / walkable 387; spring f5
  ζ0.4 kick ×0.022 settle ~350 ms; two-pass render nulls background
  after first; black scene + live HUD + visible gun = paint-over).

## 8. Session hygiene for next session

Attach this file. **Open on Pass 13 (options round — sprinter +
brute)**; read RESEARCH_GENRE.md PART 2 #3 and §4 above first. Clone,
fetch+reset, state the tip inline, run the suite — expect **SUITE
PASS, 28 modules, 366 asserts**. Registry archetypes: probe any body
scale change (LESSONS #19); suspect new pins before code (LESSONS
#21); multi-part deliveries state the file count and checkpoints list
expected files (LESSONS #20). Docs checkpoints use SCOPED adds.
Rewrite this handoff at session end; the harvest (18 unharvested) is
the standing docs-session candidate.
