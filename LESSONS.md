# LESSONS.md — error record (feeds the dev-method)

A queue, not an archive: when something breaks or surprises us, it gets a short
entry here. Dev-method skill sessions harvest routed entries into skill/GI
updates and mark them `HARVESTED — <date>` (or delete them).

## 2026-07-11 — Browser import maps are invisible to the Node test suite [HARVESTED — 2026-07-12]

- What broke / what happened: the planned import map (`"three"` →
  `./lib/three.module.js`) would have left every `src` module unimportable by
  the committed Node suite — bare `'three'` doesn't resolve in Node. Caught at
  shell-pass build time, before delivery.
- Root cause: import maps are a browser-only resolution mechanism; the
  module-health suite runs in Node.
- Verification gap it exposed: none shipped — designing the suite first is what
  surfaced it.
- Plug shipped: relative imports everywhere (`../lib/three.module.js`);
  DESIGN.md v1.1 records the decision; the suite exercises the real import
  chain on every run.
- Route: skill reference (html-game.md) candidate — "vendored ES-module libs:
  prefer relative imports over import maps when a committed Node import suite
  exists."

## 2026-07-11 — NaN light intensity blacks out every lit material (unlit survives) [HARVESTED — 2026-07-12]

- What broke / what happened: the first shot set `flashLight.intensity` from a
  CONFIG constant that wasn't in the running file (the paste-in hadn't landed
  at CONFIG's top level) → `undefined` → NaN in the lighting sum → every
  `MeshStandardMaterial` surface rendered black, INCLUDING emissive targets;
  the unlit `GridHelper` survived. The flash quad froze at full opacity because
  its fade branch is `flashT < CONFIG.FLASH_MS` and `0 < undefined` is false.
  Zero console errors, zero exceptions.
- Root cause: code reading config keys that didn't exist in the running module;
  NaN propagates silently through GPU lighting.
- Verification gap it exposed: "the suite catches a bad paste" was only true
  for SYNTAX damage — a paste that lands in the wrong block, or never lands,
  parses fine and sails through. The suite proved the file parsed, not that
  the constants existed.
- Plug shipped: suite Section 5 — a config schema (every required key present,
  numbers finite, strings non-empty, STREAK_TIERS descending; extend when
  adding constants) PLUS a text scan of every literal `CONFIG.<path>` read
  across src (including main.js), failing any that don't resolve; a ≥15-reads
  floor guards the scanner itself. Proven to fire on the exact incident
  (deleting FLASH_INTENSITY fails twice, naming the reading file).
- Route: skill reference (html-game.md) candidate — extends the existing
  "Canvas draws nothing on NaN coordinates" diagnostic to WebGL: *scene
  suddenly black but unlit materials (grid/line/basic) still visible = a NaN
  light uniform; check the last-touched light value first.* Corollary:
  paste-in config edits need an existence probe, not just a parse.

## 2026-07-11 — the missing-key class struck twice: config (again) and its registry twin was still open [HARVESTED — 2026-07-12]
- What broke / what happened: first W press → black screen, HUD/reticle
  alive, zero console errors. The movement config paste
  (PLAYER.MOVE_SPEED / WALL_MARGIN / BODY_RADIUS) hadn't landed →
  `speedMps` undefined → NaN camera position → NaN view matrix. Suite
  Section 5 (built from the NaN-light incident) named all three keys on
  its first run and the fix was one paste. Bonus find in the same suite
  output: `DEBUG: { SPAWN_ZOMBIE: true }` still present — the pass-5a
  retirement edit had ALSO never landed, invisible because nothing reads
  the flag, but armed to fail the SHIP gate at deploy time.
- Root cause: the same class as 2026-07-11 (NaN-light) — paste-in edits
  are unverified landings; dead-but-harmless misses (the DEBUG line)
  evade even symptom-based discovery.
- Verification gap it exposed: (1) the registry-side twin was still
  open — the leaf sweep validates fields that EXIST; a MISSING registry
  field (e.g. BODY_RADIUS) NaNs identically and was invisible; (2) a
  RETIRED config key has no guard at all — nothing asserts absence.
- Plug shipped: enemy-registry required-keys schema in Section 5
  (28 numeric fields per type, extend with the registry), negative-
  tested by name (`proto_zombie.BODY_RADIUS got undefined`, exit 1).
  Retired-key absence remains unguarded — accepted: the SHIP gate
  catches truthy DEBUG leftovers, and stale keys are inert by
  convention (config is read-only via CONFIG.<path> scans).
- Route: dev-method candidate — after any paste-in edit, run the suite
  BEFORE playing (testing step 1 exists precisely for this class); a
  diagnostic signature earns its keep the second time it fires.

## 2026-07-12 — camera-space sign flip put the ejection port behind the gun [HARVESTED — 2026-07-12]

- What broke / what happened: brass casings visibly popped out of the gun's
  REAR. The port was computed as `OFFSET_Z + PORT_FWD` with `PORT_FWD: 0.2` —
  but camera space runs **−Z forward**, so a positive "forward" offset walked
  the port backward toward the eye. The config comment said "toward the
  muzzle" while the sign did the opposite. Caught by Daniel in play; no check
  could have seen it.
- Root cause: a signed offset in a frame whose forward axis is negative reads
  naturally and points backward; the value was derived by feel instead of
  read from the geometry it claimed to match.
- Verification gap it exposed: FX anchor points aren't tied to the geometry
  they reference — the true muzzle position already existed as a literal in
  gun.js (`flash.position` at gun-local `(0, 0.03, -0.45)`) and the port
  should have been read from it, not re-invented.
- Plug shipped: port re-anchored to the measured muzzle-flash point
  (`PORT_UP: 0.03`, `PORT_FWD: -0.45`), sign convention documented next to
  the value; handoff MEASURED list gains the frame convention (−Z forward,
  "forward" offsets are negative).
- Route: dev-method / html-game.md candidate — *when placing FX relative to
  existing geometry, read the anchor from the geometry's source file; never
  re-derive by feel. The sign convention of the frame goes in the comment
  beside the value.*

## 2026-07-12 — Claude-side: `git pull` aborts on sandbox scratch copies but prints `Updating x..y` [HARVESTED — 2026-07-12]

- What broke / what happened: twice in one session, `git pull` in Claude's
  working clone ABORTED on untracked-file collisions — the delivery files
  Claude had applied locally for testing are, by construction, the same files
  arriving in Daniel's next push — while still printing an optimistic
  `Updating old..new` line. Both times the existing tip-verification rule
  (`git log -1` + grep one changed value) caught the stale tree before any
  work built on it.
- Root cause: applying deliveries in the clone for suite runs guarantees a
  collision with the very push that ships them; pull's abort output is easy
  to misread under tail-truncation.
- Verification gap it exposed: none new — the handoff's "a pull can abort and
  still print Updating x..y" rule worked as designed; but the recovery was
  re-derived ad hoc the first time.
- Plug shipped: session-hygiene rule — after any delivery, Claude's clone
  never `git pull`s; it always runs `git fetch origin && git reset --hard
  origin/main`, then verifies the tip, greps one value known to have changed,
  and confirms the key docs still exist.
