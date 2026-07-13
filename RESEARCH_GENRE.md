# RESEARCH_GENRE — Zombie-Shooter Genre Mechanics Survey & Curated Candidate Passes

Provenance: deep-research pass, 2026-07-13 (session 5). Scoped to this
project's constraints — three.js r185, no bundler, code-generated
everything, single-player, registry-driven, one tested pass per commit.
The roadmap adoption of this report (queue merge + Daniel's priorities:
weapon variety, challenging game) lives in `PROJECT_HANDOFF.md` §0.
Pass numbers here are the report's own (#1–#15); the handoff maps them
to project pass numbers.

## TL;DR
- The zombie wave-shooter genre's most durable mechanics are cheap to
  translate to a code-generated, single-player three.js browser game:
  the highest-payoff-per-pass additions are a **special-round/dog-round
  pacing break**, a **wall-buy + points-economy loop**, an
  **enemy-archetype expansion** (sprinter/tank/exploder/spitter via the
  existing `enemyTypes.js` registry), an **upgrade station (simplified
  Pack-a-Punch)**, and a **combo/style scoring meter**.
- These win because the genre's core psychology — spend-vs-save tension
  (COD points economy), the repair-vs-shoot action economy (window
  boarding), the slot-machine dopamine loop (Mystery Box), and the "one
  more run" high-score chase (Devil Daggers/ULTRAKILL) — all survive
  translation to procedural assets and solo scope, and each maps onto a
  data-driven registry.
- The mechanics that do NOT translate are the co-op-dependent ones
  (Left 4 Dead's playable special-infected roster, teammate revive
  economies) and the asset/content-treadmill ones (bespoke Wonder
  Weapons, elaborate Easter-egg quest chains); include only their
  single-player-meaningful cores.

---

## PART 1 — Genre Mechanics Survey

Organized by five mechanic categories. For each notable mechanic: what
it is, exemplar games, WHY it works (design function/psychology), and
typical failure modes.

### Category A — Enemy Variety & Behaviors

**Special-infected role design (the "job-per-monster" principle).**
Left 4 Dead 1/2 built a roster where each special infected has exactly
one job: the Boomer blinds and summons a horde, the Smoker drags a
survivor out of position, the Hunter pins, the Spitter denies ground
with acid, the Jockey steers a survivor into hazards, the Tank breaks
defensive stalemates, and the Witch punishes carelessness. WHY it
works: each enemy poses a *distinct question* the player must answer
differently, so a mixed group creates layered decisions instead of
"shoot the same thing harder." Failure mode: if two specials ask the
same question (redundant roles) the roster feels padded; if a special
can incapacitate with no counterplay it feels cheap rather than tense.

**Audio-cue telegraphing.** Every L4D special has a unique
spawn/approach sound; COD's Hellhound round announces itself with
"Fetch me their souls!", heavy fog, and a ground rumble; Devil Daggers
gives every demon a continuous, recognizable noise so players can track
threats they can't see. WHY it works: it converts off-screen danger
into fair, actionable information and builds dread in the gap between
cue and contact. Failure mode: too many overlapping cues become noise;
no cue makes off-screen deaths feel unfair.

**Archetype taxonomy.** Across the genre the reusable archetypes are:
**sprinters** (fast, low-HP pressure), **tanks/brutes** (L4D Tank, They
Are Billions "Chubby," bullet-sponges that break stalemates),
**exploders** (Boomer, COD flaming Hellhounds, Days Gone),
**spitters/ranged** (L4D Spitter, KF2 Husk/Siren),
**screamers/summoners** (KF Siren, L4D Witch-adjacent), **armored with
weak points** (KF2 critical zones, The Last Stand riot/armored zombies
with breakable armor), and **crawlers** (COD leg-shot crawlers —
already built in this project). WHY it works: a small set of orthogonal
axes (speed / durability / range / area-denial) covers almost all
interesting encounter design. Failure mode: stacking stat-only variants
(many KF2/B4B modifiers feel invisible) without a *behavioral*
difference.

