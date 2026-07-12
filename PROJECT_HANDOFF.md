# PROJECT_HANDOFF — Zombie Shooter

Repo: https://github.com/Cupcakechan/zombie_shooter.git
Local: C:\Users\danie\Documents\HTML Projects\zombie_shooter
Updated: 2026-07-12 — session 2 end, THIRD wrap (supersedes the same-day
first two). This wrap adds **Stage 4 (the village map) passes 4.1–4.2b**
on top of the completed pass 7 creature, pass 8 atmosphere, and pass 9
reload. HEAD at write time: `88893e9`.

## 0. NEXT SESSION OPENS WITH (Daniel's kickoff request)

**Deep research: prior-art three.js zombie shooters**, mapped against our
roadmap (4.3 nav, audio, dismemberment, scoring, more enemy types, more
environments). Sources Daniel named:
- https://github.com/rohanvashisht1234/threejs-zombieshooter-game
- https://github.com/UstymUkhman/YetAnotherZombieHorror
- https://codepen.io/Data-Bee38/pen/gbYaeeO
- A LOST project (site + repo gone; the author's post below is the only
  artifact — preserved verbatim, it's the research lead):
  > "It's a wave-based survival game with 5 different environments that
  > change as you progress through waves - forest, city, cave, hospital,
  > and mall. There are 15 different enemy types including various
  > zombies and wolves, and 6 weapons to unlock as you play. I created a
  > particle system for visual effects like blood and muzzle flashes,
  > and implemented physical projectiles with collision detection. The
  > game uses Three.js to geometrically build the enemy models, rather
  > than using imported pre-existing 3d models, although the weapons do
  > use GLTF external models. The environments use a mix of procedural
  > generation for the cave and hospital mazes, random object placement
  > for the city and forest and a CSV-based layout for the mall.
  > Everything is built with Vite and three.js, aswell as using
  > Firestore and Firebase for storage and deployment."
- "and others if you can include it" — Claude should search for further
  code-built-enemy three.js shooters worth mining.
Method: clone the public repos in the sandbox and read code directly;
web-search for the lost project (the description's specifics — 5 named
environments, 15 enemies, CSV mall — are searchable); extract TECHNIQUES
(enemy construction, environment generation, particles, weapons, nav),
not code, and map each finding to a roadmap item. Deliverable: a research
report → options round on what to adopt. **The queued build pass (4.3
navigation) remains scheduled — Daniel said the research is "aside from
the pending passes"; confirm ordering with him at session open.**

## 1. What this project is

A browser FPS in **three.js r185**, code-built everything (no downloaded
models/assets), built pass-by-pass. Two modes from START:
- **Range** — 60 s score attack (targets, streaks ×2@10/×3@20, accuracy,
  localStorage PB). Reload applies (pre-pass-9 PBs = infinite-ammo era).
- **Waves** — untimed last-stand in **the village** (Stage 4): four
  roomed buildings around a fountain plaza, fog + low fence at the map
  edge, escalating zombie waves, 5-hit arcade health, GAMEOVER.

`DESIGN.md` v3.0 (updated this session through pass 9 + creature) — but
Stage 4's progress happened AFTER v3.0, so its §2 row says "unscheduled":
one small changelog entry (v3.1) is queued docs debt. **No DevLog.**

## 2. Method & session rules (the short list)

- Options round → Daniel picks → one tested pass per commit; full files
  as downloads + exact paths; **config.js paste-in ONLY**; enemyTypes.js
  / waveTable.js / maps.js full-replace with a "tuned anything?" caveat.
  Daniel commits his tunes separately.
- Feel reports: mechanism → single lever → surgical value. Bugs: the
  debugging protocol (evidence before hypothesis — the black-screen fix
  came from reading the shipped code, not guessing).
- **Claude sync: `git fetch origin && git reset --hard origin/main`,
  never pull; verify tip + one changed value + key docs.** Checkpoint
  blocks are COPY-COMPLETE (end with `git push`) — an omitted push
  desynced the remote once; if Daniel's "pushed" and the remote
  disagree, STOP and reconcile.
- Run `node test_suite.mjs` before every delivery. Render-path changes
  are SUITE-INVISIBLE (no WebGL in the sandbox) — name them as
  browser-first in testing steps (LESSONS, black-screen incident).

## 3. Current state (all tested & pushed)

**Stage 4 — the village (passes 4.1–4.2b DONE, 4.3 NEXT):**
- **Maps are data** (`data/maps.js`): ASCII tile layouts — `#` wall,
  `.` ground, `D` doorway, `W` window, `F` fountain, `P` start — plus
  CELL 1.6 / FLOOR_H 3.2 / sill 1.0 / header 0.8 / ANCHOR / COLORS.
  Geometry, colliders, occluders, and the future nav grid ALL derive
  from the one layout. Registry holds **village01 (ACTIVE)** — Daniel's
  sketch: 4 buildings with interior rooms + jambed doorways, 6 windows,
  3×3 fountain plaza, 21×23 cells (33.6×36.8 m) — and house01 as the
  second valid map. `ACTIVE_MAP_ID` picks.
- **`game/mapGrid.js`** (pure): parseLayout (throws on ragged/dup-P),
  floodReachable (sealed-room proof; the seed of 4.3's flow field),
  countWalkable, cellToWorld (ANCHOR-centred), playerWorldStart (the
  map owns the start — Waves spawns at P: village (−11.2, −2.2)),
  buildColliders (blocked cells → run-merged 2D AABBs + the fence as
  THICK OUTWARD BANDS — thin boxes eject wrong-side, probe-caught,
  LESSONS).
- **`render/mapGen.js`**: run-merged wall boxes, window sill+header,
  door jambs+lintels, fountain (basin/column/water), fence ring. Every
  mesh `kind:'wall'` = raycast occluder.
- **Collision (4.2)**: `movement.js resolveCircleAABBs` (2 sweeps,
  normal-only pushout = wall sliding; 6 probes). Player chain:
  clamp → zombie pushout → walls LAST. Zombies collide too
  (`enemies.js setMapColliders`, resolve after separation) — they PILE
  at walls/doorways until 4.3; Daniel likes the pressure read.
  Wall hits eat the bullet (explicit branch in main onHit).
- **Gun on render layer 1 (4.2b)**: world pass → clearDepth → gun pass
  **with scene.background NULLED** (the un-nulled version repainted sky
  over the world — black-screen incident, LESSONS). Muzzle light on
  both layers; scene lights enabled on layer 1.
- **Arena grown (4.1c)**: RANGE WIDTH 36 / BACK_Z −36 / FRONT_Z 6;
  spawns moved to the new perimeter (0,−30)(±13,−30)(±15.5,−14).
  Everything derived (walls, floor, fog bank, clamp) recomputed with
  ZERO suite edits — the relative-invariant payoff, ~measured.

**Pass 7 creature (COMPLETE, earlier wraps):** the Shambler — registry
body, drag-limp gait (8 rounds), overhead slam, per-part hitboxes
(HEAD 3 / TORSO 1 / LIMB 0.5, headshot one-shot + double burst), squash
flinch spring (ported secondOrder + Section 12; KICK 2 Daniel-tuned).
**Pass 9 reload** (mag 12, R + auto-empty, 1200 ms, both modes —
provisional). **Pass 8 atmosphere** (fog bank + murk NEAR 3/FAR 13,
blood, casings; audio deferred). World sim freezes outside PLAYING.

## 4. NEXT BUILD PASS: 4.3 — navigation (scoped)

Flow field on the map grid: BFS from the player's cell (recompute when
the player changes cells), zombies descend the field — fixes the
fountain-stuck beeline Daniel reported (deferred to here by design).
Doorway routing falls out free; **windows become zombie entries** (climb
over sills — the spawn system likely reworks to window-based entries).
floodReachable is the designed seed. Daniel's read of zombies pressing
at walls ("like it") should inform how aggressive window-entry is.

## 5. The suite — 27 modules, 231 asserts, run before EVERYTHING

Sections: 0 module health (MIN 27); 1 target spawns; 2 scoring; 3 round;
4 best; 5 config (87 keys, 116 registry leaves, enemy schema 83 fields,
SHIP gate); 6 timelines; 7 player health/attack pacing; 8 waves + fog
coverage; 9 movement math + **AABB resolver (incl. sliding + corner)**;
10 ammo; 11 body geometry + hitbox tags; 12 springs; **13 map integrity**
(constants, parse, one P, windows embedded in wall runs, fountains
blocked, flood covers all walkable — village 387/387, extent fits clamp,
start inside, blocked-cells-solid + walkable-centres-free agreement,
fence-line ejects INWARD).

## 6. Open / outstanding / banked

- **4.3 navigation** — next build pass (§4).
- **Research kickoff** — §0, Daniel's request, next session opener.
- DESIGN.md v3.1 — one changelog entry for Stage 4 progress (small).
- Wave kill scoring (headshot bonus hook) — still undecided.
- Reload scope (both modes) — provisional.
- **Banked:** dismemberment (7b tags + limb meshes are the substrate);
  basement/stairs = Stage 4b (layouts-per-floor extension); pass 8
  audio (needs generated assets); itch.io deploy (SHIP gate ready).
- Stale hand-file comments flagged not overwritten: enemyTypes
  SQUASH_KICK "~9%" (kick 2 ≈ 4–5%), LIMP comment describes old
  knee-only behaviour. config.js duplicate RECOIL pair (harmless).
- LESSONS.md: **10 entries, 7 unharvested (2026-07-12)** — port-sign
  anchors; fetch+reset; copy-complete checkpoints; integrate-don't-
  scale phases; animation feel-loop; background-repaint/render-path-
  browser-first; thick-band barriers + eject-direction probes.

## 7. MEASURED facts (do not re-derive)

- Facing: `rotation.y = atan2(dx,dz)` on +Z-built bodies; player fwd
  = (−sinY,−cosY); camera/gun −Z-forward, BODY-local +Z; muzzle
  gun-local (0, 0.03, −0.45).
- Spring f5 ζ0.4: kick→peak ≈ ×0.022, settle ~350 ms (Section 12).
- Two-pass render: null scene.background on every pass after the first.
- One-sided barriers: thick outward bands; probe the eject DIRECTION.
- Village: 21×23 @ CELL 1.6, ANCHOR (0,−15), extent x ±16.8 /
  z −33.4..3.4 inside clamp (±17.4 / −35.4..5.4); P → (−11.2, −2.2).
- Diagnostic: black scene + live HUD + no console errors = NaN transform
  OR a render-path paint-over — if the GUN is visible, it's the latter.

## 8. Session hygiene for next session

Attach this file. Open with the §0 research question (confirm ordering
vs 4.3). Clone, fetch+reset, confirm tip with Daniel, run the suite —
expect **SUITE PASS, 27 modules, 231 asserts**. Every checkpoint block
ends with `git push`. Rewrite this handoff at session end; sweep
LESSONS.md (7 unharvested entries await a dev-method harvest).