- Route: dev-method candidate (session-hygiene / git section) — *a clone that
  applies deliveries locally must sync by fetch+reset, never pull.*

## 2026-07-12 — a checkpoint block without `git push` desynced the remote (Daniel copies blocks verbatim) [HARVESTED — 2026-07-12]

- What broke / what happened: a delivered git-checkpoint block ended at
  `git commit` — no `git push` line. Daniel copies checkpoint blocks
  verbatim (by design; that's what they're for), so the commit landed
  locally and the remote stayed one behind. Caught one round later by the
  standing provenance check: the fetch showed HEAD still at the previous
  pass while Daniel reported "pushed" — a stop signal, and building on the
  stale base would have delivered a file that silently ERASED the very fix
  he was playtesting.
- Root cause: the checkpoint ritual is a COPY-PASTE INTERFACE, not prose —
  an omitted line is an omitted action, every time.
- Verification gap it exposed: none new — the "verify tip + one changed
  value" rule caught it before any work built on the stale tree; but the
  omission itself had no guard.
- Plug shipped: every checkpoint block is copy-complete — `git status`,
  add, commit, `git push`, nothing implied. When a report ("pushed") and
  the remote disagree, STOP and reconcile before building; never assume
  which side is right.
- Route: GI candidate (git workflow — checkpoint blocks are interfaces;
  ship them complete) + the stop-signal rule already in place, reaffirmed.

## 2026-07-12 — scaling an ACCUMULATED phase by a changing blend = whole-body shake (integrate rates, never scale phases) [HARVESTED — 2026-07-12]

- What broke / what happened: gating the idle-sway term as
  `t · IDLE_FREQ · (1 − legBlend)` made every zombie SHAKE violently the
  moment it was shot or began an attack. `t` is total elapsed time — a
  minute in, that term is ~108 radians — and `legBlend` moves 0↔1 over
  ~150 ms on stagger/attack, so the sway PHASE swept dozens of radians in
  a few frames: rotation.z oscillated wildly exactly on the two triggers
  Daniel reported.
- Root cause: a phase is an integral. Multiplying an accumulated phase by
  a time-varying factor rewrites history; the correct gate scales the
  RATE: `idlePhase += dt · IDLE_FREQ · (1 − legBlend)` — continuous by
  construction, blends can only slow or speed the advance, never jump it.
- Verification gap it exposed: none automatable pre-browser — the defect
  lives in visual dynamics; the suite cannot see "shakes". The plug is a
  coding rule, not a probe.
- Plug shipped: per-enemy `idlePhase` accumulator (7a.7); the sway reads
  `sin(walked·F + idlePhase)`.
- Route: dev-method / html-game.md candidate — *any blended periodic
  signal gates its RATE, never its accumulated phase; if a formula
  multiplies elapsed-total-time by anything that changes per frame, it's
  wrong.*

## 2026-07-12 — animation feel is a multi-round loop by nature; probes catch slips, only eyes catch reads [HARVESTED — 2026-07-12]

- What happened (not a defect — a calibrated expectation): the shambler
  gait took EIGHT feel rounds (7a.1–7a.8 + two tunes) to land: leg swing →
  joints → sway lock → cadence → limp → dip → shin drag → literal pinned
  drag + weight shift. Every round was one named mechanism and one lever,
  and every round moved it closer; none of that iteration was rework.
- What the instruments DID catch, immediately and cheaply: the Section 11
  geometry probes flagged the arm rest-pose authoring slip (REST_RAD 1.25
  pointed the "dangle" upward) on their very first run, and hand-checking
  a stack expression caught a foot floating a foot-height high before any
  run. The sign/parenting/ground-contact class is fully probeable.
- What they can never catch: "reads as skipping", "sways like gliding",
  "should drag like a real injured leg" — display-read judgments. The
  browser is the only instrument, and Daniel's specific naming of what he
  saw ("skip", "glide", "the part below the knee") was the diagnostic
  input every round.
- Route: dev-method candidate (feel protocol corollary) — *budget
  animation features as an iteration LOOP (mechanism + one lever per
  round), ship geometry probes with the first round, and after ~5 rounds
  without convergence consider an approach rethink — this one converged,
  so the single-lever discipline held.*

## 2026-07-12 — every renderer.render() repaints scene.background: the gun's overlay pass wiped the world (black screen) [HARVESTED — 2026-07-12]

- What broke / what happened: pass 4.2b moved the gun viewmodel to a
  second render pass (world → clearDepth → gun on layer 1) to stop it
  clipping through walls. In three.js, EVERY render() call draws
  scene.background first — so the gun pass repainted the whole frame with
  sky colour and drew only the gun on top. Symptom: world pitch dark, HUD
  (DOM) alive, gun visible and lit. Daniel hit it in the browser
  immediately after an all-green suite run.
- Root cause: the overlay pass inherited the scene's background paint.
  Canonical two-pass viewmodel pattern, canonical gotcha — the overlay
  pass must render with scene.background nulled and restored.
- Verification gap it exposed: render-path changes are INVISIBLE to the
  Node suite — no WebGL in the sandbox, so the browser is the first
  renderer to ever execute them. The suite stayed green through the
  entire defect.
- Plug shipped: background null/restore around the gun pass. Process
  plug: any render-path delivery names itself as suite-invisible in its
  testing steps and puts the visual check FIRST — the browser test is
  not a formality there; it is the only test.
- Route: dev-method / html-game.md candidate — *multi-pass rendering:
  null scene.background on every pass after the first; treat render-path
  changes as browser-first deliveries.*

## 2026-07-12 — thin boundary colliders eject bodies to the WRONG side (probe caught it pre-ship) [HARVESTED — 2026-07-12]

- What happened (a probe win, not a shipped defect): making the map fence
  solid, the first implementation used thin boxes on the boundary line.
  The suite probe written alongside it ("a body ON the line resolves
  INWARD") failed on its first run: min-penetration resolution against a
  thin box exits through the shallowest face — for a body centred on a
  0.15 m box that's out the FAR side half the time, ejecting the player
  off the map (and thin geometry is tunnel-able at speed besides).
- Fix shipped: boundary colliders are THICK one-sided bands — inner face
  exactly at the visible line, a metre of invisible solid extending
  outward — so the shallowest exit is always inward and there is nothing
  to tunnel through.
- The general shape: any one-sided barrier (fences, map edges, kill
  walls) collides as a thick band on its far side, never as thin
  geometry; and the probe to ship WITH it asserts the eject DIRECTION,
  not just non-overlap.
- Route: dev-method / html-game.md candidate — *one-sided barriers =
  thick outward bands + an eject-direction probe.*

## 2026-07-12 — a body's collision proxy must be MEASURED against the built body (anisotropic clip) [HARVESTED — 2026-07-12]

- What broke / what happened: zombies' front halves (raised arms + hunched
  head) clipped through walls they faced once 4.3 sent them inside rooms.
  The feet circle (BODY_RADIUS 0.45) was honest sideways (body half-width
  0.31) and wildly wrong forward (MEASURED 0.92 rest / 1.02 with the walk
  lean — Box3 over the built group in Node).