**Enemy synergies & horde behavior.** World War Z's proprietary Swarm
Engine was purposefully built to handle up to 500 zombies on screen at
once, and those hordes pile into "pyramids" to climb to elevated
players — turning verticality itself into a defeatable objective. L4D's
Boomer-then-Smoker combo and Back 4 Blood's stacked Corruption Cards
show synergy multiplying threat. WHY it works: emergent combinations
produce stories ("the exploder knocked me into the spitter pool").
Failure mode: synergies that only punish (no player agency to break
them) feel unfair.

### Category B — Wave & Economy Structure

**Points economy: per-hit vs per-kill.** Classic COD Zombies awarded
points on every hit plus a kill bonus, which let players "farm" by
shooting legs then meleeing. Black Ops Cold War changed to a flat
per-kill payout (roughly 90–115 depending on the kill method, with
melee and critical kills at the top) precisely to kill that exploit.
WHY it works: points are the single currency that gates *everything*
(doors, weapons, perks, upgrades), so every trigger pull is also an
economic decision — the spend-vs-save tension is the mode's engine.
Failure mode: per-hit economies invite degenerate farming; overly
generous economies remove all scarcity and thus all tension.

**Wall-buys.** Chalk-outline guns on walls (Nacht der Untoten onward)
let players buy a specific weapon and its ammo at a fixed location and
price, with ammo costing roughly half the gun. WHY it works: it's a
*reliable* counterpart to the random Mystery Box — a known, saveable
goal that anchors the early economy and creates map geography ("the
room with the good gun"). Failure mode: if wall guns outclass
everything, the box and upgrades become pointless.

**The Mystery Box (slot machine).** A random weapon for a fixed price
(~950 points), with a light beam, jingle, teddy-bear "box move"
mechanic, and a small chance of a coveted Wonder Weapon. WHY it works:
it's a literal slot machine — variable-ratio reward, the most addictive
reinforcement schedule. This is not a coincidence: Vampire Survivors
creator Luca "poncle" Galante is a former gambling-industry programmer
who deliberately borrowed slot-machine feel — the industry's obsessive
attention to sounds, animations, and reward sequences with very few
elements to work with. Failure mode: pure RNG with no pity/mitigation
breeds frustration; if the box is strictly better than wall-buys it
dominates.

**Perk machines (persistent upgrades).** Perk-a-Colas (Juggernog =
+health, Speed Cola = faster reload, Stamin-Up = faster movement, etc.)
are permanent-until-downed buffs bought from vending machines. WHY it
works: they are build-defining spend sinks that let players convert
economic success into survivability and express a playstyle. Failure
mode: "crutch" perks so mandatory (Juggernog) that not buying them is
never a choice — Black Ops 4 explicitly tried to remove crutch perks
for this reason.

**Upgrade station (Pack-a-Punch).** A single machine that upgrades a
weapon for a large fee (~5000 points), boosting damage and adding a
visual tint, new muzzle flash, and renamed gun. WHY it works: it's a
satisfying power spike gated behind a big saving goal and often a map
objective (turn on power first), giving mid-game direction. Failure
mode: if the upgrade is purely numerical with no feedback it feels
flat — the *visual and audio* change is what sells the power.

**Trader/intermission economy.** Killing Floor's between-wave Trader
gives a timed window to buy/sell weapons, armor, and ammo at fixed
shops; players take zero damage during trader time. WHY it works: it
paces the game into tense-wave / calm-shop rhythm and forces loadout
planning under a clock. Failure mode: too-long intermissions kill
momentum; too-short ones feel stressful in the wrong way.

**Escalating wave composition & difficulty curves.** COD rounds scale
zombie health and speed; They Are Billions escalates to a climactic
final horde; Risk of Rain ties difficulty to a *time* meter that
scrolls through ten named scaling difficulties from "Very Easy" to
"HAHAHAHA," where every minute increases enemy power and spawn count —
a great sense of urgency. WHY it works: monotonic escalation guarantees
eventual death, which makes the high-score chase meaningful and creates
urgency. Failure mode: difficulty spikes (They Are Billions' final wave
is notoriously disproportionate to the rest of the game) feel unfair
rather than climactic.

**Special reward rounds.** COD's Max Ammo/Dog Round appears every 4–5
rounds: short, a distinct enemy (Hellhounds), and a guaranteed Max Ammo
drop at the end. WHY it works: it's a *pacing breather* and a reward
pulse that punctuates the grind, resets ammo anxiety, and varies the
visual/audio palette. Failure mode: if the special round is harder than
normal rounds without the payoff, it's a punishment, not a reward.

### Category C — Map Interaction

**Barricades / boarding windows.** COD's window barriers can be
repaired board-by-board (10 points per board, up to ~6 boards/60 points
per window) while zombies tear them down to climb through. WHY it
works: it creates a *repair-vs-shoot action economy* — every second
spent boarding is a second not shooting, and boards are also an early
income source, so the player constantly arbitrates between defense,
offense, and economy. This is the mechanic this project already
half-owns (windows + vaulting exist). Failure mode: if repairing is
strictly optional it's ignored; if zombies ignore boarded windows it's
busywork.

**Buyable doors / area unlocks.** Points open new areas (COD
debris/doors), gating the map so players expand their space
deliberately as they get richer. WHY it works: it turns the map into a
progression tree and a risk decision (more space = more escape routes
but more spawn points). Failure mode: linear unlock order with no
choice removes the strategy.

**Traps.** COD's Electro-Shock Defenses, the Shi No Numa Flogger (a
spinning spiked trap, ~750 points, ~30 s duration, instant-kill
regardless of round, with a cooldown), fire pits, and Killing Floor
welded doors. They Are Billions' shock towers can wipe ~30 zombies per
hit. WHY it works: traps are a *positional* spend sink — you buy area
denial and then herd enemies into it, converting money + map knowledge
into kills; the cooldown and self-damage risk (the Flogger kills
players too) keep them from trivializing combat. Failure mode: a
no-risk, no-cooldown trap becomes the only strategy.

