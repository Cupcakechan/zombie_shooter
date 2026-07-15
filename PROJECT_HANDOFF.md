# PROJECT_HANDOFF — Zombie Shooter

Session-8 END (2026-07-15). Self-contained: a cold session should parse
this without the chat it came from. Repo:
`https://github.com/Cupcakechan/zombie_shooter.git`. Local:
`C:\Users\danie\Documents\HTML Projects\zombie_shooter` (Windows, Node,
**no Python** — every command must be Windows/Node).

Tip at write time: **`b93af54`** — "Pass 17: weaponTypes.js registry +
switching…". Suite on that tree: **SUITE PASS, 31 modules, 594 asserts.**

## 0. ROADMAP (adopted 2026-07-13; ordering PROVISIONAL, Daniel
reorders by pass name; report refs = RESEARCH_GENRE.md PART 2)

**Next session opens with: Pass 17b — the real ammo reserve.**

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
- ~~Pass 14c~~ DONE: **exploder blast FX** — see §3.
- ~~Pass 15~~ DONE: **spitter** — pooled ballistic globs on an arc, the
  game's first ranged threat, wave 8. See §6's provenance note.
- **Pass 16 — special reward round** [report #2]: hound round + Max
  Ammo pulse every N rounds. **Do not build 16 before 17b.** Its reward
  half was hollow because reserve ammo did not exist — a "Max Ammo" pulse
  granted nothing. 17b gives it a consumer, and 16's reward is the
  natural SOURCE 17b needs. They are each other's missing half.

**Phase 3 — weapon variety** [priority: Daniel's explicit ask]
- ~~Pass 17~~ DONE: **`weaponTypes.js` registry + switching + shotgun**.
  See §3. The keystone: 18/19/20 were all gated on it.
- **Pass 17b — the real ammo reserve** [Daniel's ask, queued not banked].
  See §4.
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
**Docs debt: DESIGN.md v3.1** (owes Stage 4 + 4.3 + windows + 7c + 7d +
10 + 12 + 13 + 13b + 14 + 14c + 15 + 17) — the standing docs candidate.

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
`LESSONS.md` (38 entries, **17 unharvested**). No DevLog.

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

## 3. Current state (deltas this session; earlier systems unchanged)

- **Blast FX (14c)** — new pooled module `src/render/blastFX.js`. An
  additive FLASH at the body's anchor sized to `EXPLODE.CORE_RADIUS`, and
  a ground shockwave RING whose OUTER EDGE lands exactly on
  `EXPLODE.RADIUS`. Together they are `blastDamage()` drawn in the world:
  bright core = 2 hearts, ring edge = 1 heart, outside = safe. **Every
  radius is READ from the registry**, so the picture cannot drift from
  the damage — §23 pins the RENDERED `mesh.scale` against `blastDamage()`
  itself, not against a shared constant.
  - The ease curve is load-bearing, not taste: `1 - (1-u)²` returns 1 in
    EXACT float arithmetic at u=1, so `radius * eased` gives back 3.5
    bit-for-bit. A sine ease looks identical and doesn't carry that. §23
    pins it with `===`, never a tolerance.
  - The ring **HOLDS at full extent then fades**. Not aesthetic: browser
    frames land where they land and a 16.7 ms step jumps 296 → 312
    without ever sampling 300. The clamp is what makes the exact arrival
    frame-rate-INDEPENDENT. §23 drives ragged 16.67 ms frames to prove it.
  - `bloodFX.spawnBurst` gained an optional `opts` ({color, speed,
    radial}), all `??`-guarded to the pass-8.3 constants so the three
    existing call sites are unchanged BY CONSTRUCTION. Burst particles
    now carry a material EACH — with one shared, a blast would repaint
    every red droplet still in the air, mid-flight.
  - `EXPLODE.FX_COLOR` (0x9dff30) lives on the registry, not
    `CONFIG.BLAST`, for the same reason `RANGED.COLOR` does.
- **Weapons (17)** — new registry `src/data/weaponTypes.js` +
  `WEAPON_ORDER`. Pistol (slot 1) reproduces the pass-4 gun exactly;
  shotgun (slot 2) proves the registry. 1 / 2 pick a slot, Q cycles.
  - **THE architectural move: SHOT vs PELLET.** `shooting.js` now calls
    `onShot(hits, weapon)` **exactly once per trigger pull** and hands
    the pellet results over as data. The old `onHit`-per-ray shape would
    have charged eight rounds for one shell, kicked eight times, and
    logged eight Range accuracy samples per pull — seven of them misses
    when all eight pellets hit one sphere (`hitTarget` refuses an
    already-popping target). main.js's per-shot bookkeeping is correct BY
    CONSTRUCTION: there is no loop up there to get wrong.
  - **Damage stays enemy-side.** A weapon has no damage number; power is
    `PELLETS`. That falls out beautifully — `SPREAD_DEG` means fewer
    pellets connect with distance, so **the scatter IS the falloff**,
    with no falloff code anywhere.
  - **Magazines are per-weapon and PERSIST across swaps**; a swap
    CANCELS an in-progress reload. That makes the swap the real answer to
    an empty shotgun in melee — faster than 2.2 s, at the cost of the
    progress already paid for. Without the cancel you could start the
    shotgun's reload, fight with the pistol, and collect a free tube.
  - **The trigger cooldown is ONE shared timer**, not per-weapon:
    otherwise you could swap-fire to out-rate both cooldowns by hand. The
    cooldown belongs to the player's finger, not to the gun.
  - **Every viewmodel is built AT INIT**; swapping toggles visibility.
    Building on swap compiles a `MeshStandardMaterial` mid-round — a
    hitch landing the first time you press 2 with a horde on you.
  - `MAX_RANGE` is an OPTIONAL field (`?? Infinity`), same contract as
    CRAWL/EXPLODE/RANGED — the pistol simply has none. Consumer is one
    line: `raycaster.far = weapon.MAX_RANGE ?? Infinity`, written on
    EVERY shot because the raycaster is module-scope and `setFromCamera`
    does not reset `.far`. See §7 for why 13.
  - **Constants moved OFF config.js onto the registry**:
    `FIRE_COOLDOWN_MS`, `RECOIL_MS`, `RECOIL_KICK_DEG`, `RECOIL_KICK_BACK`,
    and the whole `AMMO` block. Every one was a fact about the pistol
    wearing a global name, and the moment a second gun existed they were
    actively wrong about it. `GUN.RELOAD_DIP` stays — the dip is how the
    PLAYER's hands move, not the gun.
- **Registry-first held all session.** 14c's only structural code is one
  pooled module; 17's is the SHOT/PELLET split and a parameterised gun
  builder. Pass 18's roster is meant to be data only — prove it.

## 4. NEXT BUILD PASS: **Pass 17b — the real ammo reserve (OPTIONS ROUND)**

Daniel's explicit ask, deferred from 17 by design because reserve is
per-weapon by nature and could not be modelled honestly before
`weaponTypes.js` existed.

**Read this first: there is no reserve at all.** `ammo.js`'s
`updateAmmo()` sets `mag = MAG_SIZE` out of thin air on reload
completion. "Unlimited reserve" was never a value — the concept does not
exist. 17b invents it.

**The hard dependency, and it IS the options round:** finite reserve
without an ammo SOURCE is a softlock, not a difficulty. A zombie shooter
where you are empty and cannot act is a dead end. Candidate sources,
cheapest first:
- **wave refill** (top up at each wave start — limited WITHIN a wave, no
  new machinery, cannot softlock);
- **Pass 16's Max Ammo pulse** (the two are each other's missing half —
  16's reward is hollow precisely because ammo is infinite);
- **kill drops** (classic, real risk/reward, needs a pickup system — new
  machinery, so it needs its own justification);
- **Pass 19 wall-buys** (needs the wallet, so it can't be first).

Other real questions: per-weapon reserve amounts; what the HUD says
(`setAmmo(weapon, mag, reloading)` currently has no reserve slot); what
EMPTY feels like (auto-swap? dry click? both?); and whether reserve is a
registry field (`RESERVE_MAX`) or config. Bite-test every new pin; §10 is
where the ammo model is pinned and already covers per-weapon mags,
swap-cancel, reload clocks and slot resolution.

## 5. The suite — 31 modules, **594 asserts**, run before EVERYTHING

New this session:
- **§23 — the blast FX (~32 asserts)**: curve exactness with `===` not a
  tolerance (the ease-out-quad was CHOSEN for bit-exact arrival); the
  ring HOLDS past `RING_GROW_MS`; both opacities reach exactly 0; three
  /0 guards via `Number.isFinite` (never `assertNear` — NaN slips a
  tolerance silently); the shape window (`FLASH_LIFE_MS` < `RING_GROW_MS`,
  `0 < RING_THICKNESS < 1`, `RING_Y` clears the blood pools).
  **THE pin**: the RENDERED ring, driven through the live pool on ragged
  16.67 ms frames, reaches exactly `EXPLODE.RADIUS`, and `blastDamage()`
  at that drawn edge > 0 while a hair outside === 0.
- **§24 — weapons (~47 asserts)**: the registry contract (a REQUIRED list
  naming fields that must EXIST — §5's sweep only validates fields that
  do; every id matches its key; every PARTS box is a real 3-vector); the
  design window (the shotgun pays for pellets with rate, capacity AND
  reload; every weapon's `LOW_AT` can be both on and off; no zero
  cooldowns or /0 reloads); the spread maths (`spreadOffset(0,…)` is
  EXACTLY {0,0} across the whole random range — that is what makes the
  pistol's ray bit-identical to pre-17; the rim lands on `tan(spread)`;
  sqrt-sampling proven at u2=0.25 → half the rim, where linear sampling
  would put a quarter); `fireShot` driven at a real mesh with a real
  camera (ONE pull returns 8 pellet results, they SCATTER, and the pistol
  is dead centre across 12 pulls); MAX_RANGE's boundary; and **the `.far`
  leak pin** — fire the capped weapon FIRST, then check the uncapped one
  still reaches 30 m. That ORDER is the test.
- **§5 — the duplicate-key scan (new)**: TEXT-level, block-scoped (same
  leaf name under two blocks is legal — `BLOOD.COLOR`/`CASINGS.COLOR`,
  `PROJECTILES.MAX`/`BLAST.MAX`), with a guard-the-guard on the parse.
  `config.js` had declared `RECOIL_MS` and `RECOIL_KICK_DEG` **twice each
  since pass 9** with a full schema watching. **A runtime guard
  physically cannot see this** — JS collapses the duplicate (last wins)
  before any assertion runs, so the evidence is destroyed before §5 gets
  to look. Text is the only level where it still exists. It caught both
  on the day it landed. Also: §5 now sweeps `WEAPON_TYPES`.
- **§10 — rewritten for per-weapon magazines**: independence, persistence
  across swaps, the reload running on the ACTIVE weapon's clock, swap
  cancelling and banking nothing, slot resolution returning null (never
  undefined-indexing), and cycle wrapping.
- **Module floor repaired twice**: 28 → 30 (14c) → 31 (17). It had sat at
  28 while the walker found 29 since pass 15 — guarding nothing, because
  `>=` makes a stale floor permanently satisfiable.

**Every new pin is BITE-TESTED** — 23 for 14c (after two harness repairs
and two real false greens), 25 for 17, 5 for the Option-3 tune. All fire.

## 6. Open / outstanding / banked

- **Pass 15's provenance is UNEXPLAINED — read this before touching it.**
  Mid-session-7, after the sandbox was synced clean and only read from,
  `git status` showed a complete uncommitted pass 15 implementation. It
  was in neither HEAD nor origin nor the transcript. Neither Claude nor
  Daniel can account for it. **It was NOT trusted on its green suite** —
  adopted only after a line-by-line read, an end-state grep walk, an
  import gate, and a bite-test of all 16 new pins, which found three
  wrong comments. The code is verified; the mystery is not solved. If
  anything about pass 15 behaves oddly, start here. (Session 8 found a
  FOURTH thing it left behind: the stale module floor. That review
  audited claims and code, not constants.)
- **Pass 13c — DROPPED ON THE EVIDENCE, do not re-open blind.** Measured
  by control-difference: every crawler deals damage under the current
  gate (11/10/11 hits vs 14/14/15 under the proposed arm gate) — 13c was
  a ~34% difficulty increase wearing a bug-fix costume. If crawler
  difficulty is ever wanted, **`CRAWL.ATTACK.RANGE_SLACK` is the honest
  lever**, with its own round.
- **Known limitation (15, not a bug today):** globs don't collide with
  walls. The spitter only fires with LOS and the glob travels the same XZ
  line, but a glob arcing OVER an obstacle isn't modelled. Colliders are
  2D AABBs with no height, so there is nothing to arc over yet. Real the
  day walls gain height.
- **Known and CORRECT (14c):** the shockwave ring passes through walls,
  because `blastDamage()` has no LOS or wall test — a blast genuinely
  reaches through a wall today. The ring is a picture of the model, not
  of the light. The day the blast learns about walls, the ring learns
  with it.
- **Watch items (feel — levers named, Daniel's call):** brute crawl
  strike slam −0.235 → ~−0.29 (lever `CRAWL.ATTACK.THRUST_RAD`);
  attack-start pop at `REACH_AMP` 0.5 (fix = blend windup start from the
  current arm pose, its own round); yaw spring escalation; sprinter gait
  read at 2.4 m/s; brute vs door jambs. **New (17):** the shotgun at 5 m
  is 59.5% — if that reads too punishing, `SPREAD_DEG` 9 is the single
  lever back (4.5 was a rifle; anything between is available).
- **Untested risk:** the prone standoff is 2.25 but a grid cell is 1.6,
  so 1-cell gaps (doors, alleys) are marginal for prone bodies — a
  possible indoor failure, never exercised.
- **Cosmetic, pre-existing:** `enemyTypes.js` carries a **duplicate
  `SPAWN` key** in the `crawler` entry (~lines 160/164) — identical
  values, second wins, harmless. **§5's new dup scan only covers
  config.js**; extending it to the registries is nearly free and would
  catch this. Good docs-pass work.
- Balance to watch as Daniel plays: the six-way type mix at waves 7–8+;
  HP ramp feel at 9–15; whether the shotgun changes which archetypes feel
  dangerous — the exploder especially, since the shotgun's 100% zone is
  INSIDE `EXPLODE.RADIUS` deliberately ("players will need to adapt — if
  an exploder is too close they'll need to react fast").
- Reload scope (both modes) — still provisional. Other stale hand-file
  comments (enemyTypes `SQUASH_KICK` "~9%", LIMP comment; config's
  WAVES_SCORE block sits flush-left). **The config duplicate RECOIL pair
  is FIXED** (17 moved it to the registry) and the class is now guarded.
- **Banked:** pass 8 audio (oscillator cues arrive piecemeal with Phase
  2/3 passes — fold into pass 8 when opened); Stage 4b basement; Stage 5
  environment rotation; itch.io deploy (SHIP gate).
  **From RESEARCH_PRIOR_ART Source 6:** a keyed geometry cache
  (`AssetManager.getGeometry(key, factory)`) — pooling already covers the
  ground; the keyed form is better the day two modules want the same
  primitive. No second asker yet. **Do not build it.**
- **LESSONS.md: 38 entries — 21 harvested (`307946e`), 17 NEW and
  unharvested** (3 from 2026-07-14, 5 from session 7, **9 from session
  8**). All route to the dev-method. **A harvest session is badly
  overdue** — it closes with the marking hand-off (`[HARVESTED — <date>]`
  on each promoted heading) plus a ready commit block; Daniel's job is
  drop-and-push, and the push stays his by design.

## 7. MEASURED facts (MEASURED-at-HEAD wins over this file)

**Blast FX (14c):**
- Shape/timing only in `CONFIG.BLAST` — **nothing there is a distance**.
  `MAX` 6, `FLASH_LIFE_MS` 120 (named `_LIFE_` because a top-level
  `CONFIG.FLASH_MS` already exists for the MUZZLE flash, and two
  FLASH_MS in one file is a grep away from an expensive mistake),
  `FLASH_RADIUS_MULT` 1.0, `RING_GROW_MS` 300, `RING_FADE_MS` 150,
  `RING_THICKNESS` 0.08 (fraction of the current radius, so the band
  thickens as it grows), `RING_SEGMENTS` 48, `RING_Y` 0.03 (above floor
  0, grid 0.01, blood pools 0.02), `BURST_SPEED` 5.0.
- Blast life = `max(FLASH_LIFE_MS, RING_GROW_MS + RING_FADE_MS)` = 450 ms.
- `spawnBlast` reclaims the OLDEST when the pool is full — the OPPOSITE
  of `spawnGlob`, which declines. A glob is a live hit the player is
  physically dodging; a blast is a picture of damage ALREADY dealt, so
  the oldest one is nearly faded and nobody is reading it.

**Weapons (17):**
- Pistol: MAG 12 / RELOAD 1200 / LOW_AT 3 / COOLDOWN 150 / PELLETS 1 /
  SPREAD 0 / RECOIL 60 ms, 1°, 0.06 / 3 boxes / **no MAX_RANGE**.
- Shotgun: MAG 6 / RELOAD 2200 / LOW_AT 2 / COOLDOWN 700 / PELLETS 8 /
  **SPREAD 9°** / **MAX_RANGE 13** / RECOIL 110 ms, 3.2°, 0.14 / 6 boxes
  (3 wood: pump, grip, stock — two materials on one gun is what makes a
  code-built shotgun read AS a shotgun; the silhouette alone is just a
  long pistol).
- **Measured kill curve** (proto_zombie, aimed at the head, 400 shells
  per range, driven through the real hitboxes and the real damage path):
  1 m 100% · 2 m 100% · 3 m 98.8% · 4 m 83.8% · 5 m 59.5% · 6 m 46.5% ·
  8 m 29% · 10 m 16.8% · 13 m 12% · **14 m+ 0.0%**.
  Pistol control, fired right after the capped shotgun: 100% at
  3 / 13 / 30 / 40 m.
- **Why the cross-map kill existed** (the shipped 4.5° gun killed 5% per
  shell at 40 m, free, forever): a pellet is a full-damage hitscan of
  infinite length, `HITBOX.HEAD` 3 one-shots EVERY type (all HP ≤ 3), and
  the eyes are `fog: false` — so you could see and snipe glowing eyes
  across a 36×42 m arena. The shotgun at range wasn't dealing damage; it
  was buying eight lottery tickets per pull. **Spread alone could not fix
  it**: at 12° the 40 m shot was still 0.5% while the 3 m gun fell to
  87% — the exploit survives and the weapon dies. A cap makes it
  IMPOSSIBLE rather than rare, which is the only thing that stops it
  reading as absurd.
- **Why MAX_RANGE is 13**: it is `FOG.WAVES.FAR`. Past 13 m the BODY is
  invisible, so the cliff hides behind the fog that already hides the
  target — **the gun reaches exactly as far as you can see something to
  shoot at**. §24 pins the two edges as INEQUALITIES, not equality:
  `MAX_RANGE ≤ FOG.WAVES.FAR` (never outrange your eyes — if the fog ever
  shrinks, this fires) and `MAX_RANGE > spitter STOP_DISTANCE 9` (never a
  dead pick against the archetype built to punish distance).
- Per-pellet blood is `max(2, round(HIT_PARTICLES / PELLETS))` — at
  PELLETS 1 that is `HIT_PARTICLES` exactly (pistol untouched); at 8 it
  is 2, so a shot's TOTAL spray stays ~constant. Undivided, a point-blank
  shotgun asks for 80 from a 64-slot pool and starves the kill eruption
  firing two lines later — a missing payoff, never a crash.

**Exploder (14):**
- Bands: `RADIUS` 3.5 / `CORE_RADIUS` 1.8 / `DAMAGE` 1 / `CORE_DAMAGE` 2.
  Both boundaries INCLUSIVE — pinned exactly, so a tune can't drift them.
- The design window IS the archetype: `RADIUS` 3.5 > standing attack gate
  2.5 (if it can claw you it can blast you) AND ≤ `NAV.BEELINE_DIST` 4 (a
  safe kill range always exists).
- Blast anchor measured: prone **0.393 m** vs standing **1.163 m** — the
  crippled-exploder freebie, free from pass 12's live-waist anchor.
- Particle budget: `MAX_PARTICLES` 64 − `KILL_PARTICLES` 22 = 42 of
  headroom; `EXPLODE.PARTICLES` 30 fits with room for a hit spray.
- The eyes are the ONLY fog-free material on a body — body emissive is
  swallowed by `FOG.WAVES.FAR` 13, and `group.scale` belongs to the
  squash spring. Hues all taken: amber (proto/crawler/brute), orange
  (sprinter), acid green (exploder), violet (spitter). **A 7th archetype
  needs a new tell axis, not a new hue.**

**Spitter (15):**
- `STOP_DISTANCE` **9** — outside every melee ring (max 2) and outside
  `NAV.BEELINE_DIST` 4, so it never beelines and never closes; inside
  `FOG.WAVES.FAR` 13, so it's visible at its post.
- `GLOB_SPEED` 8: flight = 9/8 = **1.125 s**, and `PLAYER.MOVE_SPEED` 4.5
  covers **5.06 m** in that window against a **0.43 m** hit radius. **It
  cannot hit a moving player.** It hits you reloading, cornered, or
  camping. That is the archetype, stated as a number — retune with care.
- Fire period = `ATTACK.COOLDOWN_MS` **2600 ms flat** (start-to-start;
  `cooldownT` is set at the WINDUP, so the 700 ms windup is INSIDE it).
  At most **one glob airborne per spitter**.

**Wave-table rounding — a real trap:**
- Largest-remainder resolves exact ties **on float noise**. `share ×
  count ≥ 1.0` wins a FLOOR slot and never touches the tie-break — which
  is why spitter is 0.125 at count 8 (= exactly 1.0). **Do not tune a
  debut share below `1/count`** without re-checking §22's rounding pin,
  and note that pin only fires when the share loses EVERY tie.

**Carried forward (unchanged):**
- **Prone chain extents (probe-measured, 13b):** proto/crawler/sprinter
  `{head 1.8419, arm 2.1709}`; brute `{head 2.3399, arm 2.7250}`. Brute
  standing extent **1.156** vs a naively-expected 1.264 — absolute
  overlap constants don't scale (LESSONS #19 confirmed).
- **Crawl rings (13b):** `arm × RING_FRACTION 0.85` → **1.845** /
  **2.316**. Attack gate = ring + `RANGE_SLACK` 0.4 → **2.245** / **2.716**.
- **The wall geometry (why §19/§20 exist):** standoff = `WALL.REACH +
  WALL.RADIUS` = 2.25 proto / 2.81 brute; the player stands
  `PLAYER.BODY_RADIUS` 0.3 off it, so a wall-backed player is held at
  **1.95** / **2.51**. **A crawler can never reach its stop ring against
  a wall — only RANGE_SLACK bridges the gap.** Margins 0.30 / 0.21.
- **Attack range is ABSTRACT in this project, not geometric:** a standing
  zombie's body reaches **0.916 m** forward from its origin but attacks
  from up to 2.5 m — hands 1.08–1.58 m short. Do not "fix" a gate by
  deriving it from where the claw lands.
- The enemy update path has **no RNG** — sims are deterministic, which is
  what makes control-difference measurement valid.
- CRAWL_POSE at HEAD: PITCH 1.35, WAIST −0.8, Y 0.02, ARM_REST 1.125,
  ELBOW 0.5, REACH_AMP 0.5, STRIDE_FREQ 5.2, ROLL 0.08, HIP_TRAIL 0.15,
  KNEE_TRAIL 0.25, DRAG_WIGGLE 0.06, HEAD_UP −0.1, WINDUP_COCK 2.2,
  TURN_MULT 0.125.
- Sphinx: belly +0.047; toes −0.011…0.037; head clearance +0.125 min;
  rest hands +0.045; gait floor = rest plant BY CONSTRUCTION (one-sided
  lift, reach peak 0.44–0.62); strike −0.235 (watch); windup arm +0.365.
- Face angle rule: PITCH + WAIST + TILT + HEAD_UP = 0.30 rad.
- Waist pivot: bellyTop − 0.04 = 1.02; suite §15 mirrors the formula.
- Prone turn rule: match END-POINT sweep (~1.25 m/s), not angular rate.
- Kill eruption anchor: waist world y + 0.15; `pos.y ?? 1.1` fallback.
- Bounty: `Math.round(SCORE.KILL × hpMult)`, headshot ×HEADSHOT_MULT on
  top (applied in scoreKill, not in the bounty).
- Wave math: `hpMultAt` = min(CAP, 1 + STEP·max(0, n − RAMP_START));
  JSON key order is NOT canonical — sort before comparing (LESSONS #21).
- Facing/prone transform/window/village/spring/render-diagnostic facts
  unchanged (rotation.y = atan2(dx,dz); world_y = y·cosθ − z·sinθ; head
  jut buries past upper-trunk ~0.8; window cost WINDOW_COST + 1; village
  11 windows / exterior 318 / ring 65 / walkable 387; spring f5 ζ0.4 kick
  ×0.022 settle ~350 ms; two-pass render nulls background after the
  first; black scene + live HUD + visible gun = paint-over).

## 8. Session hygiene for next session

Attach this file. **Open on Pass 17b (options round — the real ammo
reserve)**; read §4 above first, and note that Pass 16 must NOT be built
before it. Clone, fetch+reset, state the tip inline (**`b93af54`**), run
the suite — expect **SUITE PASS, 31 modules, 594 asserts**.

Do not re-open pass 13c (§6 says why). **Read §6's pass-15 provenance
note before touching `projectiles.js`, `enemies.js`'s strike hook, or
§22.** Probe any body change (LESSONS #19) and never with an accessor
that mutates what it reads; suspect new pins before code (LESSONS #21);
bite-test every new pin, gating on a green baseline first (§2); write
edit scripts with the file-creation tool, all-or-nothing; multi-part
deliveries state the file count and checkpoints list expected files
(LESSONS #20); run the suite in the tree being committed; verify no
`PASTE_INTO_*` reached the repo. Docs checkpoints use SCOPED adds.
Rewrite this handoff at session end.

**DESIGN.md v3.1 and a LESSONS harvest (17 entries waiting) are both
badly overdue** — either is a good docs session, and the harvest is the
bigger debt.