- Root cause: an isotropic proxy (one circle) for a long, forward-pointing
  shape; the mismatch was latent from pass 7 and only became visible when
  navigation put bodies against walls at close range.
- Verification gap it exposed: nothing ever compared the BUILT body's
  extents to the collider the registry claims for it.
- Plug shipped (fix + sweep + guard): `resolveBodyWithReach` — feet circle
  + a small forward reach circle at the arm tips (guarded registry `WALL`
  block; reach 0 = byte-identical no-op); suite probes head-on standoff =
  REACH+RADIUS exactly, parallel slide unchanged, doorway transit
  undisturbed, and a doorway-passability invariant on any type with the
  block.
- Route: skill reference (html-game.md) — "measure the built artifact's
  extents against its collision proxy; anisotropic bodies need more than a
  radius, and the fix must keep doorways passable."

## 2026-07-12 — assigning orientation to a QUANTIZED target teleports it (rate-limit through the angle) [HARVESTED — 2026-07-12]

- What broke / what happened: flow-field directions are 8-way quantized;
  `rotation.y = atan2(...)` (fine when tracking the continuously-moving
  player) snapped bodies 45–90° at every cell boundary and at the
  field↔beeline handoff.
- Root cause: instant assignment only LOOKS smooth when the target itself
  moves smoothly; discretize the target and the assignment becomes the pop.
- Plug shipped: pure `turnToward(current, target, maxStep)` — shortest arc
  via `atan2(sin Δ, cos Δ)` (no modulo seam bugs), clamped per frame by
  `NAV.TURN_RATE`; the ONLY writer of enemy yaw. Probes: clamp, symmetry,
  exact arrival, ±π seam crossing, no-op.
- Route: skill reference (html-game.md) — "any orientation driven by a
  quantized source gets a rate-limited turn, wrap via atan2(sin,cos)."

## 2026-07-12 — proximity measured THROUGH walls: one root, two faces (frozen beeline, corner swipes) [HARVESTED — 2026-07-12]

- What broke / what happened: (1) zombies froze when the player tucked in a
  corner; (2) swipes landed across wall corners. Node repro falsified the
  first hypothesis (the stop ring) and named the real one: inside
  BEELINE_DIST straight-line but LOS-blocked, the zombie beelines dead-on
  into a wall — a face-on pushout has no tangential component, so it
  shambles in place forever. The corner swipe was the same defect at
  attack range (diagonal distance < 2.5 across a corner).
- Root cause: every proximity decision (beeline switch, stop ring, attack
  start, damage landing) compared straight-line distance with no
  line-of-sight test.
- Verification gap it exposed: the nav suite proved the FIELD; nothing
  probed the distance-based decisions against blocking geometry.
- Plug shipped: pure `segmentClearOfAABBs` (2D slab test); one `los` per
  zombie per frame gates all four decisions; suite probes segment cases +
  village wall-blocked / doorway-clear; Node repros re-run as the fix's
  evidence (freeze → routes out the door; zero hits while corner-blocked).
- Route: SKILL.md earned-rule candidate — "near solid geometry, any
  distance-triggered behavior needs an LOS gate; and reproduce in the
  runtime you can instrument BEFORE naming the mechanism — the first
  hypothesis here was wrong."

## 2026-07-12 — the probe mimicked the defect: an unpinned probe input "killed" nothing [HARVESTED — 2026-07-12]

- What broke / what happened: the mid-vault-kill probe FAILED with the
  corpse 1.44 m from the expected snap point. The code was right — the
  probe's `traverse`-first mesh was a LIMB (0.5 dmg × 3 = 1.5 < HP 3): the
  zombie never died, and the measured offset was exactly mid-vault drift
  minus 3 × KNOCKBACK. Arithmetic on the observed delta identified the
  probe, not the code.
- Root cause: an unpinned probe input (whichever mesh traverse finds
  first) silently selected a different test than intended.
- Plug shipped: probes now pin the part by tag (`userData.part ===
  'head'`) and assert the kill result explicitly (`result?.killed`).
  Related capture from the same session: two DRAFTED DEAD TERMS (`* 0`
  tail, an always-true clause) reached files and were caught by continuity
  /exact-value review before delivery — exactness probes are what catch
  them.
- Route: SKILL.md earned rule refinement — "one probe, one claim" extends
  to INPUTS: pin every probe input by identity, never by iteration order;
  and review formulas/assertions for dead terms — an exact-value probe
  catches what a threshold probe forgives.

## 2026-07-12 — a proximity trigger INSIDE a collision standoff can never fire (ordering as a named invariant) [HARVESTED — 2026-07-12]

- What broke / what happened: nothing shipped — designed around during
  4.3b. The vault trigger fires at a distance from the window; the reach
  probe holds the body at CELL/2 + REACH + RADIUS (1.8 m). A trigger
  radius below the standoff is unreachable: zombies would press sills
  forever — the same freeze class as the beeline fix, one pass later.
- Root cause: two independent numbers (a trigger radius, a collision
  standoff) with a hidden ordering requirement between them.
- Plug shipped: `VAULT_TRIGGER (2.0) > standoff (1.8)` asserted BY NAME in
  the suite for every type that both climbs and reaches — a mistune fails
  before it plays.
- Route: skill reference (html-game.md) — "when a trigger distance and a
  collision standoff coexist, encode their ordering as a named suite
  invariant; a silent violation is a freeze, not an error."

## 2026-07-12 — `node --check` passes a MISSING import; the un-importable entry file is where it hides [HARVESTED — 2026-07-12]

- What broke / what happened: 4.3c's `pickEntry` in main.js referenced
  `WAVES` with no import. `node --check` passed (parse only, no binding
  analysis — the already-recorded limit, now in its third shape: dup
  import, doubled brace, and now a MISSING binding). The standing plug —
  actually running the module import — cannot run on main.js (canvas/DOM
  deps), so the entry file is EXACTLY where binding errors survive both
  gates. Caught pre-delivery by a grep whose empty output was the signal.
- Root cause: the one file that can't be import-executed is the one file
  every wiring pass touches.
- Plug shipped: when adding any new identifier to a DOM-coupled file,
  grep-verify its import in the same breath ("silence where output was
  expected is a failure signal" — the edit-script rule, applied to
  imports). Related probe-catch, same pass: spawning a body INSIDE its
  own collision standoff produces a frame-one settling scoot — spawn AT
  the standoff (corollary of the trigger-vs-standoff ordering entry).
- Route: dev-method / html-game.md — "for files the import-run can't
  reach, grep every new identifier's import before delivery."

## 2026-07-12 — two checkpoint blocks in one message: only the second ran, and `git add .` swallowed the first pass [HARVESTED — 2026-07-12]

- What broke / what happened: the 4.3b.2 pass checkpoint and the docs
  checkpoint were delivered in the same message, sequenced by prose.
  Only the docs block was run; its `git add .` faithfully staged the
  climb-pose code, so one commit contains both the pass and the wrap.
  Nothing lost (tree correct, suite green) — but the history is
  mislabeled and the one-pass-per-commit record broke. The prose warning
  ("if any src file shows, STOP") did not survive contact.