**Power switch.** A one-time map activation that turns on perks, traps,
and Pack-a-Punch. WHY it works: it's a shared mid-game milestone that
gates the "real" economy and creates a first-objective goal. Failure
mode: in single-player it can be a trivial detour if it gates nothing
meaningful.

**Environmental kills & defensible positions.** Days Gone
traps/explosive barrels, WWZ funnel points. WHY it works: rewards map
mastery and turns the arena into a tool. Failure mode: one dominant
"god spot" collapses the game into camping.

### Category D — Player Kit

**Weapon variety & upgrade paths.** From wall pistols to Pack-a-Punched
wonder weapons; KF2 per-perk weapon tiers. WHY it works: a visible
power ladder gives the economy something to buy and the run a sense of
growth. Failure mode: too many sidegrade guns with no clear ladder
muddies decisions.

**Reload / ammo-management tension.** The Last Stand: Aftermath makes
every trigger-pull an ammo decision; COD's Max Ammo rounds exist
precisely because ammo scarcity is a core tension. WHY it works:
scarcity turns shooting into resource management and makes the Max Ammo
payoff feel great. Failure mode: too-scarce ammo is unfun;
too-plentiful removes the tension entirely.

**Melee fallback.** A guaranteed close-range option (COD knife, KF
Berserker) for when ammo runs dry. WHY it works: prevents helpless
"empty gun" death spirals and gives a points-economy tool (melee kills
award more in classic COD). Failure mode: if melee is strictly better
than guns the economy collapses.

