# PROJECT_HANDOFF — Zombie Shooter

**Version: session-10 END (2026-07-16).** Tip at write time: `c1d8913`
(Pass 17d.2 — ammo can). Suite: **34 modules, 839 asserts, 27 sections,
SUITE PASS.** This file is the source of truth for the next session; a
compaction or chat summary is a POINTER to it, never a substitute. Read it
and the code before any work. MEASURED-at-HEAD wins over anything here.

**Session 10 shipped:** 17b (ammo reserve + world pickups), 18 (SMG +
full-auto + leash fix), DESIGN.md v3.1 (catch-up sweep, passes 10–18),
19 (wallet + wall-buys + pistol start), 17d/17d.2 (drop dressing → the
reference-matched ammo can). Five LESSONS entries recorded (see §6).

## 0-a. SESSION-10 ADRs (newest first; prior sessions' log retained below)

**Pass 17d.2 — the ammo can (c1d8913).** Daniel supplied a reference photo;
the drop is eight boxes (portrait olive body, lid LIP at the top — a waist
band reads crate, a top lip reads can — wire handle, mirrored DIAGONAL RIBS
(the signature line), latch, two stencil-yellow strips inheriting the brass
band's says-AMMO job). Palette fully warm now, so MOTION + SILHOUETTE carry
the entire "not eyes" separation. §26 pins pool discipline DERIVED per child
(every corresponding child shares material+geometry; 3 materials / 6
geometries serve all 12 drops) so the pin survives the next reshape.

**Pass 19 — wallet + wall-buys (5351ea3).** Pistol-start; shotgun (1200) and
SMG (1750) sell off village walls as chalk panels (CanvasTexture, the
weapon's OWN PARTS side-projected); same panel sells ammo at ~half once
owned, filling the reserve to cap; full pile → "AMMO FULL", E charges
nothing. EARNED/BALANCE SPLIT: scoreKill stays the single earn site (pass
10's planned seam), spendPoints its mirror; HUD shows the purse, game-over
shows earned — spending never fines the scoreboard. Ownership in ammo.js
(STARTER seeds; ownWeapon grants full mag + seeded pile; swaps/cycle gate on
owned; `allOwned` and `unlimited` are SEPARATE flags both meaning Range —
fusing them would repeat input.js's requirement-welded-to-accident mistake).
buys.js is pure/injected (offerAt/tryBuy; charge-before-grant; recompute at
press position). CONSCIOUS SCAN SCOPE MOVE: src/data/ registries may name
weapon ids (data-to-data wiring, waveTable precedent); CODE stays fully in
scope, bitten both directions. Prices/era suite-pinned DERIVED from wave
table × bounties: income through wave 5 affords the cheapest wall, through
wave 3 does not, headshots buy a wave earlier. Panel PRICE deliberately NOT
baked into the texture (pass 20 may reprice; the HUD prompt is the living
label, 150 ms cadence, greys when poor).

**DESIGN.md v3.1 (6a69582).** Catch-up sweep, 14 passes of drift: Stage 4
(village) marked SHIPPED, roadmap now points at RESEARCH_GENRE.md, controls/
tree/open-questions regenerated from the artifacts. Correction on the record:
pass 7d SHIPPED long ago (3438d06) — an earlier queue answer called it
dormant from memory; the log disagreed.

**Pass 18 — the SMG (8a9696d + leash fix in 19's window).** The data-only
claim was FALSE in exactly one place: input.js hardcoded Digit1/Digit2 under
a comment promising it wasn't the file that would change. Fixed with a
generic slot regex AND made a guard: §24's data-only TEXT SCAN (no weapon id
or slot digit outside the registry — comments stripped first). Full-auto:
the trigger became held STATE (WASD's split), shooting.js's existing
cooldown IS the fire rate (800 RPM at any fps), AUTO is registry data,
fireOnce shared so the auto path inherits the whole canFire gate. isHeld
INJECTED like canFire → §26(j) drives the real fire path headlessly.
MAG_FRACTION → PICKUP_ROUNDS on the registry (measured: mag-tied drops
invert "spray drains" for any mag ≥ 15; SMG drop is 12 = the only gun a
pickup doesn't reload). Leash 13 → 24 after Daniel's feel report: 13 cut
Range's back two target rows dead; §7's impossible-not-expensive rationale
PREDATES the economy that now does the pricing (44 rounds/kill vs 2.4 earned
at the leash). §24 leash pins now mode-aware universal (≤ FOG.FAR) +
shotgun's own scoped ≤ FOG.WAVES.FAR statement + AUTO-weapons-cover-Range.
The SMG's design is ONE idea: SPREAD_DEG 2 is an ECONOMIC nerf (a gun that
can't find heads pays 3× per kill; §26 pins it on the losing side of the
drop window by construction). Triangle: aim → pistol; commit → shotgun;
panic → SMG (kills anything, bankrupts you).

**Pass 17b — ammo reserve + pickups (a3e436a).** Reloads TAKE from a finite
per-weapon pile (RESERVE_START/RESERVE_MAX on the registry, `?? Infinity` =
the MAX_RANGE absent-means-unlimited contract, §24-REQUIRED so the fallback
can't absorb a misplaced paste). Kill drops (20%) are WORLD PICKUPS planted
at the corpse's x/z (pos.y is the waist anchor — never honour it): the third
anti-camping instrument (brute pushes, spitter punishes, drops PULL). Grant
computed at COLLECT time for the ACTIVE weapon (bake it at the kill and the
swap-before-you-step-on-it decision dies); addReserve returns rounds landed
so a full pile leaves the drop ON THE FLOOR. Range seeds Infinity — no mode
branch in ammo.js ever, the unlimited case falls out of the finite
arithmetic. THE THESIS, suite-pinned per weapon: ACCURACY IS THE DROP RATE
(drops pay ≥ headshot cost, < body-shot cost). EMPTY is a HUD state
(isEmpty() handed to setAmmo — one rule, one home); startReload refuses an
empty pile (a reload that loads nothing is a trap). Melee stays bounty-flat
(income exploit) and drops fire from onEnemyKilled so bash/pellet/blast all
pay the same.

## 0. ROADMAP (adopted 2026-07-13; ordering PROVISIONAL, Daniel
reorders by pass name; report refs = RESEARCH_GENRE.md PART 2)

**Next session opens with: Pass 17b — ammo reserve + pickups.** Its
source and its floor are both DECIDED (§4); the open question is the
pickup, not whether ammo goes finite.

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
  via `scaleBody`, `NO_CLIMB` routes brutes onto the ground field,
  conscious §18 pin move exempting HEAVY types from the one-shot
  guarantee. Sprinter debuts wave 5, brute wave 6.
- ~~Pass 13b~~ DONE: **arm-derived crawler strike ring** —
  `proneChainExtents(type).arm × RING_FRACTION` (0.85). Conscious §15
  pin move (the old "crawl ring ≤ standing ring" invariant retired).
- ~~Pass 13c~~ **DROPPED, not deferred** — see §6. Do not re-open
  without new evidence.
- ~~Pass 14~~ DONE: **exploder** — on-death two-band AoE, pulsing-eye
  tell, wave 7.
- ~~Pass 14c~~ DONE: **exploder blast FX** — pooled `blastFX.js`.
  An additive FLASH sized to `EXPLODE.CORE_RADIUS` and a ground RING whose
  OUTER EDGE lands exactly on `EXPLODE.RADIUS`: together they are
  `blastDamage()` drawn in the world (bright core = 2 hearts, ring edge =
  1 heart, outside = safe). **Every radius is READ from the registry**, so
  the picture cannot drift from the damage — §23 pins the RENDERED
  `mesh.scale` against `blastDamage()` itself. Two things there are
  load-bearing rather than taste: the ease `1 - (1-u)²` returns 1 in EXACT
  float arithmetic at u=1 (a sine ease looks identical and does NOT), and
  the ring HOLDS at full extent before fading, which is what makes the
  exact arrival frame-rate-independent — a 16.7 ms step jumps 296 → 312
  without ever sampling 300. Burst particles carry a material EACH; with
  one shared, a blast would repaint every red droplet still in the air.
- ~~Pass 15~~ DONE: **spitter** — pooled ballistic globs on an arc, the
  game's first ranged threat, wave 8. See §6's provenance note.
- **Pass 16 — special reward round** [report #2]: hound round + Max
  Ammo pulse every N rounds. **Do not build 16 before 17b.** Its reward
  half was hollow because reserve ammo did not exist — a "Max Ammo" pulse
  granted nothing. 17b gives it a consumer, and 16's reward is the
  natural SOURCE 17b needs. They are each other's missing half.

**Phase 3 — weapon variety** [priority: Daniel's explicit ask]
- ~~Pass 17~~ DONE: **`weaponTypes.js` registry + switching + shotgun**.
  The keystone: 18/19/20 were all gated on it. Its load-bearing move,
  because 17b inherits it: **`shooting.js` reports a SHOT, and pellets
  are an implementation detail underneath it** — so ONE round leaves per
  trigger pull no matter how many pellets fly, and 17b's reserve
  accounting is correct by construction with no loop to get wrong.
  Damage stays enemy-side; a weapon's power is `PELLETS`, and because
  `SPREAD_DEG` means fewer pellets connect with distance, **the scatter
  IS the falloff** with no falloff code anywhere. Magazines are
  per-weapon and PERSIST across swaps; a swap CANCELS a reload. The
  trigger cooldown is ONE shared timer — it belongs to the player's
  finger, not the gun. Every viewmodel is built AT INIT (building on
  swap compiles a material mid-round).
- ~~Pass 17a~~ DONE: **melee — the bash.** See §3. **The decision that
  reordered this phase, and it is load-bearing for 16/17b/19 — this is
  the ADR** (the full argument lives in `src/game/melee.js`'s header,
  which is deliberately the canonical statement rather than this file):
  - Daniel rejected the infinite pistol as 17b's floor. Correct, and for
    a sharper reason than "not challenging": an infinite pistol is a
    **free** floor, so it lets the shotgun's "will you commit?" question
    be declined for free, and it deletes the pressure 17b exists to make.
  - **Melee had to come first, and not merely for safety.** Without a
    floor, 17b's drop rate is HOSTAGE to the softlock — it must be
    generous enough that you never dry out, which means it can never be
    scarce, which kills the pass's whole point. A bash costs RISK
    (REACH 2.0 is inside the standing claw at 2.5) instead of resource.
    **Melee is what buys the drop rate its freedom to be cruel.** The
    failure mode becomes "you are bashing wave 9 and it is terrifying"
    rather than "you have no verb and `waves.js:230` will not end the
    wave".
  - **Order matters for what the feature READS as.** Scarcity first
    teaches "ammo is scarce and I am helpless", and melee then arrives as
    a patch. Melee first means scarcity arrives and *retroactively gives
    it a job* — same missing-half structure as 16/17b, one layer down.
  - **Melee is an ACTION, not a weapon** (`CONFIG.MELEE`, no registry
    entry, no hotbar slot). A knife in `WEAPON_ORDER` would Q-cycle — you
    would cycle INTO your panic button and back out — and would need a
    `MAG_SIZE`/`RELOAD_MS` that mean nothing, which §24's registry
    contract pins against. When a gun eventually wants its own bash,
    `weapon.MELEE ?? CONFIG.MELEE` is the same widening MAX_RANGE /
    EXPLODE / CRAWL already prove, and it costs one `??`. Not built now:
    both guns would carry identical blocks — machinery with no consumer.
  - Melee was a **roadmap gap**: surveyed in RESEARCH_GENRE.md PART 1
    (Category D, line 217) but never given a numbered candidate in PART 2,
    and not in "Explicitly NOT Recommended" either. It fell through.
- ~~Pass 17a-fix~~ DONE: **mutual exclusion.** See §3.
- **Pass 17b — ammo reserve + pickups** [Daniel's ask; the GOAL].
  See §4. **Its floor now exists.**
- **Pass 18 — weapon roster expansion** (SMG, etc). **Now data-only** —
  a new gun should be an entry in `weaponTypes.js` and nothing else.
  Verify that claim by building one and touching no other file; if you
  can't, 17 was wrong somewhere.
- **Pass 19 — wall-buys + THE WALLET** [report #5 + absorbed pass 11].
- **Pass 20 — upgrade station** [report #6].

**Phase 4 — score feel & challenge modulation**
- **Pass 21 — combo/style meter** [report #4] (`showPraise` is its seed).
- **Pass 22 — intensity spawn modulator** [report #10].
- **Pass 23 — window-boarding repair economy** [report #8].

**Named, banked, out of phase order (Daniel's, opened on request):**
- **Pass 17c — the knife viewmodel.** Daniel's ask at 17a: "an actual
  knife that switches when melee is applied". Today `swingGun()` sweeps
  the HELD gun; a knife means hiding `active.group` and showing a knife
  for the SWING_MS window, then restoring. Build it at init like the guns
  — never compile a material mid-horde. **It is not cosmetic-only**, and
  that is the whole reason it is a pass rather than a tweak: a knife is a
  SECOND HAND, so it makes both of 17a-fix's exclusions legal again.
  17c must decide, deliberately, whether firing mid-bash and bashing
  mid-reload come back (COD allows both, and the knife is exactly why).
  The pressure point is that the pistol's 150 ms trigger is shorter than
  the 220 ms swing, so "fire while holstered" is a real input.
- **Pass 14b — friendly-fire exploders.** Deferred from 14 BY DESIGN: an
  AoE that killed other zombies would bump `notifyKill()` while
  `scoreKill()` stayed back in the shot handler with the part context, so
  kills and score would visibly disagree. Needs its own scoring round.
- **Pass 15b — the spitter's acid pool** (ground denial, report #3C's
  actual intent). The hook is marked in `projectiles.js` at the ground
  retire (`if (y <= g.radius)`). Reuses `spawnPool`'s visual — pools
  carry a material EACH, so the colour lever is free, and `poolPhase`
  owns the lifetime. The delicate number is the DoT tick rate against
  `PLAYER.MAX_HITS` 5.

**Long tail (unscheduled, gated):** traps [#7], perks [#9], buyable
doors [#12], mutators [#11], roguelite meta [#13], mystery box [#14 —
gate: ≥4–5 weapons], downed/second-wind [#15].
**Docs debt: DESIGN.md v3.1** — see §6 for the current list.


## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no downloaded
assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks, accuracy, localStorage
  PB). Reload and weapon swap apply. NO map/nav/zombies: 4.3/7c/waves
  systems provably inert.
- **Waves** — untimed last-stand in the village. Zombies navigate a flow
  field, climb windows (queued, congestion-priced), spawn from the fog
  ring + window entries in per-wave TYPE mixes (7d), scale in HP past
  wave 8 (12), come in **six archetypes** (13/14/15), transform (3 leg
  hits → prone Crawler), pay registry bounties with headshot praise (10).

The six archetypes and the question each asks:

| type | debut | question |
|---|---|---|
| proto_zombie | 1 | baseline |
| crawler | 4 | low profile, can't climb |
| sprinter | 5 | pace |
| brute | 6 | attrition; breaks camping |
| exploder | 7 | WHERE you kill it |
| spitter | 8 | are you MOVING? |

**Two weapons (17)** and the question each asks:

| weapon | slot | question |
|---|---|---|
| pistol | 1 | can you aim? unlimited reach, one precise ray |
| shotgun | 2 | will you commit? lethal ≤3 m, dead past 13 m |

Doc index: `RESEARCH_GENRE.md` (genre survey + candidate passes — the
roadmap source; §0 owns the adopted ordering and pass numbers).
`RESEARCH_PRIOR_ART.md` (sessions ≤3, **+ Source 6 added session 8** —
Zombie Slayer, the first prior art that shares our no-assets rule; the
only true like-for-like comparison in the file, and its roadmap rows are
live evidence for Phase 3 and Pass 19). `DESIGN.md` v3.0 (v3.1 queued).
`LESSONS.md` (42 entries, **21 unharvested**). No DevLog.


## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**;
  enemyTypes.js / waveTable.js / maps.js: registry additions as
  quote-the-anchor INSERTIONS, full-replace needs a "tuned anything?"
  caveat.
- **A paste-in's ANCHOR gets pasted if it looks like a payload** (14c,
  new): the config.js paste-in showed "find this" and "paste this" as two
  adjacent code blocks with nothing distinguishing them, and Daniel
  pasted both — his committed config.js carried two comment lines twice,
  and `FX_COLOR` landed at column 27 instead of 5. Neither broke
  anything; the suite passed on his tree; only a diff against origin
  found them. **Label an anchor `FIND — do not paste`, or make the
  paste-in a single "replace these lines with this" block with no
  separate anchor.** Almost certainly the origin of the nine-pass-old
  duplicate RECOIL keys (§5).
- **A paste-in's other failure mode is landing in the WRONG BLOCK** — it
  parses, imports, greps clean, and shows up in `git status` exactly as
  expected (2026-07-14). When a registry paste is the fix for a bug
  CAUSED by a paste, deliver the full file instead.
- **Breaking the paste-in rule is allowed, deliberately, with the
  assumption stated** (17): config.js's change was deletions in three
  places, which is exactly what the paste-in format had just got wrong.
  Delivered as a download built on the verified origin tree, flagging
  inline "if you've tuned config.js locally since the last push, say so
  and I'll merge instead". Do this only from a tree diffed against
  origin, never from an older copy.
- **When a registry block is too long to paste inline, ship it as a file
  named so it CANNOT be mistaken for the target** (`PASTE_INTO_<file>.js`,
  15). Confirm it never reaches the repo: `git ls-tree origin/main -r |
  grep -i PASTE_INTO` must return nothing.
- **RUN THE SUITE IN THE TREE YOU ARE COMMITTING.** Pass 13b was
  committed on the delivery message's expected count and pushed RED. The
  gate worked; it was never run.
- **Multi-part deliveries state the changed-file count, and checkpoint
  blocks list the expected files as a comment** (LESSONS #20). Pass 17
  shipped as "9 files change — all downloads, no paste-ins".
- **The `git status` READ catches ARRIVALS, not just deletions** (15) —
  see §6's provenance note. `git add .` is blind; the READ makes it safe.
- Feel reports: mechanism → single lever → surgical value. **But name the
  mechanism from a MEASUREMENT, and be willing to tell Daniel his lever
  can't do the job** (17): he diagnosed the cross-map shotgun kill as
  spread, and he was right about the choke — but the mechanism was an
  infinite-range full-damage hitscan against a head that one-shots
  everything. Measured, spread alone could not fix it at any value that
  left the weapon alive. He picked the combined option on the numbers.
- Pose/rig constants are PROBE-MEASURED (LESSONS #19); handoff numbers
  are pointers — MEASURED-at-HEAD wins.
- **A probe must not use accessors that MUTATE what they read** (17,
  new): `getWorldPosition` calls `updateWorldMatrix` internally, so a
  probe that queried only the head left every other hitbox stale at the
  origin — and the diagnostic written to catch that couldn't, because
  asking each mesh where it was FIXED each mesh. `scene.updateMatrixWorld(true)`
  after spawn. **When a diagnostic CONFIRMS a suspect probe, suspect the
  diagnostic** — agreement between two instruments sharing a side effect
  is one instrument.
- Multi-edit plans get the end-state grep walk: WRITE and READ of every
  planned change (LESSONS #18). **When a brand-new suite pin fails,
  suspect the PIN first** (LESSONS #21). **And a new pin isn't done until
  you've broken the thing it guards and watched it go red** (2026-07-14).
- **A bite harness is code, and it has now been wrong in four distinct
  ways** — all recorded, all plugged:
  1. **Gate on a GREEN baseline before the first mutation** (14c). A
     leaked `MAX: 0` from a hand-run bite — whose restore died on a dash
     "Bad substitution", so never use bashisms in sandbox one-liners —
     left the tree red, and 22 bites reported confident REDs that would
     have fired at anything. A bite's verdict is a DIFFERENCE; prove the
     control.
  2. **Detect on what the suite PRINTS** (14c). The suite emits
     `FAIL   <assert label>`; the section name never leaves the failures
     array. A detector grepping for `section23` reported 23/23 false
     GREEN. Uniform verdicts across a whole set are evidence about the
     instrument, not the code.
  3. **Unique anchors, COPIED from the file** (17). A retyped anchor
     missed on `~1.8x` vs the file's `~1.8×`.
  4. **A GREEN bite has three causes** (17) — a false pin, a bite that
     didn't bite (a "shared magazine" bite that appended an unused key
     and shared nothing), and a mutation that genuinely changes nothing
     (`if (spreadRad > 0)` → `if (true)` is neutral because
     `spreadOffset(0,…)` returns exact zero — a NON-bite, documented as
     such, not papered over). Print the caught labels so a red for the
     wrong REASON is visible too.
  Per-run `timeout` still applies (a probe deriving its loop bound from
  the value under test hangs when a bite feeds it zero).
- **Edit scripts use the file-creation tool, never a shell heredoc**
  (17, new). LESSONS already said "script files, not inline heredocs"; I
  followed the letter (I WAS writing a file) and broke the spirit — a JS
  file full of backticks and `${}`, inside a bash heredoc, inside
  tool-call XML, is three quote levels and it malformed, leaking raw
  script into the chat and leaving `main.js` half-converted (an
  identifier used but not imported, and two modules on incompatible
  callback APIs — `node --check` passed it cheerfully). **Every edit
  script is all-or-nothing: exit before writing if any anchor misses.**
  That design then caught an ambiguous anchor and left the tree clean.
- **A counterfactual must be RUN, not computed** (2026-07-14).
- Claude sync: `git fetch origin && git reset --hard origin/main`;
  verify tip + key docs; **reconcile my tree against ORIGIN before
  theorising about a bug in Daniel's build**.
- Run `node test_suite.mjs` before every delivery; `node --check` has no
  binding analysis; ES modules also get an import-run; main.js is
  DOM-coupled — grep its new identifiers' imports (this caught
  `getActiveWeaponId` in 17). Render-path changes are SUITE-INVISIBLE —
  browser-first testing steps.


## 3. Current state (as of c1d8913)

- **Roster:** 6 enemy archetypes (proto 100 / crawler 125 / sprinter 150 /
  brute 250 / exploder 175 / spitter 200 bounties) · **3 weapons** (pistol =
  STARTER, drop-sustained, no wall; shotgun 1200/600 on BR hall's west face;
  SMG 1750/900 deep in TR's north room, AUTO, leash 24).
- **Economy loop:** kills → bounties (headshot ×2) → purse (earned never
  falls) → walls (guns, then ammo-to-cap) · drops (20%, PICKUP_ROUNDS of the
  ACTIVE gun) → piles → reloads take · melee = the floor when broke.
- **Controls:** WASD · mouse · LMB fire (HOLD = auto on AUTO guns) · R
  reload (refuses full mag / empty pile) · V bash · 1-9 slots (roster
  decides; ownership gates) · Q cycle (owned only) · E interact/buy · ESC.
- **HUD:** purse top-left (waves) · ammo pill `NAME mag / MAG · reserve`
  (EMPTY state; 7 repaint sites through paintAmmo) · buy prompt bottom-centre
  (gun → ammo → FULL ladder; greys when poor; 150 ms cadence).
- **Range mode:** whole rack owned, infinite piles, no panels, no drops, no
  prompt — readout byte-identical to pass 17. All by construction, not by
  mode checks in the game modules (main seeds; modules own rules).

## 4. NEXT: the queue (nothing opened — next session starts with a pick)

1. **Pass 20 — upgrade station** (prereq 19 SHIPPED). Report: one machine,
   big fee, stat multiplier + visual tint. §24's scan will force the
   multiplier onto the registry. Watch: 19's ADR left panel textures
   price-free specifically for this pass.
2. **Pass 16 — special round.** STILL HOLDS ITS SCOPE FORK, resolve in an
   options round first: hound = quadruped = new body builder + probe cycle
   (LESSONS #19), vs "sprinting husk" reskin = registry-only. Its Max Ammo
   pulse now has real value (three piles to fill; drops feed only the active
   gun, so "fills ALL" is 16's own identity).
3. **Pass 17c — knife viewmodel** (banked from 17a). Re-opens the two
   17a-fix exclusions DELIBERATELY (second pair of hands).
4. **ADS zoom** (banked from Sky Cruiser, see §6) — next-session-opener
   sized, not landing-strip sized: touches sensitivity + viewmodel feel.

## 5. The suite — 34 modules, 839 asserts, 27 sections, run before EVERYTHING

- `node test_suite.mjs` from repo root; module floor 34 (game/buys.js is
  #34). Every delivery re-runs it IN THE TREE BEING COMMITTED.
- Bite discipline (standard since 13b): every new pin seen red before
  shipping. Session 10 added two shapes to the discipline: passes-by-absence
  conditional asserts (pair with a guard-the-guard), and defense-in-depth
  lines that green singly — bite the combined stack (both in LESSONS).
- Key contracts: §5 config schema (114 leaves) + usage scan · §24 registry
  REQUIRED fields + the DATA-ONLY TEXT SCAN (code may not name weapon
  ids/slot digits; src/data/ registries may — conscious 19 move) + leash
  pins (mode-aware) + dominance pin (faster trigger pays in scatter, same
  pellet count) · §26 economy window per weapon + pool-discipline sharing
  pins (derived per child) · §27 wallet/ownership/buys + map-spot validity
  DERIVED via mapGrid + the pistol-era pricing pins (derived from wave
  table × bounties).
- Harness rule from 19: §10/§26 accounting harnesses own the rack
  (`allOwned: true`) explicitly; ownership behaviour lives in §27 only.

## 6. Open / outstanding / banked

- **Sky Cruiser bank (2026-07-16, from Daniel's link — a networked VR
  flying-car game; multiplayer/VR/voice explicitly NOT for us):**
  (a) **map-select screen** — our data side already exists (maps.js holds
  village01 + house01; needs a start-screen card + a one-line blurb field
  per map entry; their two-map picker is the shape reference);
  (b) **ADS zoom** — right-mouse FOV lerp, `ZOOM_FOV` as an optional
  registry field (MAX_RANGE contract), interacts with the SMG's
  spread-as-economics design.
- **Feel bank (unopened, mechanisms named):** strike slam depth −0.235 ·
  attack-start pop at REACH_AMP 0.5 · yaw spring escalation · dry-click
  EMPTY audio (waits on pass 8's audio system).
- **Pass 16 scope fork** (see §4.2). **Dismemberment** partially landed as
  the crawler (7c); full gore version still banked.
- **LESSONS:** 43 entries; 38 harvested (through 78adfb2), **5 new from
  session 10 UNHARVESTED** (roster-vs-rule pins · neighbour's-reasoning
  invalidation · future-pass comments as unchecked claims · three harness
  defects · defense-in-depth biting). Harvest is a dev-method skill-project
  session; record here, harvest there, receive the marking hand-off here.
- **DESIGN.md:** current at v3.1 (through pass 18). Passes 19/17d.2 owe it
  a v3.2 line when the next docs pass runs — small, not urgent.

## 7. MEASURED facts (MEASURED-at-HEAD wins over this file)

- Suite: 34 modules / 839 asserts / 27 sections, PASS at c1d8913.
- Config: 114 leaves under the §5 schema.
- Economy window: proto headshot cost 1 round, torso 3; drops pay 2.4
  rounds/kill (pistol & SMG), 1.2 shells (shotgun — AMMO-POSITIVE ≤ 3 m:
  8 pellets × TORSO 1 = 8 ≥ capped HP 6). Income waves 1-3 = 600,
  through 5 = 1600 (body-shot, blended bounties).
- SMG: 800 RPM (COOLDOWN 75), SPREAD 2° half-angle → torso odds 62% @ 8 m /
  23% @ 13 / 7% @ 24 (uniform disk, torso half-width 0.22); leash 24;
  pile 120 ≈ 9 s of held trigger.
- Buy spots (probed): shotgun wall (13,16) face W → front (12,16) walkable,
  world 4.8,−7.0; SMG wall (15,2) face S → front (15,3), world 8.0,−29.4.
  BUYS.RADIUS 1.4 m; spots > 2 radii apart (pinned).
- Drops: 20% / LIFE 15 s (> intermission 2.5 s + gap 0.8 s, pinned as an
  inequality) / blink last 3 s at 150 ms / pool 12, reclaim-OLDEST / collect
  ring 0.65 m / can at Y 0.4 hover.

## 8. Session hygiene for next session

- Sync sandbox to origin/main FIRST; state tip inline (short SHA + message);
  run the suite; expect 34/839 PASS before any work.
- Read THIS file before any work. Options round → Daniel picks → one tested
  pass per commit. Checkpoint blocks: expected-files comment, status-read as
  a SET, scoped add for docs-only, one block per message, always `git push`.
- config.js / index.html / style.css are hand-tune surfaces: before any
  full-file delivery of them, ask whether Daniel has local tunes to merge
  (session 10 shipped them full-file twice with that flag — no collision,
  but the flag is the protocol).
- The next session opens on a queue pick (§4), not on unfinished work —
  nothing is mid-flight.