- Root cause: `git add .` is the swallowing mechanism; prose sequencing
  is not a mechanism at all.
- Plug shipped: docs-only checkpoints now use a SCOPED add
  (`git add PROJECT_HANDOFF.md LESSONS.md`) — skipping the pass
  checkpoint then leaves the code visibly uncommitted instead of
  silently absorbed. Claude also avoids delivering two checkpoint blocks
  in one message when sequencing matters.
- Route: dev-method GI candidate — "scoped adds for docs commits; never
  two checkpoint blocks in one message."

## 2026-07-12 — the capture shipped without its consumer: a planned edit list is not applied edits [HARVESTED — 2026-07-12]

- What broke / what happened: pass 7c planned ~12 enemies.js edits; edit
  5 CAPTURED the death-start pose (`dieFromPitch`/`dieFromY`) and a
  planned sibling edit made the death fall CONSUME it. The consumer edit
  was never applied. Every applied edit verified its landing; `node
  --check` passed; the suite passed (nothing pins the interpolation's
  start point). Daniel hit it in the browser: a killed crawler stood up
  to fall over again.
- Root cause: verification covered each APPLIED edit's end state, not
  the PLAN's end state. A dropped step leaves no failing anchor, no
  syntax error, and no orphaned identifier a grep would flag — the
  captured fields simply sat unread. Half-shipped state machinery is
  invisible to every per-edit check.
- Plug shipped: fix was one edit (interpolate from the captured pose).
  Rule going forward: after a multi-edit implementation, walk the PLAN
  as a checklist against the final file — grep each planned change's
  signature (for state fields: the WRITE and the READ both) before
  delivery. New record fields with no consumer in the same delivery are
  a stop signal.
- Route: general instructions candidate (sibling of the scripted-edit
  landing-report rule — this is its plan-level generalization).

## 2026-07-12 — hand-trig on a rotated rig lied by 0.3 m: pose constants get a world-space probe [HARVESTED — 2026-07-12]

- What broke / what happened: the prone crawl pose shipped with
  PITCH 1.35 justified by chained hand-trigonometry. In the browser the
  head/jaw sat 0.30 m UNDER the floor in every stance and the pulling
  arm 0.48 m under. The hand math tracked part CENTRES along one axis
  and missed rotated box extents, child meshes (jaw/eyes ride the
  head), and compound joint angles.
- Root cause: a rigged body under two-plus compounded rotations exceeds
  reliable mental arithmetic; centre-point math systematically
  under-reports penetration because the offending geometry is corners
  and children, not centres.
- Plug shipped: a throwaway Node probe — suite-style DOM stub +
  `buildBody` + the EXACT pose transforms the branch applies +
  `Box3.setFromObject` per part — reporting min world-y per stance
  (gait extremes, windup peak, strike start, rest). Grid-searched the
  constants against measured penetration; final pose verified at
  +0.008 head clearance in all stances. The probe asserts the EFFECT
  (world y), the same rule as behavioral probes.
- Route: skill reference (html-game.md) — "pose/rig constants are
  probe-measured world-space before shipping; grid-search, don't
  hand-derive."
## 2026-07-13 — a multi-part delivery was partially applied: the checkpoint can't see a skipped paste-in [HARVESTED — 2026-07-13]

- What broke / what happened: pass 12 shipped as 4 downloads + 1
  waveTable paste-in. The paste-in was skipped; the checkpoint ran and
  pushed a commit that doesn't certify (§18 throws on the missing
  WAVES.HP block). The game itself never broke — `hpMultAt`'s guard
  returned 1 and it silently ran unscaled — and a second push landed
  the block.
- Root cause: the `git status` READ catches unexpected deletions and
  paths, but a file that was never edited simply doesn't appear — a
  skipped delivery step leaves NOTHING in the status to notice. The
  runtime guard also masked the miss in the browser.
- Plug shipped: checkpoint blocks now carry the expected changed files
  as a comment above `git status`, so the READ has an expectation to
  diff against; multi-part deliveries state the count explicitly
  ("5 files change: 4 downloads + 1 paste-in").
- Route: general instructions candidate (sibling of the
  status-is-a-READ rule).

## 2026-07-13 — assert the assert: two suite pins were wrong while the code was right [HARVESTED — 2026-07-13]

- What broke / what happened: in one session, two brand-new pins failed
  green code. (a) Multiset equality compared via
  `JSON.stringify(tally(...))` — key INSERTION order made equal
  multisets unequal strings after the pairing repair reordered an
  array. (b) A config-guard tested with `fn(50, undefined)` — a default
  parameter substitutes on `undefined`, silently re-injecting the real
  config, so the guard branch was never exercised at all.
- Root cause: pins are code too, and both bugs were representation
  traps — object key order is not canonical, and `undefined` triggers
  parameter defaults while `null` does not. A wrong pin either fails
  good code (a) or certifies nothing (b), which is the same false-green
  shape as a proxy test in the wrong runtime.
- Plug shipped: canonicalize before comparing structures (sorted-key
  stringify); exercise default-parameter guards with `null`; and when a
  brand-new pin fails, suspect the PIN first — hand-trace its claim
  before touching the system under test.
- Route: skill reference candidate (html-game.md testing conventions).

## 2026-07-14 — a registry paste landed in the WRONG BLOCK; the fallback guard hid it and a red suite shipped

- What broke / what happened: pass 13b's `RING_FRACTION: 0.85` paste-in
  landed inside the BRUTE's `CRAWL.WALL` block instead of replacing
  `STOP_DISTANCE` in `protoBase.CRAWL`. It was committed and pushed. Origin's
  suite was RED on arrival — 11 failures, all "missing CRAWL.RING_FRACTION" —
  and in the running game every crawler fell back to the old ring 1.1, making
  the attack gate 1.5 against a 1.95 wall standoff: a wall-backed player took
  ZERO crawl damage for the whole pass. That was the bug Daniel then reported.