**Movement abilities.** Krunker's slide-hopping/bunny-hopping momentum
tech, ULTRAKILL's dashes and rocket-riding, Stamin-Up sprint. WHY it
works: mobility is the primary skill-expression axis in browser FPS and
arena shooters — a high skill ceiling for kiting hordes. Failure mode:
movement tech tied to frame rate (Krunker's original slide bug) creates
unfairness; Krunker fixed this with a "Slide Control" setting so a
60-FPS player can match a 500-FPS player.

**Health systems.** Regen (modern COD), medkits/pills (L4D), armor
plates (Cold War), Juggernog-style max-HP boosts. WHY it works: the
health model dictates aggression — regen encourages peeking, consumable
health creates inventory decisions. Failure mode: a mismatched model
(regen in a survival economy game) removes attrition tension.

**Downed / last-stand states.** COD Last Stand: when downed you drop to
a pistol, bleed out over ~30 s, and can self-revive only with Quick
Revive (in solo play). WHY it works: it converts death into a tense
recoverable moment. Failure mode: in single-player without a revive
path it's just a delayed game-over unless designed as a genuine
second-chance (Quick Revive solo self-revive, comeback mechanics).

### Category E — Meta & Scoring Systems

**Score multipliers & combo/style meters.** ULTRAKILL's Style meter
runs through 8 ranks from Destructive up to ULTRAKILL, rewarding
*variety* and *speed*: repeating one weapon drops its "weapon
freshness" through four states — Fresh (1.5×), Used (1×), Stale (0.5×),
Dull (0×) — pushing constant experimentation, and a higher style rank
rewards a materially faster Hard Damage cooldown, making stylish play
more survivable. WHY it works: it turns scoring into a live feedback
loop that shapes moment-to-moment behavior toward flashier, riskier
play. Failure mode: opaque scoring the player can't parse gives no
feedback; decay that's too punishing feels stressful.

**Accuracy / headshot bonuses.** COD headshot point bonuses, KF2's crit
zones. WHY it works: rewards precision and gives skilled players an
economic edge. Synergizes directly with this project's existing
locational damage. Failure mode: if headshots are the *only* viable
income, non-precise players are locked out.

**Round-survival records.** COD "best round," Devil Daggers' single
global leaderboard where the only goal is survival time. WHY it works:
a single legible number is the purest "one more run" hook —
self-competition needs no content. This project already tracks
best-round. Failure mode: none significant; it's cheap and universally
effective.

**Challenges / achievements.** Vampire Survivors' huge achievement list
gives constant side-goals that funnel players through all content and
make even short runs feel productive. WHY it works: it manufactures
direction and an "illusion of plenty" cheaply. Failure mode: grindy or
luck-gated achievements frustrate.

**Run modifiers / mutators.** Back 4 Blood's Corruption Cards
(Director-drawn negative modifiers) + Active Cards (player buffs); KF3
Wave Mutations; Risk of Rain artifacts. WHY it works: modifiers change
*rules* not just stats — B4B's own designers observed that
rule-changing cards actually register with players, while small stat
bumps ("a 5 percent increase in move speed") go unnoticed by all but
the savviest. Failure mode: stat-only modifiers are invisible; too many
simultaneous ones become unreadable.

**Roguelite between-run progression.** Vampire Survivors banks gold to
buy permanent PowerUps (small individually, cumulatively about 2.5×
damage and at least 2× health), eliminating "zero-progress" runs so
every death still advances you. WHY it works: it removes the sting of
failure and keeps players re-queuing. Failure mode: over-strong meta
progression trivializes skill; too-slow feels grindy.

**The AI Director (dynamic pacing).** L4D's Director spawns enemies,
items, and hordes based on a live "Survivor Intensity" metric, forcing
calm → build-up → peak → relax cycles ("structured unpredictability")
instead of fixed spawns. KF2's Game Conductor (weighting average perk
level 0.25, average accuracy 0.25, ZED lifespan 0.5) and B4B's Director
do the same. WHY it works: it defeats memorization and personalizes
difficulty, keeping tension in a designed band. Failure mode: an
over-eager director that punishes success feels adversarial; players
sense "rubber-banding."

---

## PART 2 — Curated Candidate Passes

Every entry is filtered for: code-generated geometry/audio only,
single-player, registry-friendly, and buildable as one tested pass or a
short named series.

