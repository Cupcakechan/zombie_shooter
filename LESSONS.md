# LESSONS.md — error record (feeds the dev-method)

A queue, not an archive: when something breaks or surprises us, it gets a short
entry here. Dev-method skill sessions harvest routed entries into skill/GI
updates and mark them `HARVESTED — <date>` (or delete them).

## 2026-07-11 — Browser import maps are invisible to the Node test suite

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

## 2026-07-11 — NaN light intensity blacks out every lit material (unlit survives)

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

## 2026-07-11 — the missing-key class struck twice: config (again) and its registry twin was still open
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

## 2026-07-12 — camera-space sign flip put the ejection port behind the gun

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

## 2026-07-12 — Claude-side: `git pull` aborts on sandbox scratch copies but prints `Updating x..y`

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

## 2026-07-12 — a checkpoint block without `git push` desynced the remote (Daniel copies blocks verbatim)

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

## 2026-07-12 — scaling an ACCUMULATED phase by a changing blend = whole-body shake (integrate rates, never scale phases)

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

## 2026-07-12 — animation feel is a multi-round loop by nature; probes catch slips, only eyes catch reads

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

## 2026-07-12 — every renderer.render() repaints scene.background: the gun's overlay pass wiped the world (black screen)

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

## 2026-07-12 — thin boundary colliders eject bodies to the WRONG side (probe caught it pre-ship)

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