- Root cause: two independent failures stacked. (a) The checkpoint was
  committed on the EXPECTED assert count from the delivery message ("suite
  401") without re-running the suite in the tree being committed — the gate
  existed, worked, and was simply never run. (b) A misplaced paste into a
  registry file is invisible to every cheap check: it parses, it imports, it
  leaves no orphaned identifier for a grep, and `git status` shows the file as
  modified exactly as expected. Worse, the `?? fallback` guard that protects
  hand-authored data from a MISSING optional field is precisely what converts
  a misplaced REQUIRED field into silent degradation instead of a loud crash.
- Verification gap it exposed: none in the suite — §5's schema named all four
  types on its first run. The gap was procedural (commit without re-running)
  plus the absence of any pin on the EFFECT: nothing asserted that a
  wall-backed player takes crawl damage, so even a run suite only said "a key
  is missing", not "your game is broken in this specific way".
- Plug shipped: suite §20 — a behavioural section driving the real loop (real
  colliders, real prone reach probe, real LOS, real gate) that fails with the
  symptom in its own words ("0 hits landed"); §19 extended to pin the real
  gate against the wall standoff in data terms (margin ~0.30 crawler / 0.21
  brute), which also catches a plausible RING_FRACTION tune that §5 and §15
  both wave through. Restated discipline: the suite runs in the tree being
  committed, not just before the delivery.
- Route: general instructions candidate — "never commit on an expected assert
  count; re-run the suite in the tree you are committing." Sibling of the
  status-is-a-READ rule; corollary for the skill's registry conventions — a
  paste-in that lands in the wrong block is the failure mode paste-ins have.

## 2026-07-14 — three pins in one pass that could not fail

- What broke / what happened: while hardening the crawl gate I wrote three
  pins and every one of them was a false green. (a) A data pin asserting
  `arm + slack >= held` — it never touches the code path, so reverting the
  gate to the broken version left it happily green. (b) A "every crawling
  type" behavioural loop that spawned proto/sprinter/brute STANDING, because
  only `crawler` carries `SPAWN.PRONE` — it certified the brute at its
  STANDING stop distance 2.00 while its true prone standoff is 2.51. (c) A
  crowd assert comparing distance to a hardcoded 2.6 (the new gate's own
  value) instead of asserting that damage landed — it passed under the bug it
  was written to catch.
- Root cause: each asserted a PRECONDITION or a PROXY rather than the effect
  — the same false-green family as #21. (b) adds its own species: a harness
  that silently doesn't set up the state it claims to test, so the section
  name and the assert text both lie while the numbers look plausible.
- Plug shipped: every new pin is now BITE-TESTED — break the thing it guards,
  watch it go red, restore. Both shipped pins were: botched paste → §20 "0
  hits landed" on all four types; `RING_FRACTION` 0.85→0.70 → §19 "margin
  −0.03" while §5 (key present) and §15 (valid fraction) pass it. §20 also
  carries an anti-false-coverage guard per type asserting the body is NOT at
  its standing ring, and forces prone through the REAL path (`damageEnemy` on
  a leg mesh, shot count derived from `LEG_HP / partDamage(type,'leg')`).
- Route: skill reference candidate (html-game.md testing conventions) —
  extends #21: "a new pin isn't done until you've broken the thing it guards
  and watched it go red"; and "a test harness that fabricates state must
  assert the state it fabricated."

## 2026-07-14 — I measured one build's trajectories and scored the OTHER build with them

- What broke / what happened: to justify a proposed gate change (13c) I
  measured what fraction of ticks a crawler spends inside the OLD gate — using
  trajectories generated by the NEW code. Attacks ROOT an enemy in place, so
  under the new wider gate a crawler reaches 2.41, attacks, and roots there,
  which reads as "parked outside the old gate, clawing at nothing". Under the
  old gate it never roots at 2.41 at all — it cannot attack from there, so it
  keeps crawling, squeezes through the pile to 1.95, and attacks normally. I
  reported "one crawler in three is a harmless prop", recommended the change
  on that basis, and Daniel accepted it. It was wrong.
- Root cause: the counterfactual was COMPUTED from the current build's data
  instead of RUN. A behaviour change alters the trajectories, so positions
  sampled under build A cannot score build B — especially when the changed
  code feeds back into movement (attack → root → position).
- Verification gap it exposed: nothing checks an analysis. The suite was green
  the whole time; the error was in the evidence I built the recommendation on.
- Plug shipped: compare two builds by RUNNING both and measuring the same
  effect in each. Control-difference (omit one enemy at a time, deterministic
  sim, no RNG in the update path) isolated real per-crawler damage: ring gate
  11/10/11 hits vs arm gate 14/14/15 — i.e. the status quo was never broken
  and 13c was a ~34% difficulty change, not a fix. It was dropped on the
  evidence and the false rationale ("gate where the claw lands") died with it:
  a STANDING zombie already attacks from up to 2.5 m with a body reaching
  0.916 m, so abstract attack range is this project's convention.
- Route: general instructions candidate — "a counterfactual about a code
  change must be RUN, not derived from the current build's numbers"; sibling
  of ARTIFACT-WINS (measure the real thing — and measure the RIGHT build).

## 2026-07-15 — the probe held a Material and read `.r` off it: NaN passed the assert it should have failed

- What broke / what happened: §21's eye-pulse probe fetched the exploder's eye
  handle with a helper that returned `c.material` — a MeshBasicMaterial — then
  read `.r`/`.g`/`.b` and `.getHex()` off it as if it were a `THREE.Color`. The
  colour lives at `material.color`, so every channel read came back `undefined`
  and every arithmetic result was NaN. Two asserts went red loudly
  (`getHex is not a function`, `k spans NaN → NaN`) — but a third, "the throb
  stays ON the base→peak segment", reported **0 stray samples and PASSED**,
  because its check was `if (Math.abs(x - y) > 1e-6) strays += 1` and
  `NaN > 1e-6` is `false`. It certified a probe that had never measured
  anything.
- Root cause: a comparison written as `> tolerance` silently treats NaN as
  "within tolerance". The failure mode isn't the wrong handle — that was loud —
  it's that the SAME wrong handle produced a green assert next to two red ones,
  so a partial fix would have left the vacuous pin standing.
- Verification gap it exposed: the suite has no guard that a probe's INPUT is
  live. Every pin downstream of a dead handle passes or fails on noise.
- Plug shipped: helper renamed `eyeColourOf` and returns `.color`; an
  `isFiniteColour` guard plus an explicit "the eye handle is a real Color
  (finite r/g/b)" assert now pins the input itself; and the stray check was
  inverted to `if (!(err <= 1e-6))` so NaN counts as a stray instead of a pass.
- Route: skill reference candidate (html-game.md testing conventions) —
  extends #21 and the 2026-07-14 false-green family: "write tolerance checks as
  `!(err <= tol)`, never `err > tol` — the two differ exactly on NaN, which is
  the value a broken probe produces"; and "a probe pins its own INPUT before it
  pins the system."

## 2026-07-15 — the suite HUNG on a zero divisor; a hang diagnoses nothing, so it is worse than a failure

- What broke / what happened: §21 derived its sample budget from the value
  under test — `periodMs = 1000 / X.PULSE_HZ`, then `for (let ms = 0; ms <
  periodMs; ms += 4)`. The bite-test for "a dead tell" sets `PULSE_HZ: 0`.
  `1000 / 0` is `Infinity`, `ms < Infinity` is always true, and the whole suite
  ran forever. The bite batch timed out with no output at all, and — worse —
  the timeout killed the harness before its `restore` step, leaving `PULSE_HZ:
  0` sitting in the working tree.
- Root cause: a loop bound computed from the system under test. The bite-test
  is *designed* to feed pathological values, so any probe whose control flow
  depends on those values can be driven off a cliff by its own test.
- Verification gap it exposed: a red suite names the broken thing; a hung suite
  names nothing, produces no output to grep, and costs a session to diagnose. A
  failing test is a diagnosis — a hanging one is an outage.
- Plug shipped: the budget is clamped (`samples = Math.min(400,
  Math.ceil(periodMs / 4))`) and the loop counts iterations, not milliseconds.
  Separately, §21 now pins `PULSE_HZ > 0` outright — the §5 schema only proves
  a field is FINITE, and 0 is finite, so a 0 Hz throb passed the schema and
  shipped a decorative constant. Bite harnesses now carry a per-run `timeout`.
- Route: skill reference candidate (html-game.md testing conventions) — "a
  probe must BOUND its own loop with a constant, never with a value it is
  testing"; and "a schema that proves FINITE does not prove USEFUL — zero,
  negative, and empty all pass a finiteness check."

## 2026-07-15 — Claude-side: my bite harness tested the wrong pin and ran a sed with no landing report

- What broke / what happened: bite-testing §22, two bites came back "PIN GUARDS
  NOTHING". Both verdicts were wrong, in different ways. (a) The harness ran
  `grep -E "reachable through the real wave table" | head -1` — but §21 carries
  a sibling pin with nearly the same label, sorts earlier, and `head -1` grabbed
  the EXPLODER's line while the SPITTER's line right below it was correctly red.
  (b) A second bite's `sed` printed no landing report, so I couldn't tell a
  no-op from a real miss and had to re-run it to find out.
- Root cause: the bite-test harness is code, and I exempted it from the rules I
  apply to every other scripted edit — unique anchors, and a landing report
  whose silence is itself a signal. A suite with sibling sections (§19/§21/§22
  all pin "reachable through the real wave table") makes a substring grep
  ambiguous by construction.
- Verification gap it exposed: a false "guards nothing" wastes time; a false
  "fires correctly" ships an unguarded pin. The same ambiguous grep produces
  both, and nothing catches it.
- Plug shipped: bite greps now target the section-unique wording (`spitter is
  reachable`, not `reachable through the real wave table`), and every bite's
  mutation prints a landing report (`grep -c` on the bitten string) before the
  suite runs. Re-run properly, 16 of 16 §22 pins fired.
- Route: general instructions candidate — "the test harness gets the same
  scripted-edit discipline as the code: unique anchors, landing reports, and a
  verdict you can distinguish from a no-op." Sibling of #18 and the 2026-07-14
  bite-test rule.

## 2026-07-15 — a registry comment stated a falsifiable claim, and float noise made it false

- What broke / what happened: the wave-8 row justified the spitter's 0.125
  share with "at count 8 it is EXACTLY 1.0 zombies, so largest-remainder cannot
  round the debut away. A 0.05 share would have been 0.4 and quietly floored to
  none." I bit the pin with a 0.05 share expecting it to go red. It stayed
  GREEN — the spitter still spawned. `0.05 × 8 − 0 = 0.40000000000000002220`,
  while `0.425 × 8 − 3 = 0.39999999999999991118`; the spitter WON the remainder
  tie-break on float noise and took the slot.
- Root cause: two things at once. The comment's example was simply false. And
  underneath it, largest-remainder rounding resolves exact ties by whatever the
  float representation happens to produce — so any share below `1/count`
  survives or vanishes by luck, not design.
- Verification gap it exposed: the pin ("the debut share PRODUCES a spitter
  through the real rounding") is honest and does fire at a 0.01 share — but it
  is weaker than its label implies, and nothing at all checks a comment. A
  wrong comment ON A TUNABLE is a trap for the next tune.
- Plug shipped: the comment now carries the measured numbers, states the real
  reason (at exactly 1.0 the debut wins a FLOOR slot and never touches the
  tie-break), and warns "don't tune below 1/count without re-checking §22's
  rounding pin". Same session, two sibling comment errors fixed the same way:
  `COOLDOWN_MS` was annotated "~3.3 s between shots" when the code sets
  `cooldownT` at the WINDUP (start-to-start), making the true period 2.6 s flat
  — 3.3 was `2600 + WINDUP_MS` double-counted, and `config.js` had inherited the
  same wrong figure in its pool-sizing rationale.
- Route: general instructions candidate — extends ARTIFACT-WINS to comments:
  "a comment that states a falsifiable claim about a tunable is code — verify it
  against the artifact or don't write it"; plus "exact ties in remainder
  rounding are decided by float noise; never let a design depend on winning
  one."

## 2026-07-15 — code of unknown provenance appeared in the sandbox; the `git status` READ is the only thing that caught it

- What broke / what happened: after syncing the sandbox to origin/main (`git
  reset --hard`, verified clean, suite green) and doing nothing but reads, a
  later `git status` showed six modified files plus an untracked
  `src/render/projectiles.js` — a complete, uncommitted pass 15 implementation
  with its own suite section, passing at 29 modules. It was in neither HEAD nor
  origin nor the session transcript (which greps clean for `projectiles`,
  `RANGED`, `arcVelocity` while showing 38 hits for `exploder`). I could not
  account for its authorship.
- Root cause: unknown, and that is the point. What matters is what nearly
  happened next: the routine checkpoint I hand Daniel every pass is `git add .`,
  and he runs those blocks verbatim by design. Had I not READ the status output,
  ~560 lines of unexplained code would have been silently absorbed into a commit
  in his portfolio repo.
- Verification gap it exposed: none of the automated gates care where code came
  from. The suite was GREEN on this work before I had read a line of it — which
  is exactly the assurance #21 says to distrust.
- Plug shipped: surfaced it to Daniel as an options round rather than absorbing
  or deleting it (deletion got the pre-flight: `projectiles.js` uniquely lived
  in the sandbox and nowhere else). On his call, it was adopted only after the
  full gate set: line-by-line read, end-state grep walk, ES-module import gate,
  and a BITE-TEST of all 16 new pins — which is what surfaced the float-noise
  tie-break and the two wrong tunable comments above. Verification is
  provenance-independent; trust is not.
- Route: general instructions candidate — "`git add .` is a blind instrument;
  the `git status` READ is what makes it safe, and it catches arrivals as well
  as deletions"; and "code you did not write yourself is adoptable only through
  the same gates you would apply to your own — green tests are not a review."

## 2026-07-15 — the bite harness ran its whole set against an ALREADY-RED tree: 22 confident false reds

- What broke / what happened: bite-testing pass 14c's §23, the harness reported
  22 of 23 pins RED and one MISS. Every one of those reds was worthless. Earlier
  I had hand-run a single bite (`sed` config's `MAX: 6` to `MAX: 0`) and
  restored it with a one-liner ending `cp /tmp/config.bak src/config.js && echo
  "restored"`. The word "restored" never printed and I did not notice: the
  command before it used `${PIPESTATUS[0]}`, a bashism, and the sandbox shell is
  dash — "Bad substitution" killed the rest of the line and took the restore
  with it. `MAX: 0` sat in the tree for the whole harness run, so the suite was
  red before any bite landed and would have gone red at literally anything.
- Root cause: a bite's verdict is a DIFFERENCE — "red with the mutation, green
  without it" — and I only ever measured the treatment. There was no control.
  The MISS is what exposed it: the anchor `MAX: 6` wasn't found because the file
  already said `MAX: 0`, and chasing that one word is the only reason the other
  22 didn't ship as certified.
- Verification gap it exposed: a false RED is not the harmless direction. It
  reads as "the pin works", so the pin never gets looked at again — and the two
  genuinely false-green pins hiding in that same run (next entry) would have
  gone out under a green suite with a clean bill of health.
- Plug shipped: the harness now runs the suite FIRST and ABORTS if it isn't
  green, printing "a red measured against a red tree is meaningless". Re-run
  honestly: 21 red, 2 real false greens surfaced. Both harnesses since (17 and
  the Option-3 tune) carry the gate as their first act.
- Route: general instructions candidate — "a bite harness measures a DIFFERENCE,
  so it must prove its control: gate on a green baseline before the first
  mutation, and treat a MISS as evidence about the tree, not just the anchor."
  Also: "never use bash-only syntax in sandbox one-liners — /bin/sh is dash, and
  a Bad substitution silently eats every command after it on the line."

## 2026-07-15 — the harness detector grepped for a string the suite has never printed: 23/23 false GREEN

- What broke / what happened: the first run of 14c's bite harness reported ALL
  23 bites GREEN — "the pin does not bite" — which would mean §23 was 30 asserts
  of pure decoration. It wasn't. The detector tested
  `out.includes(\`FAIL   ${expect}\`)` where `expect` was `'section23'`. But the
  suite's assert helpers print `  FAIL   <assert label>`; the section string
  goes into the `failures` array and never reaches stdout at all. The condition
  could not be true for any input.
- Root cause: I wrote the detector from my model of the suite instead of from
  its output. One manual run showed the real shape (`SUITE FAIL — 2 failure(s)`)
  in seconds.
- Verification gap it exposed: 23/23 identical verdicts is the signature of a
  broken instrument, not 23 broken pins — the same shape as #601's ambiguous
  grep, one level worse. And the failure direction was luckier than it deserved:
  a detector that always says GREEN wastes an hour; the same class of bug
  inverted says RED and certifies nothing.
- Plug shipped: detection now keys on `SUITE FAIL` — the line the suite actually
  emits — then confirms the red landed in the right section by slicing from that
  section's header. The manual run that exposed it also found a REAL bug the
  harness had been reaching for: `spawnBlast` called `blasts.reduce()` on an
  empty pool, which THROWS rather than returning undefined, so a mistuned
  `BLAST.MAX: 0` took out the entire kill callback instead of quietly skipping
  the decoration. Guarded with `if (!blasts.length) return null`.
- Route: general instructions candidate — "a harness that reads another
  program's output must be written against a REAL sample of that output, never
  against your model of it; and uniform verdicts across a whole set are
  evidence about the instrument."

## 2026-07-15 — two false-green pins sampled the exact instant their mutation cannot reach

- What broke / what happened: with an honest baseline, two of 14c's §23 pins
  stayed green under a mutation that genuinely broke the thing they guarded.
  (a) "the ring is still FULL BRIGHT the moment it lands" asserted
  `ringOpacity(growMs, growMs, fadeMs) === 1`. The mutation made the ring fade
  across the whole expansion — but the growth branch is `if (t < growMs)`, and
  at `t === growMs` that is false, so the pin sampled the ONE instant the
  mutation doesn't own. A ring fading the entire way down passed it.
  (b) "ringOpacity survives a zero fade time" sampled `t = growMs + 1`, which
  divides to `Infinity`; `Infinity >= 1` is true, so the fade branch returns a
  clean 0 and an unguarded function passes. The NaN only exists at
  `t === growMs` exactly, where the division is 0/0 and `NaN >= 1` is false.
- Root cause: both pins tested a POINT while their label claimed an INTERVAL,
  and in both cases the point I picked was the boundary — the one place a
  branch-based mutation is invisible. For (b) I reached for a "safely past the
  edge" sample when the guard exists for the edge itself.
- Verification gap it exposed: sibling of #436 ("assert the assert") but sharper
  — these pins were not wrong about the system, they were wrong about WHERE to
  look. Both would have certified a broken shockwave.
- Plug shipped: (a) now sweeps `[0, growMs)` and keeps the landing instant as a
  separate assert; (b) samples `0/0` at the boundary AND `x/0` past it. Both
  re-bitten red.
- Route: general instructions candidate — "a pin whose label says 'always' or
  'the whole time' must sweep the interval, not sample it; and a /0 guard is
  tested at the divisor's zero, not near it — the boundary is where the branch
  that hides the bug lives."

## 2026-07-15 — config.js declared two keys TWICE for nine passes, and a runtime schema physically cannot see it

- What broke / what happened: opening pass 17 I found `RECOIL_MS` and
  `RECOIL_KICK_DEG` each declared twice in `config.js`, adjacent, identical
  values. Harmless by luck — JS keeps the last and drops the rest — but tuning
  the FIRST copy of either would have done nothing, silently, and the §5 config
  contract with its full schema, usage scan and finite-leaf sweep had been
  watching them since pass 9 without a word.
- Root cause: not the duplicate, but the class. §5 validates the CONFIG OBJECT,
  and by the time the object exists the duplicate has already been collapsed by
  the language. No runtime guard can ever see this — the evidence is destroyed
  before any assertion runs. The origin is almost certainly a paste-in landing
  one block low, which is exactly what happened again in 14c (next entry).
- Verification gap it exposed: an entire bug class invisible to every layer §5
  had. And the delivery mode that creates it — config.js is paste-in-only by
  design, precisely because Daniel hand-tunes it — is the one we use most.
- Plug shipped: §5 gained a TEXT-level duplicate-key scan, block-scoped (same
  leaf name under two blocks is legal — `BLOOD.COLOR`/`CASINGS.COLOR`,
  `PROJECTILES.MAX`/`BLAST.MAX`), with a guard-the-guard on the parse (14 blocks
  seen). It caught both live duplicates on the day it landed. Pass 17 deleted
  them anyway by moving recoil onto the weapon registry.
- Route: general instructions candidate — "when a bug class is destroyed by the
  runtime before any assertion can run, the guard has to live at the level where
  the evidence still exists — for source-shaped bugs that is a text scan, not a
  schema."

## 2026-07-15 — the paste-in's ANCHOR got pasted: two comment lines doubled in a file Daniel hand-edits

- What broke / what happened: 14c's config.js paste-in showed a "find this"
  block and a "paste this" block as two adjacent fenced code blocks with nothing
  distinguishing them. Daniel pasted both. His committed config.js carried the
  PROJECTILES block's last two comment lines twice. Same shape in
  `enemyTypes.js`: `FX_COLOR` landed at column 27 instead of 5. Neither broke
  anything — the suite passed on his committed tree — but both are permanent
  noise in files he reads and hand-tunes, and I only found them because I diffed
  my sandbox against the remote before building on it.
- Root cause: a delivery format that renders an anchor and a payload
  identically. The anchor LOOKS like content to paste, because it is content,
  formatted as content. Nothing in the message says which is which.
- Verification gap it exposed: nothing on either side catches it. `git status`
  shows the file as modified, which is expected; the suite passes, because
  comments and indentation are invisible to it; and the duplicate-key scan
  above only exists as of this session — it would have caught the config half.
  The near-certain origin of the nine-pass-old RECOIL duplicates is this exact
  mechanism from an earlier session.
- Plug shipped: both files tidied and committed. Delivery rule going forward: an
  anchor block is labelled **FIND — do not paste**, or the paste-in becomes a
  single "replace these lines with this" block with no separate anchor at all.
  For 17's config.js — deletions in three places — I broke the paste-in-only
  rule deliberately and shipped a download instead, flagging the assumption that
  Daniel had not tuned it locally since the last push.
- Route: general instructions candidate — "a paste-in delivery must make the
  anchor typographically un-pasteable, or not have one: two adjacent code blocks
  are an instruction to paste both." Sibling of #417 (partial multi-part
  delivery).

## 2026-07-15 — the module floor sat at 28 while the walker found 29: a guard-the-guard that lags guards nothing

- What broke / what happened: `MIN_EXPECTED_MODULES` in §0 carried the comment
  "exactly this many modules exist today. Raise it when a module is added; a
  drop below means a module silently went missing" — and the value 28, while the
  walker found 29. Pass 15 added `projectiles.js` and never raised the floor. So
  for two passes, `projectiles.js` could have vanished entirely and Section 0's
  count assert would have shrugged.
- Root cause: a floor is only a floor while it touches the ground. Nothing
  enforced the comment's own instruction, and pass 15's review (which was
  unusually thorough — it audited every comment and pin after the provenance
  incident) audited claims and code, not constants.
- Verification gap it exposed: the guard-the-guard class needs a guard. `>=`
  makes the assert permanently satisfiable by construction, so it degrades
  silently rather than failing.
- Plug shipped: 28 → 30 in 14c, → 31 in 17, with the drift recorded in the
  comment so the next reader sees that it HAS happened. Bite-tested both times
  by deleting a module.
- Route: general instructions candidate — "a floor set with `>=` decays into a
  no-op the moment the truth moves past it; any guard whose comment says
  'exactly N today' must be raised in the same pass that changes N, and the
  pass's checklist should name it."

## 2026-07-15 — my probe repaired the thing it was measuring: getWorldPosition updates the matrix it reads

- What broke / what happened: measuring the shotgun's kill rate vs range, my
  probe reported that EVERY landed pellet hit the head and none the torso, at
  every range — impossible at 20 m where the whole body sits inside the cone. I
  wrote a diagnostic that walked every hitbox printing its world position to
  find the stale ones. Every position came back correct. The probe looked
  vindicated. It wasn't: `getWorldPosition` calls `updateWorldMatrix`
  internally, so the act of asking each mesh where it was FIXED each mesh. The
  probe itself only ever asked the HEAD — every other hitbox kept a stale matrix
  at the origin, invisible to the raycaster — and the diagnostic could not
  reproduce that because looking repaired it.
- Root cause: no `scene.updateMatrixWorld(true)` in the probe, and a diagnostic
  whose measurement had a side effect on the thing measured. The true curve was
  ~4x worse than the fiction (0.83 pellets/shot at 20 m, not 0.18).
- Verification gap it exposed: a probe with a side effect is not an
  observation. And the shape is nastier than a plain wrong probe, because the
  confirming diagnostic AGREED — I nearly shipped a tuning decision on numbers
  that only existed inside the measurement.
- Plug shipped: the corrected probe calls `scene.updateMatrixWorld(true)` after
  spawn; the histogram that exposed it (where do pellets actually land?) is now
  the first thing I run, because it asks a question the fiction couldn't answer.
  Option 3's values came from the corrected run.
- Route: general instructions candidate — "a probe must not use accessors that
  mutate what they read; when a diagnostic CONFIRMS a suspect probe, suspect the
  diagnostic — agreement between two instruments that share a side effect is one
  instrument." Sibling of #296 ("the probe mimicked the defect") and #548 (the
  probe held a Material).

## 2026-07-15 — Claude-side: my edit script nested three quoting levels and the tool call leaked into the chat

- What broke / what happened: mid-pass-17 I sent an edit script as
  `cat > /tmp/edit_main2.cjs <<'ENDOFSCRIPT'` containing JS template literals.
  The tool call malformed on the way out — the opening bracket was eaten and the
  backticks mangled — so it never executed and instead printed to Daniel as a
  wall of broken script. He had to ask what it was. Worse: the PREVIOUS edit had
  run, so `main.js` sat half-converted — `getActiveWeaponId` used but never
  imported, and `initShooting` still on `onHit`/`onMiss` while `shooting.js` had
  already moved to `onShot`. Nothing would have worked.
- Root cause: LESSONS already says multi-line edit scripts run as script files,
  never as inline heredocs — and I followed the letter (I WAS creating a script
  file) while breaking the spirit. The rule exists because nesting quote levels
  is fragile, and a JS file full of backticks and `${}`, inside a bash heredoc,
  inside tool-call XML, is three levels deep. It broke at the outermost.
- Verification gap it exposed: none on the tooling side — the failure was
  visible and loud. The real exposure is that a multi-step edit has an
  intermediate state that is worse than either end, and a script that dies
  between steps leaves it there. `node --check` passed the half-converted file
  cheerfully.
- Plug shipped: edit scripts are written with `create_file` — no bash quoting
  layer at all — and every one exits before `writeFileSync` if any anchor misses
  (all-or-nothing, so a MISS leaves the file untouched rather than half-edited).
  That design caught an ambiguous anchor later the same pass and the tree stayed
  clean.
- Route: general instructions candidate — "use the file-creation tool for edit
  scripts, never a shell heredoc: the rule is about QUOTE NESTING, not about
  whether a file ends up on disk"; and "a multi-edit script must be
  all-or-nothing — exit before writing if any anchor misses, because the
  half-applied state passes every cheap gate."

## 2026-07-15 — a bad bite is indistinguishable from a false-green pin, and a neutral mutation is neither

- What broke / what happened: pass 17's bite run came back 23 red, 3 problems.
  All three were the harness, not the suite. (a) "magazines SHARED across
  weapons" reported GREEN — but the mutation appended an unused key
  (`mags.__shared = 0`) and shared nothing; re-aimed to make every weapon spend
  the pistol's counter, it went red on exactly the right three pins. (b) "a
  required field goes missing" MISSED on `~1.8x` versus the file's `~1.8×` — I
  retyped the anchor instead of copying it. (c) "the PISTOL gets perturbed too"
  (`if (spreadRad > 0)` → `if (true)`) reported GREEN and was CORRECT to:
  `spreadOffset(0,…)` returns exact `{0,0}`, so the mutation is semantically
  neutral — the branch is an optimisation, not a guard.
- Root cause: a bite's verdict is only as good as the bite. A mutation that
  doesn't mutate, an anchor that doesn't match, and a mutation that is genuinely
  a no-op all print the same word, and that word looks like an accusation
  against the pin.
- Verification gap it exposed: the harness reports on the SUITE, and nothing
  reports on the harness. The MISS is self-announcing; the other two are not.
- Plug shipped: bites now print WHICH assert labels went red, so a red for the
  wrong reason is visible; anchors are copied from the file, never retyped; and
  a neutral mutation is documented as a NON-bite in the delivery rather than
  quietly dropped or papered over.
- Route: general instructions candidate — "a GREEN bite has three causes — a
  false pin, a bite that didn't bite, and a mutation that changed nothing —
  and only the first is about the code; print the caught labels so a red for the
  wrong reason is visible too."