**Technical feasibility note (confirmed against the actual stack).**
Both foundations these depend on are standard, asset-free capabilities
in three.js r185 + plain ES modules:
- **Procedural audio** (jingles, warning tones, purchase chimes,
  headshot dings) via the Web Audio API — `AudioContext` +
  `OscillatorNode` (sine/square/triangle/sawtooth) through a `GainNode`
  whose gain is envelope-shaped with `setValueAtTime()` /
  `linearRampToValueAtTime()` / `exponentialRampToValueAtTime()`. The
  one real gotcha is the browser **autoplay policy**: an `AudioContext`
  starts suspended and produces no sound until `resume()` is called
  from a user gesture — trivially satisfied by the game's start click.
- **Procedural visuals** — upgrade tints/elite recolors via
  `Material.color` and `MeshStandardMaterial.emissive`/
  `.emissiveIntensity`; HUD icons and procedural textures via
  `THREE.CanvasTexture` from a code-drawn canvas (redraw +
  `texture.needsUpdate = true`); all animation via per-frame transform
  updates in the existing render loop. No image or audio files required
  for any recommendation here.

### Tier 1 — High payoff, low scope (build these first)

**1. Points economy (per-kill) + kill-value registry**
- *Pitch:* Award a spendable currency per kill (with a
  headshot/locational bonus) that everything else spends.
- *Source:* COD Zombies points economy (post-Cold War per-kill model,
  to avoid leg-shot farming).
- *Translation:* Extend the existing scoring system to a spendable
  currency. Per-kill value is a field in `enemyTypes.js` so every new
  enemy auto-carries an economic weight. Headshot/leg-hit bonus reuses
  the existing locational-damage hit data. Pure numeric + HUD; no
  assets.
- *Scope:* 1 pass (currency + HUD counter), building on kill scoring.
- *Payoff/synergy:* The keystone — the prerequisite that makes
  wall-buys, perks, traps, and the upgrade station meaningful. Turns
  every trigger pull into a spend-vs-save decision. Synergizes with
  locational damage (precision = income).
- *Priority:* **Highest — build first; it unlocks Tiers 1–2.**

**2. Special reward round (dog-round pacing break)**
- *Pitch:* Every N rounds, a short round of a distinct fast enemy that
  ends with a guaranteed Max-Ammo pulse.
- *Source:* COD Max Ammo/Hellhound round.
- *Translation:* A round-type flag in the wave scheduler; spawn a fast,
  low-HP "hound" (box-mesh tinted via `emissive`); the existing fog
  sells the atmosphere, and a code-generated warning tone (oscillator
  sweep) announces it. Max-Ammo = weapon refill on last kill.
- *Scope:* 1 pass (special-round scheduling + reward), +0.5 if adding
  the hound as a new registry entry.
- *Payoff/synergy:* Resets ammo anxiety, varies pacing/palette,
  delivers a reward pulse. Uses existing fog + registry + flow fields;
  the hound is just a fast registry entry.
- *Priority:* **High — cheap, high felt-impact.**

**3. Enemy-archetype expansion (sprinter, brute, exploder, spitter)**
- *Pitch:* Add 3–4 behaviorally distinct enemies as registry entries,
  each asking a different question.
- *Source:* L4D special infected; They Are Billions "Chubby"; COD
  flaming hounds.
- *Translation:* Each is a data entry in `enemyTypes.js` with tuned
  speed/HP/scale and one behavior flag: **sprinter** (high speed, low
  HP), **brute** (high HP, large box mesh, slow — breaks camping
  stalemates), **exploder** (on-death code-drawn blast that damages the
  player, reusing blood-effect tech), **spitter** (ranged projectile
  via a small code-generated sphere on an arc). Recolor via
  `Material.color`/`emissive`; per-type audio cue via oscillator.
  Flow-field navigation, window vaulting, and locational damage apply
  automatically.
- *Scope:* 2–3 passes: "pass A: sprinter + brute (stat/scale
  variants)," "pass B: exploder (on-death AoE)," "pass C: spitter
  (ranged attack)."
- *Payoff/synergy:* Turns homogeneous hordes into layered decisions.
  Locational damage already lets brutes have weak points and exploders
  be leg-crippled into crawlers. The single biggest depth-per-pass
  lever because the registry does the heavy lifting.
- *Priority:* **High — directly leverages the game's best existing
  systems.**

**4. Combo / style scoring meter + best-round record polish**
- *Pitch:* A decaying multiplier that rewards fast, varied, precise
  kills, feeding the score and a praise pulse.
- *Source:* ULTRAKILL Style meter; COD headshot bonuses; Devil Daggers
  survival record.
- *Translation:* A timer-based multiplier that rises with
  rapid/headshot/varied kills and decays on idle; drives the existing
  score and praise popups. HUD meter via `CanvasTexture` or DOM;
  escalating chime via oscillator (higher pitch at higher rank).
  Optionally borrow ULTRAKILL's "weapon freshness" once there are
  multiple weapons, to reward variety.
- *Scope:* 1–2 passes: "pass A: combo timer + multiplier + HUD," "pass
  B: rank tiers + audio pitch-up."
- *Payoff/synergy:* Converts scoring into a live behavioral loop; pairs
  with praise popups and existing best-round tracking. Rewards the
  locational-damage precision the engine already computes.
- *Priority:* **High — amplifies the scoring cluster.**

### Tier 2 — High payoff, medium scope (build after the economy exists)

**5. Wall-buy weapon/ammo stations**
- *Pitch:* Fixed map locations where points buy a specific weapon or
  refill ammo.
- *Source:* COD wall-buys.
- *Translation:* A data-driven registry of "buy spots" (position + item
  id + price), rendered as a code-drawn chalk-outline panel
  (`CanvasTexture`) on the buildings that already exist. Ammo costs
  ~half the weapon price. Prereq: points economy (#1) and >1 weapon.
- *Scope:* 2 passes: "pass A: buyable weapon/ammo entity + prompt,"
  "pass B: multi-weapon inventory support if not present."
- *Payoff/synergy:* Anchors the early economy and gives the village map
  economic geography. Registry-driven, so new weapons auto-appear as
  buy options.
- *Priority:* **High (after #1).**

**6. Upgrade station (simplified Pack-a-Punch)**
- *Pitch:* One machine that, for a big fee, applies a stat multiplier
  and a visual tint to your weapon.
- *Source:* COD Pack-a-Punch.
- *Translation:* A single code-generated machine mesh; interacting
  spends points and applies a damage/fire-rate multiplier plus a
  procedural `emissive` tint, a brighter muzzle flash, and a
  synthesized upgrade jingle. The explicit "translate ambitious
  mechanic simply" case — no new weapon models, just a multiplier +
  tint.
- *Scope:* 1–2 passes: "pass A: upgrade station entity + stat
  multiplier," "pass B: visual tint + jingle."
- *Payoff/synergy:* A satisfying mid-game power spike and a big
  save-goal. The visual/audio change (cheap here) is what sells the
  power. Prereq: points economy.
- *Priority:* **High (after #1).**

**7. Trap entities (electro-fence / spinning trap)**
- *Pitch:* Buyable, cooldown-gated area-denial that instant-kills or
  heavily damages hordes funneled into it.
- *Source:* COD Flogger/Electro-Shock; They Are Billions shock tower.
- *Translation:* Trap = registry entity (position, price, duration,
  cooldown, damage). Effect is code-drawn (electric arcs / spinning
  box) + oscillator zap SFX. Herds zombies via existing flow fields.
  Optionally damages the player (Flogger-style risk) to preserve
  tension.
- *Scope:* 2 passes: "pass A: single trap type + activation/cooldown,"
  "pass B: second trap type + player-damage risk."
- *Payoff/synergy:* Converts points + map knowledge into kills;
  flow-field herding + window choke points make traps naturally strong.
  Registry-friendly.
- *Priority:* **Medium-high (after #1).**

**8. Window-boarding repair economy**
- *Pitch:* Let the player repair boarded windows board-by-board for
  points, trading shooting time for defense + income.
- *Source:* COD barrier repair.
- *Translation:* The game *already* has windows and zombies that vault
  them — add board entities (code-drawn planks) with a per-board repair
  action, a small point reward per board, and zombie tear-down that
  reuses the vault logic.
- *Scope:* 1–2 passes: "pass A: board state + repair action + points,"
  "pass B: zombie tear-down timing tuning."
- *Payoff/synergy:* The mechanic the game is *closest* to already
  owning; directly deepens the existing window/vault system into a
  repair-vs-shoot action economy. Pairs with points economy for early
  income.
- *Priority:* **Medium-high — unusually low marginal cost given
  existing window tech.**

### Tier 3 — Good payoff, larger or dependent scope

**9. Perk stations (persistent buffs)**
- *Pitch:* Vending machines selling permanent-until-death buffs (max
  HP, faster reload, faster movement).
- *Source:* Perk-a-Colas (Juggernog/Speed Cola/Stamin-Up).
- *Translation:* Perks as a data registry (id, price, stat effect, HUD
  icon via `CanvasTexture`); machine meshes code-generated; purchase
  chime via oscillator. Buffs are stat modifiers. Prereq: points
  economy.
- *Scope:* 2–3 passes: registry + one machine + buff application; HUD
  perk icons; additional perks.
- *Payoff/synergy:* Build expression and a major spend sink. Registry
  means new perks auto-flow through menu/icon systems. Avoid the
  "crutch perk" trap by keeping HP boosts modest.
- *Priority:* **Medium.**

**10. Intensity-tracking spawn modulator (simplified AI Director)**
- *Pitch:* A single value that tracks recent player stress and
  modulates spawn rate to create build-up/relax cycles.
- *Source:* L4D AI Director / KF2 Game Conductor.
- *Translation:* Track a rolling "intensity" scalar (damage taken vs
  kills per unit time); when high, throttle spawns briefly; when low,
  push a mini-horde. The explicit simplified translation — no nav-mesh
  Active Area Set, just a scalar feeding the existing wave spawner.
- *Scope:* 1–2 passes: "pass A: intensity scalar + spawn-rate
  modulation," "pass B: mini-horde trigger on low intensity."
- *Payoff/synergy:* Defeats rote memorization and self-balances
  difficulty. Plugs into the existing spawn system with no new assets.
- *Priority:* **Medium — high elegance; tune carefully to avoid feeling
  adversarial.**

**11. Run modifiers / mutators (single-player card draw)**
- *Pitch:* Between rounds, draw a rule-changing modifier (a buff you
  pick, or an escalating hazard).
- *Source:* B4B Corruption/Active cards; KF3 Wave Mutations.
- *Translation:* A modifier registry (id, effect, description via
  canvas). Offer a choice of 2–3 buffs each round (Active-card style)
  and optionally inject one escalating hazard (Corruption-style). Favor
  *rule* changes ("shoot while sprinting") over stat tweaks —
  rule-changing cards register with players; small stat bumps don't.
- *Scope:* 2–3 passes: registry + between-round choice UI; hazard
  modifiers; more entries.
- *Payoff/synergy:* Replayability and build variety with pure data
  entries. Synergizes with roguelite meta.
- *Priority:* **Medium.**

**12. Buyable doors / area unlocks**
- *Pitch:* Spend points to open new areas of the village.
- *Source:* COD debris/doors.
- *Translation:* Barrier entities (position, price) that remove a
  blocker and open flow-field paths. Prereq: points economy + a map
  with gateable regions.
- *Scope:* 1–2 passes.
- *Payoff/synergy:* Progression geography and risk decisions (more
  space, more spawns). Cheap given existing map/flow-field.
- *Priority:* **Medium.**

**13. Roguelite meta progression**
- *Pitch:* Bank a soft currency across runs to buy small permanent
  starting-stat upgrades.
- *Source:* Vampire Survivors PowerUps.
- *Translation:* Persist a currency in `localStorage`; a menu of small
  stat upgrades (registry entries). No server, no assets.
- *Scope:* 2 passes: persistent currency + meta menu; upgrade entries +
  application at run start.
- *Payoff/synergy:* Eliminates zero-progress runs and drives
  re-queuing. Registry-friendly.
- *Priority:* **Medium — best added once there's enough in-run content
  to progress toward.**

**14. Mystery Box (slot machine)**
- *Pitch:* A fixed-price box that grants a random weapon with a jingle
  and light beam.
- *Source:* COD Mystery Box.
- *Translation:* Box entity; on purchase, cycle a code-drawn weapon
  icon (`CanvasTexture`) with a jingle (oscillator) and a light beam
  (code-drawn), then grant a random weapon from the registry. Prereq:
  points economy + a weapon pool worth randomizing.
- *Scope:* 1–2 passes.
- *Payoff/synergy:* The variable-ratio dopamine loop. Only worthwhile
  once the weapon pool is large enough that randomness is interesting —
  otherwise it's a worse wall-buy.
- *Priority:* **Medium-low — gate behind having ≥4–5 weapons.**

**15. Downed / second-wind state (single-player)**
- *Pitch:* Instead of instant game-over, drop to a pistol and a
  bleed-out timer with one self-revive chance.
- *Source:* COD Last Stand + Quick Revive (solo self-revive).
- *Translation:* On a lethal hit, enter a downed state (reduced
  movement, pistol only, code-drawn screen tint, bleed-out timer). A
  one-per-round self-revive (earned or perk-gated) gives a genuine
  comeback. Must be a *real* second chance, not a delayed death, since
  there are no teammates.
- *Scope:* 2 passes: downed state + bleed-out; self-revive condition.
- *Payoff/synergy:* Converts death into a tense recoverable moment.
  Pairs with a perk (#9) as the self-revive gate.
- *Priority:* **Medium-low.**

### Explicitly NOT Recommended (poor fit for stack/solo scope)

- **Full L4D-style asymmetric special-infected roster (playable
  infected / Versus).** Requires multiplayer infrastructure; the *AI*
  side is captured by the archetype expansion (#3).
- **Co-op revive economy / teammate sharing.** The entire tension
  depends on other players; no meaningful single-player translation
  beyond the solo self-revive (#15).
- **World War Z / Days Gone 500-strong swarm + zombie pyramids.**
  Rendering and pathing hundreds of individually simulated
  code-generated meshes in a browser is a performance non-starter; the
  *funneling* tension is better served by traps + choke points (#7).
- **Elaborate Easter-egg quest chains & map-specific Wonder Weapons.**
  Asset- and content-treadmill heavy — the opposite of the
  registry/one-pass philosophy.
- **Weld-door / build-the-defense meta (KF welding, They Are Billions
  base-building).** A different genre's economy; the
  defensible-position core is covered more cheaply by window-boarding
  (#8) and traps (#7).
- **Frame-rate-tied movement tech (Krunker slide-hopping as-is).**
  Momentum tech is welcome, but tie it to delta-time, not frame rate —
  Krunker itself had to patch this.
- **Full dynamic-music Director (L4D Music Director).** Layered
  adaptive music from code-generated audio is high-effort for low
  gameplay payoff; a single synthesized special-round/boss cue (#2)
  captures most of the value.

### Recommended build order (report's own — see handoff §0 for the ADOPTED order)
1. **Points economy (#1)** — the keystone that unlocks everything.
2. **Special reward round (#2)** and **enemy-archetype expansion
   (#3)** — highest felt-impact per pass.
3. **Combo/style meter (#4)** — amplifies the scoring cluster.
4. **Wall-buys (#5)**, **upgrade station (#6)**, **window-boarding
   economy (#8)** — flesh out the spend loop.
5. **Traps (#7)**, **perks (#9)**, **intensity director (#10)** —
   deepen tactics and pacing.
6. **Mutators (#11)**, **doors (#12)**, **roguelite meta (#13)**,
   **mystery box (#14)**, **downed state (#15)** — replayability and
   long-tail depth.

**Thresholds that would change this order:** if the game only ever has
1–2 weapons, deprioritize wall-buys/mystery box/upgrade station and
lean into enemy variety + scoring; if playtests show the game is too
easy, prioritize the intensity director (#10) and the brute/exploder
archetypes; if retention is the problem, jump the roguelite meta (#13)
and challenges forward.
